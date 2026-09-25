-- ============================================================================
-- 033: 物流パートナー (発送業者 / ロジスティック会社) + 自己登録フォーム + ロール拡張
--
-- - logistics_partners: 発送業者 (shipping) と在庫保管会社 (warehouse) のマスター。
--   旧 logistics_agents (010, Phase 2 温存) には触らない。
-- - external_forms.form_type に 'shipping_self_registration' / 'logistics_self_registration'
--   を追加 (text 列のため DDL 不要、RPC 側で対応)
-- - user_role enum に 'logistics' を追加 (物流会社ログイン用)
-- ============================================================================

alter type user_role add value if not exists 'logistics';

create table if not exists public.logistics_partners (
  id uuid primary key default gen_random_uuid(),
  partner_kind text not null check (partner_kind in ('shipping', 'warehouse')),
  company_name text not null,
  name_cn text,
  contact_name text,
  contact_phone text,
  contact_email text,
  wechat text,
  address text,
  services text[] default '{}',
  coverage text,          -- 対応ルート/地域 (例: 中国→日本 海運/空輸)
  pricing_notes text,     -- 料金の目安
  payment_terms text,
  bank_info jsonb,
  notes text,
  is_active boolean not null default true,
  self_registered_at timestamptz,
  self_registration_form_id uuid references public.external_forms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_logistics_partners_kind on public.logistics_partners(partner_kind);

alter table public.logistics_partners enable row level security;
drop policy if exists "authenticated_full_access" on public.logistics_partners;
create policy "authenticated_full_access" on public.logistics_partners
  for all to authenticated using (true) with check (true);

drop trigger if exists update_logistics_partners_updated_at on public.logistics_partners;
create trigger update_logistics_partners_updated_at
  before update on public.logistics_partners
  for each row execute function update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 匿名送信 RPC (migration 032 と同方式: トークン必須の SECURITY DEFINER)
-- p_kind は form_type から決まる: shipping_self_registration → 'shipping',
-- logistics_self_registration → 'warehouse'
-- ----------------------------------------------------------------------------
create or replace function public.ext_submit_partner(
  p_token text,
  p_payload jsonb,
  p_ip text default null,
  p_ua text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.external_forms;
  v_kind text;
  v_partner_id uuid;
  v_services text[];
begin
  select * into v_form from public.external_forms where token = p_token for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'フォームが見つかりません');
  end if;
  if v_form.form_type = 'shipping_self_registration' then
    v_kind := 'shipping';
  elsif v_form.form_type = 'logistics_self_registration' then
    v_kind := 'warehouse';
  else
    return jsonb_build_object('success', false, 'error', 'フォーム種別が一致しません');
  end if;
  if v_form.status = 'submitted' then
    return jsonb_build_object('success', false, 'error', 'このフォームは既に送信されています');
  end if;
  if v_form.status = 'cancelled' or v_form.cancelled_at is not null then
    return jsonb_build_object('success', false, 'error', 'このフォームは無効化されました');
  end if;
  if v_form.expires_at is not null and v_form.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'このフォームは有効期限が切れています');
  end if;

  if coalesce(trim(p_payload->>'company_name'), '') = '' then
    return jsonb_build_object('success', false, 'error', '会社名は必須です / Company name is required');
  end if;

  select coalesce(array_agg(trim(x)), '{}'::text[])
  into v_services
  from jsonb_array_elements_text(coalesce(p_payload->'services', '[]'::jsonb)) x
  where trim(x) <> '';

  insert into public.logistics_partners (
    partner_kind, company_name, name_cn, contact_name, contact_phone,
    contact_email, wechat, address, services, coverage, pricing_notes,
    payment_terms, bank_info, notes,
    self_registered_at, self_registration_form_id
  ) values (
    v_kind,
    trim(p_payload->>'company_name'),
    nullif(trim(coalesce(p_payload->>'name_cn', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_name', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_phone', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_email', '')), ''),
    nullif(trim(coalesce(p_payload->>'wechat', '')), ''),
    nullif(trim(coalesce(p_payload->>'address', '')), ''),
    v_services,
    nullif(trim(coalesce(p_payload->>'coverage', '')), ''),
    nullif(trim(coalesce(p_payload->>'pricing_notes', '')), ''),
    nullif(trim(coalesce(p_payload->>'payment_terms', '')), ''),
    case when coalesce(trim(p_payload->>'bank_info_text'), '') <> ''
      then jsonb_build_object('raw', trim(p_payload->>'bank_info_text'))
      else null end,
    nullif(trim(coalesce(p_payload->>'notes', '')), ''),
    now(),
    v_form.id
  ) returning id into v_partner_id;

  update public.external_forms set
    status = 'submitted',
    submitted_at = now(),
    submitted_by_email = nullif(trim(coalesce(p_payload->>'contact_email', '')), ''),
    submission_ip = p_ip,
    submission_user_agent = p_ua,
    related_id = v_partner_id,
    submission_data = p_payload
  where id = v_form.id;

  return jsonb_build_object('success', true, 'partner_id', v_partner_id);
end;
$$;

revoke all on function public.ext_submit_partner(text, jsonb, text, text) from public;
grant execute on function public.ext_submit_partner(text, jsonb, text, text) to anon, authenticated;
