-- 届いたメールの自動取り込み: 顧客・工場がメールに返信すると、案件のトーク欄（deal_communications）に自動で入る。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。
-- 書き込みはサーバーの受信口（/api/inbound-mail）だけが、管理用の鍵（service_role）で下の関数を呼んで行う。
-- Rollback: drop function record_inbound_mail(text,uuid,text,text,text,text,text,jsonb), add_inbound_mail_files(text,jsonb); drop table inbound_mails;

create table if not exists public.inbound_mails (
  id uuid primary key default gen_random_uuid(),
  email_id text not null unique,            -- メール配信サービス側の番号（同じメールを二重に取り込まないため）
  deal_id uuid not null references public.deals(id) on delete cascade,
  party text not null check (party in ('client', 'factory')),
  communication_id uuid references public.deal_communications(id) on delete set null,
  from_address text,
  to_address text,
  subject text,
  attachments jsonb not null default '[]'::jsonb,  -- [{name, type, size, saved}]
  received_at timestamptz not null default now()
);
create index if not exists inbound_mails_deal_idx on public.inbound_mails (deal_id, received_at desc);
alter table public.inbound_mails enable row level security;
drop policy if exists staff_read on public.inbound_mails;
create policy staff_read on public.inbound_mails for select to authenticated using (public.is_staff());
revoke all on public.inbound_mails from anon, authenticated;
grant select on public.inbound_mails to authenticated;

-- 届いたメール1通をトーク欄に入れる。同じメールが2回届いても1件だけ残す。
create or replace function public.record_inbound_mail(p_email_id text, p_deal_id uuid, p_party text, p_from text, p_to text, p_subject text, p_body text, p_attachments jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; v_comm uuid; v_body text; v_names text;
begin
  if coalesce(btrim(p_email_id), '') = '' then raise exception 'メールの番号がありません'; end if;
  if p_party not in ('client', 'factory') then raise exception '相手の種類が不正です'; end if;
  if exists (select 1 from public.inbound_mails where email_id = p_email_id) then return jsonb_build_object('success', true, 'already', true); end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then return jsonb_build_object('success', false, 'reason', 'deal_not_found'); end if;
  -- for update の後にもう一度確かめる（同時に2回届いたとき用）
  if exists (select 1 from public.inbound_mails where email_id = p_email_id) then return jsonb_build_object('success', true, 'already', true); end if;
  select string_agg(left(a->>'name', 120), '、') into v_names from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) a where coalesce(a->>'name', '') <> '';
  v_body := coalesce(nullif(btrim(left(p_body, 8000)), ''), '（本文なし）')
    || case when v_names is not null then E'\n\n添付: ' || v_names else '' end
    || E'\n\n差出人: ' || coalesce(nullif(btrim(left(p_from, 200)), ''), '不明');
  insert into public.deal_communications (deal_id, author_user_id, author_role, channel, subject, body, is_read, occurred_at)
    values (d.id, null, p_party, 'email', nullif(btrim(left(p_subject, 200)), ''), v_body, false, now())
    returning id into v_comm;
  insert into public.inbound_mails (email_id, deal_id, party, communication_id, from_address, to_address, subject, attachments)
    values (p_email_id, d.id, p_party, v_comm, left(p_from, 320), left(p_to, 320), left(p_subject, 200), coalesce(p_attachments, '[]'::jsonb));
  update public.deals set waiting_on = 'us', last_activity_at = now() where id = d.id;
  if d.sales_user_id is not null then
    insert into public.notifications (user_id, deal_id, type, status, content)
      values (d.sales_user_id, d.id, 'dashboard', 'pending',
        case when p_party = 'client' then coalesce(d.client_name_text, '顧客') else '工場' end || ' から「' || coalesce(d.deal_name, d.deal_code) || '」にメールの返信が届きました。');
  end if;
  return jsonb_build_object('success', true, 'already', false, 'communicationId', v_comm);
end $$;

-- 届いたメールの添付ファイルを、案件のファイルとして登録する（保存できなかったものはトークの本文に書き足す）。
-- p_files: [{name, type, size, storage_path, url, saved}]
create or replace function public.add_inbound_mail_files(p_email_id text, p_files jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.inbound_mails; f jsonb; v_version integer; v_failed text; v_saved integer := 0;
begin
  select * into m from public.inbound_mails where email_id = p_email_id for update;
  if not found then raise exception '届いたメールが見つかりません'; end if;
  if exists (select 1 from jsonb_array_elements(m.attachments) a where a ? 'saved') then return jsonb_build_object('success', true, 'already', true); end if;
  select coalesce(max(version_number), 0) into v_version from public.deal_design_files where deal_id = m.deal_id;
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if (f->>'saved')::boolean and coalesce(f->>'url', '') <> '' then
      v_version := v_version + 1; v_saved := v_saved + 1;
      insert into public.deal_design_files (deal_id, file_url, storage_path, file_name, file_type, file_size_bytes, version_number, category, comment)
        values (m.deal_id, f->>'url', f->>'storage_path', left(f->>'name', 200), nullif(f->>'type', ''), nullif(f->>'size', '')::bigint, v_version, 'mail_in',
          case when m.party = 'client' then '顧客' else '工場' end || 'からのメールに添付');
    end if;
  end loop;
  select string_agg(left(x->>'name', 120), '、') into v_failed from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) x where not coalesce((x->>'saved')::boolean, false);
  update public.inbound_mails set attachments = (select coalesce(jsonb_agg(jsonb_build_object('name', x->>'name', 'type', x->>'type', 'size', x->'size', 'saved', coalesce((x->>'saved')::boolean, false))), '[]'::jsonb) from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) x)
    where id = m.id;
  if v_failed is not null and m.communication_id is not null then
    update public.deal_communications set body = body || E'\n\n（添付を保存できませんでした: ' || v_failed || '。相手に送り直しを頼んでください）', updated_at = now() where id = m.communication_id;
  end if;
  return jsonb_build_object('success', true, 'already', false, 'saved', v_saved);
end $$;

revoke all on function public.record_inbound_mail(text, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.add_inbound_mail_files(text, jsonb) from public, anon, authenticated;
grant execute on function public.record_inbound_mail(text, uuid, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.add_inbound_mail_files(text, jsonb) to service_role;
