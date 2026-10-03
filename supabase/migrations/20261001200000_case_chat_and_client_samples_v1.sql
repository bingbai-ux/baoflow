-- CLI-generated, reordered after Stage11. Local candidate; no legacy recipient backfill.
alter table public.sample_invoices add column client_id uuid references public.clients(id);
create function public.bind_sample_invoice_client() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare party uuid;
begin
 select client_id into party from deals where id=new.deal_id;
 if party is null or (new.client_id is not null and new.client_id<>party) then raise exception 'Actual invoice customer required';end if;
 new.client_id=party;new.snapshot=new.snapshot||jsonb_build_object('client_id',party);return new;
end$$;
revoke all on function public.bind_sample_invoice_client() from public,anon,authenticated;
create trigger bind_sample_invoice_client before insert on public.sample_invoices for each row execute function public.bind_sample_invoice_client();
create function public.client_sample_invoices(p_invoice_id uuid default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare party uuid;r jsonb;
begin
 select client_id into party from profiles where id=auth.uid() and role='client';if auth.uid() is null or party is null then raise exception 'Own client identity required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'deal_id',i.deal_id,'document_number',i.document_number,'status',i.status,'previous_invoice_id',i.previous_invoice_id,'cancellation_reason',null,'snapshot',(i.snapshot-'lines')||jsonb_build_object('lines',(select coalesce(jsonb_agg(l-'cost_id'),'[]') from jsonb_array_elements(i.snapshot->'lines') l))) order by i.created_at desc),'[]') into r from sample_invoices i where i.client_id=party and i.snapshot->>'client_id'=party::text and (p_invoice_id is null or i.id=p_invoice_id);
 return r;
end$$;
revoke all on function public.client_sample_invoices(uuid) from public,anon;grant execute on function public.client_sample_invoices(uuid) to authenticated;

-- Legacy rooms remain staff-only. New external rooms name one current counterparty.
alter table public.chat_rooms add column peer_role text check(peer_role in('client','factory','logistics'));
alter table public.chat_rooms add column peer_id uuid;
alter table public.chat_rooms add constraint case_chat_peer_pair check((peer_role is null)=(peer_id is null));
create unique index case_chat_peer_room on public.chat_rooms(deal_id,peer_role,peer_id) where peer_role is not null;
alter table public.chat_messages add column sequence bigint;
create unique index case_chat_message_sequence on public.chat_messages(room_id,sequence) where sequence is not null;
create table public.case_chat_reads(room_id uuid not null references public.chat_rooms(id),user_id uuid not null references public.profiles(id),last_sequence bigint not null default 0 check(last_sequence>=0),primary key(room_id,user_id));
alter table public.case_chat_reads enable row level security;
revoke all on public.case_chat_reads from public,anon,authenticated;
revoke all on public.chat_rooms,public.chat_messages from public,anon,authenticated;

create function public.case_chat_peer_valid(p_deal uuid,p_role text,p_peer uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from deals d where d.id=p_deal and d.archived_at is null and (
 (p_role='client' and d.client_id=p_peer) or
 (p_role='factory' and (exists(select 1 from factory_purchase_orders o where o.deal_id=d.id and o.factory_id=p_peer and o.status='ordered') or exists(select 1 from rfq_factory_invitations i join rfq_requests r on r.id=i.rfq_id where r.deal_id=d.id and i.factory_id=p_peer) or exists(select 1 from sample_rounds s where s.deal_id=d.id and s.factory_id=p_peer))) or
 (p_role='logistics' and exists(select 1 from shipment_plans s where s.deal_id=d.id and s.logistics_actor_id=p_peer))))
$$;
create function public.case_chat_allowed(p_room uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from chat_rooms r join profiles u on u.id=auth.uid() where r.id=p_room and (u.role::text in('sales','admin') or (r.peer_role is not null and case_chat_peer_valid(r.deal_id,r.peer_role,r.peer_id) and ((u.role::text='client' and r.peer_role='client' and u.client_id=r.peer_id) or (u.role::text='factory' and r.peer_role='factory' and u.factory_id=r.peer_id) or (u.role::text='logistics' and r.peer_role='logistics' and u.id=r.peer_id)))))
$$;
revoke all on function public.case_chat_peer_valid(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.case_chat_allowed(uuid) from public,anon;grant execute on function public.case_chat_allowed(uuid) to authenticated;
do $$declare p record;begin for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in('chat_rooms','chat_messages') loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;end$$;
alter table public.chat_rooms enable row level security;alter table public.chat_messages enable row level security;
create policy case_chat_room_read on public.chat_rooms for select to authenticated using(case_chat_allowed(id));
create policy case_chat_message_read on public.chat_messages for select to authenticated using(case_chat_allowed(room_id));
grant select on public.chat_rooms,public.chat_messages to authenticated;

create function public.open_case_chat(p_deal uuid,p_role text,p_peer uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
 if auth.uid() is null or not is_staff() or not case_chat_peer_valid(p_deal,p_role,p_peer) then raise exception 'Staff and current assigned counterparty required';end if;
 perform 1 from deals where id=p_deal for update;
 insert into chat_rooms(deal_id,room_type,peer_role,peer_id) values(p_deal,(case when p_role='client' then 'client_sales' when p_role='factory' then 'sales_factory' else 'internal' end)::chat_room_type,p_role,p_peer) on conflict(deal_id,peer_role,peer_id) where peer_role is not null do update set peer_id=excluded.peer_id returning id into rid;
 return rid;
end$$;
create function public.send_case_chat(p_request_id uuid,p_room uuid,p_content text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m chat_messages;r chat_rooms;n bigint;
begin
 if auth.uid() is null or p_request_id is null or not case_chat_allowed(p_room) or nullif(btrim(p_content),'') is null or length(p_content)>2000 then raise exception 'Own room and bounded message required';end if;
 select * into r from chat_rooms where id=p_room for update;
 if r.peer_role is null or not case_chat_peer_valid(r.deal_id,r.peer_role,r.peer_id) then raise exception 'Current explicitly selected counterparty required';end if;
 select * into m from chat_messages where id=p_request_id;
 if found then if m.room_id<>p_room or m.user_id<>auth.uid() or m.content_original<>btrim(p_content) then raise exception 'Message request has different actor or content';end if;return jsonb_build_object('id',m.id,'sequence',m.sequence);end if;
 select coalesce(max(sequence),0)+1 into n from chat_messages where room_id=p_room;
 insert into chat_messages(id,room_id,user_id,content_original,original_language,source,sequence) values(p_request_id,p_room,auth.uid(),btrim(p_content),'ja','app',n);
 return jsonb_build_object('id',p_request_id,'sequence',n);
end$$;
create function public.read_case_chat(p_room uuid,p_before bigint default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare rows jsonb;older boolean;
begin
 if auth.uid() is null or not case_chat_allowed(p_room) then raise exception 'Own room required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sequence',m.sequence,'content',m.content_original,'mine',m.user_id=auth.uid(),'sender',case when u.role::text in('sales','admin') then 'BAO営業' when u.role::text='factory' then '工場' when u.role::text='client' then '顧客' else '物流' end,'created_at',m.created_at) order by m.sequence),'[]') into rows from (select * from chat_messages where room_id=p_room and sequence is not null and (p_before is null or sequence<p_before) order by sequence desc limit 100) m left join profiles u on u.id=m.user_id;
 select exists(select 1 from chat_messages where room_id=p_room and sequence<(select min((value->>'sequence')::bigint) from jsonb_array_elements(rows))) into older;
 return jsonb_build_object('messages',rows,'has_more',older);
end$$;
create function public.mark_case_chat_read(p_room uuid,p_sequence bigint) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not case_chat_allowed(p_room) or not exists(select 1 from chat_messages where room_id=p_room and sequence=p_sequence) then raise exception 'Observed own message required';end if;
 insert into case_chat_reads values(p_room,auth.uid(),p_sequence) on conflict(room_id,user_id) do update set last_sequence=greatest(case_chat_reads.last_sequence,excluded.last_sequence);
end$$;
create function public.list_case_chats(p_deal uuid default null) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'deal_id',r.deal_id,'label',d.deal_code||' / '||case when is_staff() then case r.peer_role when 'client' then '顧客：'||coalesce(c.company_name,'未確認') when 'factory' then '工場：'||coalesce(f.factory_name,'未確認') else '物流：'||coalesce(l.display_name,'担当物流') end else 'BAO営業との会話' end,'unread',(select count(*) from chat_messages m where m.room_id=r.id and m.user_id<>auth.uid() and m.sequence>coalesce((select last_sequence from case_chat_reads where room_id=r.id and user_id=auth.uid()),0))) order by r.created_at),'[]') from chat_rooms r join deals d on d.id=r.deal_id left join clients c on r.peer_role='client' and c.id=r.peer_id left join factories f on r.peer_role='factory' and f.id=r.peer_id left join profiles l on r.peer_role='logistics' and l.id=r.peer_id where auth.uid() is not null and r.peer_role is not null and case_chat_allowed(r.id) and (p_deal is null or r.deal_id=p_deal)
$$;
revoke all on function public.open_case_chat(uuid,text,uuid),public.send_case_chat(uuid,uuid,text),public.read_case_chat(uuid,bigint),public.mark_case_chat_read(uuid,bigint),public.list_case_chats(uuid) from public,anon;
grant execute on function public.open_case_chat(uuid,text,uuid),public.send_case_chat(uuid,uuid,text),public.read_case_chat(uuid,bigint),public.mark_case_chat_read(uuid,bigint),public.list_case_chats(uuid) to authenticated;

create function public.case_chat_targets(p_deal uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Staff required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('role',role,'id',id,'label',label) order by role,label),'[]') into r from (
 select 'client' role,c.id,'顧客：'||c.company_name label from deals d join clients c on c.id=d.client_id where d.id=p_deal and d.archived_at is null
 union select 'factory',f.id,'工場：'||f.factory_name from factories f where case_chat_peer_valid(p_deal,'factory',f.id)
 union select 'logistics',u.id,'物流：'||coalesce(u.display_name,'担当物流') from profiles u where u.role::text='logistics' and case_chat_peer_valid(p_deal,'logistics',u.id)
 ) peers;
 return r;
end$$;
revoke all on function public.case_chat_targets(uuid) from public,anon;grant execute on function public.case_chat_targets(uuid) to authenticated;
