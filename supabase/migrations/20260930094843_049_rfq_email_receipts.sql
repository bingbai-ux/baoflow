-- Permanent at-most-once external attempt. Never retry an uncertain send after provider TTL.
-- Historical unsent rows may actually have a provider-accepted send with a lost DB result.
-- Do not silently treat them as never attempted. Audit/quarantine them explicitly first.
do $$ begin
 if exists(select 1 from public.rfq_factory_invitations where invitation_sent_at is null) then
  raise exception 'Review preexisting unsent invitations before enabling permanent email reservations';
 end if;
end $$;
create table public.rfq_email_receipts (
 invitation_id uuid primary key references public.rfq_factory_invitations(id),
 attempt_id uuid not null unique default gen_random_uuid(),
 actor_id uuid not null references public.profiles(id),
 status text not null default 'attempting' check(status in ('attempting','accepted','unknown','rejected')),
 provider_message_id text,
 started_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table public.rfq_email_receipts enable row level security;
revoke all on public.rfq_email_receipts from public,anon,authenticated;
grant select on public.rfq_email_receipts to authenticated;
create policy staff_read on public.rfq_email_receipts for select to authenticated using(public.is_staff());
create or replace function public.claim_rfq_email(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare inv public.rfq_factory_invitations; receipt public.rfq_email_receipts;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 select * into inv from public.rfq_factory_invitations where id=p_invitation_id for update;
 if not found then raise exception 'Invitation not found'; end if;
 select * into receipt from public.rfq_email_receipts where invitation_id=inv.id;
 if found then return jsonb_build_object('claimed',false,'status',receipt.status); end if;
 if inv.invitation_sent_at is not null then return jsonb_build_object('claimed',false,'status','accepted'); end if;
 if not exists(select 1 from public.rfq_requests r join public.deals d on d.id=r.deal_id where r.id=inv.rfq_id and r.status in ('open','partially_responded') and d.archived_at is null)
  or not exists(select 1 from public.external_forms f where f.id=inv.external_form_id and f.related_id=inv.id and f.form_type='rfq_response' and f.status='pending' and f.cancelled_at is null and f.expires_at>now()) then raise exception 'Invitation is no longer active'; end if;
 insert into public.rfq_email_receipts(invitation_id,actor_id) values(inv.id,auth.uid()) returning * into receipt;
 return jsonb_build_object('claimed',true,'status',receipt.status,'attemptId',receipt.attempt_id);
end $$;
create or replace function public.finish_rfq_email(p_invitation_id uuid,p_attempt_id uuid,p_status text,p_provider_id text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt public.rfq_email_receipts;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 select * into receipt from public.rfq_email_receipts where invitation_id=p_invitation_id for update;
 if not found or receipt.attempt_id is distinct from p_attempt_id or receipt.actor_id is distinct from auth.uid() then raise exception 'Email attempt mismatch'; end if;
 if p_status not in ('accepted','unknown','rejected') or (p_status='accepted' and nullif(trim(p_provider_id),'') is null) then raise exception 'Invalid email result'; end if;
 if receipt.status='accepted' then
  if p_status='accepted' and receipt.provider_message_id=p_provider_id then return; end if;
  raise exception 'Accepted receipt is immutable';
 end if;
 update public.rfq_email_receipts set status=p_status,provider_message_id=p_provider_id,finished_at=now() where invitation_id=p_invitation_id;
 if p_status='accepted' then update public.rfq_factory_invitations set invitation_sent_at=coalesce(invitation_sent_at,now()) where id=p_invitation_id; end if;
end $$;
revoke all on function public.claim_rfq_email(uuid),public.finish_rfq_email(uuid,uuid,text,text) from public,anon;
grant execute on function public.claim_rfq_email(uuid),public.finish_rfq_email(uuid,uuid,text,text) to authenticated;
-- Rollback: disable send UI/RPC; retain permanent receipts. Never clear attempts to retry.
