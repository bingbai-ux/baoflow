-- ============================================================================
-- 035: 在庫保管サービス (Sprint 12)
--   - inbound_shipments: 入庫予定 (輸送追跡番号つき、着荷したら検収して入庫)
--   - shipment_requests: クライアントの発注 (出荷依頼) → 確認 → 出荷 → 納品
--   - inventory_items.low_stock_threshold: 在庫少アラートしきい値
--   - claim_account_invite: 招待リンクからのアカウント紐付け (client/logistics)
-- ============================================================================

create table if not exists public.inbound_shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_no text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  carrier_name text,
  tracking_number text,
  status text not null default 'in_transit' check (status in ('in_transit','received','cancelled')),
  eta_date date,
  shipped_on date,
  received_at timestamptz,
  received_by uuid references public.profiles(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.inbound_shipments(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  expected_quantity integer not null check (expected_quantity > 0),
  expected_cartons integer,
  received_quantity integer,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inbound_shipments_status on public.inbound_shipments(status);
create index if not exists idx_inbound_shipment_items_shipment on public.inbound_shipment_items(shipment_id);

create table if not exists public.shipment_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','confirmed','shipped','delivered','cancelled')),
  destination_name text,
  destination_address text,
  desired_date date,
  note text,
  requested_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  shipped_at timestamptz,
  shipped_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipment_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shipment_requests(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipment_requests_client on public.shipment_requests(client_id);
create index if not exists idx_shipment_requests_status on public.shipment_requests(status);
create index if not exists idx_shipment_request_items_request on public.shipment_request_items(request_id);

alter table public.inventory_items add column if not exists low_stock_threshold integer;

drop trigger if exists trg_inbound_shipments_updated on public.inbound_shipments;
create trigger trg_inbound_shipments_updated
  before update on public.inbound_shipments
  for each row execute function update_updated_at_column();
drop trigger if exists trg_shipment_requests_updated on public.shipment_requests;
create trigger trg_shipment_requests_updated
  before update on public.shipment_requests
  for each row execute function update_updated_at_column();

alter table public.inbound_shipments enable row level security;
alter table public.inbound_shipment_items enable row level security;
alter table public.shipment_requests enable row level security;
alter table public.shipment_request_items enable row level security;

create policy "staff_full_access" on public.inbound_shipments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff_full_access" on public.inbound_shipment_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff_full_access" on public.shipment_requests
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff_full_access" on public.shipment_request_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "logistics_access" on public.inbound_shipments
  for all to authenticated using (public.is_logistics()) with check (public.is_logistics());
create policy "logistics_access" on public.inbound_shipment_items
  for all to authenticated using (public.is_logistics()) with check (public.is_logistics());
create policy "logistics_access" on public.shipment_requests
  for all to authenticated using (public.is_logistics()) with check (public.is_logistics());
create policy "logistics_access" on public.shipment_request_items
  for all to authenticated using (public.is_logistics()) with check (public.is_logistics());

create policy "client_read_own" on public.inbound_shipments
  for select to authenticated using (client_id = public.my_client_id());
create policy "client_read_own" on public.inbound_shipment_items
  for select to authenticated using (
    exists (select 1 from public.inbound_shipments s
            where s.id = inbound_shipment_items.shipment_id
              and s.client_id = public.my_client_id())
  );
create policy "client_read_own" on public.shipment_requests
  for select to authenticated using (client_id = public.my_client_id());
create policy "client_read_own" on public.shipment_request_items
  for select to authenticated using (
    exists (select 1 from public.shipment_requests r
            where r.id = shipment_request_items.request_id
              and r.client_id = public.my_client_id())
  );

create policy "client_insert_own" on public.shipment_requests
  for insert to authenticated with check (
    client_id = public.my_client_id()
    and status = 'requested'
    and requested_by = auth.uid()
  );
create policy "client_insert_own" on public.shipment_request_items
  for insert to authenticated with check (
    exists (select 1 from public.shipment_requests r
            where r.id = shipment_request_items.request_id
              and r.client_id = public.my_client_id()
              and r.status = 'requested')
  );

-- アカウント招待の受け取り: ログイン済みユーザーが招待トークンを使うと
-- 自分の profiles に portal_role と組織 (client/partner) を紐付ける。
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
  if v_role not in ('client', 'logistics') then
    return jsonb_build_object('success', false, 'error', '招待の種別が不正です');
  end if;
  v_client := nullif(v_form.context->>'client_id', '')::uuid;
  v_partner := nullif(v_form.context->>'partner_id', '')::uuid;

  if (select role::text from public.profiles where id = auth.uid()) in ('admin','sales') then
    return jsonb_build_object('success', false, 'error', 'スタッフアカウントではこの招待を使えません');
  end if;

  update public.profiles set
    role = v_role::user_role,
    client_id = v_client,
    logistics_partner_id = v_partner
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

revoke all on function public.claim_account_invite(text) from public;
grant execute on function public.claim_account_invite(text) to authenticated;
