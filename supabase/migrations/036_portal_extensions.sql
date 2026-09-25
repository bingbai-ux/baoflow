-- ============================================================================
-- 036: ポータル拡張 (Sprint 13)
--   - profiles.factory_id + 工場アカウント招待 (claim を factory 対応に)
--   - portal_my_deals: クライアントに見せる案件進捗 (限定フィールドのみ)
--   - portal_factory_rfqs: 工場に見せる自社宛 RFQ 一覧 (回答フォームトークン付き)
-- ============================================================================

alter table public.profiles add column if not exists factory_id uuid references public.factories(id) on delete set null;

create or replace function public.my_factory_id()
returns uuid
language sql security definer set search_path = public stable
as $$ select factory_id from public.profiles where id = auth.uid() $$;

-- claim_account_invite を factory 対応に更新
create or replace function public.claim_account_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.external_forms;
  v_role text;
  v_client uuid;
  v_partner uuid;
  v_factory uuid;
  v_email text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'ログインしてください');
  end if;

  select * into v_form from public.external_forms where token = p_token for update;
  if not found or v_form.form_type <> 'account_invite' then
    return jsonb_build_object('success', false, 'error', '招待リンクが見つかりません');
  end if;
  if v_form.status = 'submitted' then
    return jsonb_build_object('success', false, 'error', 'この招待は既に使用されています');
  end if;
  if v_form.status = 'cancelled' or v_form.cancelled_at is not null then
    return jsonb_build_object('success', false, 'error', 'この招待は無効化されました');
  end if;
  if v_form.expires_at is not null and v_form.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'この招待は有効期限が切れています');
  end if;

  v_role := v_form.context->>'portal_role';
  if v_role not in ('client', 'logistics', 'factory') then
    return jsonb_build_object('success', false, 'error', '招待の種別が不正です');
  end if;
  v_client := nullif(v_form.context->>'client_id', '')::uuid;
  v_partner := nullif(v_form.context->>'partner_id', '')::uuid;
  v_factory := nullif(v_form.context->>'factory_id', '')::uuid;

  if (select role::text from public.profiles where id = auth.uid()) in ('admin','sales') then
    return jsonb_build_object('success', false, 'error', 'スタッフアカウントではこの招待を使えません');
  end if;

  update public.profiles set
    role = v_role::user_role,
    client_id = v_client,
    logistics_partner_id = v_partner,
    factory_id = v_factory
  where id = auth.uid();

  select email into v_email from public.profiles where id = auth.uid();

  update public.external_forms set
    status = 'submitted',
    submitted_at = now(),
    submitted_by_email = v_email,
    related_id = auth.uid(),
    submission_data = jsonb_build_object('claimed_by', auth.uid())
  where id = v_form.id;

  return jsonb_build_object('success', true, 'portal_role', v_role);
end;
$$;

-- クライアント向け: 自社案件の進捗 (社内メモ・原価等は返さない)
create or replace function public.portal_my_deals()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'deal_code', d.deal_code,
    'deal_name', d.deal_name,
    'simple_status', d.simple_status,
    'desired_delivery_date', d.desired_delivery_date,
    'last_activity_at', d.last_activity_at
  ) order by d.last_activity_at desc), '[]'::jsonb)
  from public.deals d
  where d.client_id = public.my_client_id()
    and d.archived_at is null
$$;

revoke all on function public.portal_my_deals() from public;
grant execute on function public.portal_my_deals() to authenticated;

-- 工場向け: 自社宛 RFQ 一覧 (回答フォームのトークン付き。案件名は返さない)
create or replace function public.portal_factory_rfqs()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'invitation_id', i.id,
    'rfq_number', r.rfq_number,
    'response_deadline', r.response_deadline,
    'request_message', r.request_message,
    'invitation_sent_at', i.invitation_sent_at,
    'responded_at', i.responded_at,
    'form_token', f.token,
    'form_status', f.status,
    'product_count', coalesce(array_length(r.product_ids, 1), 0)
  ) order by i.created_at desc), '[]'::jsonb)
  from public.rfq_factory_invitations i
  join public.rfq_requests r on r.id = i.rfq_id
  left join public.external_forms f on f.id = i.external_form_id
  where i.factory_id = public.my_factory_id()
$$;

revoke all on function public.portal_factory_rfqs() from public;
grant execute on function public.portal_factory_rfqs() to authenticated;

-- 工場は自社の行を読める (ポータル表示用)
drop policy if exists "factory_read_own" on public.factories;
create policy "factory_read_own" on public.factories
  for select to authenticated using (id = public.my_factory_id());
