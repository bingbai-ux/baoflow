-- ============================================
-- 1. profiles（ユーザープロフィール）
-- ============================================
-- Supabase Auth の auth.users と連携
-- id は auth.users.id と同じ UUID

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null default 'sales' check (role in ('admin', 'manager', 'sales')),
  display_name text not null,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 2. clients（顧客マスター）
-- ============================================

create table public.clients (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 3. factories（工場マスター）
-- ============================================

create table public.factories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  country text not null default '中国',
  city text,
  specialties text[],
  payment_terms text,
  contact_name text,
  contact_email text,
  contact_wechat text,
  rating numeric(2,1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 4. deals（案件）— メインテーブル
-- ============================================

-- ステータスenum（M01〜M25 の主要ステータス）
create type deal_status as enum (
  'draft',
  'quoting',
  'quoted',
  'spec_confirmed',
  'sample_requested',
  'sample_approved',
  'payment_pending',
  'deposit_paid',
  'in_production',
  'production_done',
  'inspection',
  'shipping',
  'customs',
  'delivered',
  'invoice_sent',
  'payment_received',
  'completed',
  'cancelled',
  'on_hold'
);

create table public.deals (
  id uuid default gen_random_uuid() primary key,
  deal_number text not null unique,
  client_id uuid references public.clients(id),
  factory_id uuid references public.factories(id),
  assignee_id uuid references public.profiles(id),
  status deal_status not null default 'draft',
  product_name text not null,
  material text,
  size text,
  quantity integer,
  unit_price_cny numeric(12,2),
  exchange_rate numeric(8,4),
  shipping_method text,
  estimated_delivery date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 5. deal_items（案件の明細行）
-- ============================================

create table public.deal_items (
  id uuid default gen_random_uuid() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  product_name text not null,
  specs text,
  quantity integer not null,
  unit_price_cny numeric(12,2),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================
-- 6. deal_status_history（ステータス変更履歴）
-- ============================================

create table public.deal_status_history (
  id uuid default gen_random_uuid() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  from_status deal_status,
  to_status deal_status not null,
  changed_by uuid references public.profiles(id),
  note text,
  changed_at timestamptz not null default now()
);

-- ============================================
-- 7. payments（支払い管理）
-- ============================================

create type payment_type as enum ('deposit', 'balance', 'full');
create type payment_method as enum ('wise', 'alibaba', 'bank_transfer', 'other');
create type payment_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.payments (
  id uuid default gen_random_uuid() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  payment_type payment_type not null,
  payment_method payment_method,
  amount_cny numeric(12,2),
  amount_jpy integer,
  exchange_rate numeric(8,4),
  fee_amount integer default 0,
  status payment_status not null default 'pending',
  paid_at timestamptz,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 8. インデックス
-- ============================================

create index idx_deals_client on public.deals(client_id);
create index idx_deals_factory on public.deals(factory_id);
create index idx_deals_assignee on public.deals(assignee_id);
create index idx_deals_status on public.deals(status);
create index idx_deal_items_deal on public.deal_items(deal_id);
create index idx_deal_status_history_deal on public.deal_status_history(deal_id);
create index idx_payments_deal on public.payments(deal_id);

-- ============================================
-- 9. RLS（Row Level Security）
-- ============================================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.factories enable row level security;
alter table public.deals enable row level security;
alter table public.deal_items enable row level security;
alter table public.deal_status_history enable row level security;
alter table public.payments enable row level security;

-- 認証済みユーザーは全データにアクセス可能（社内ツールなので）
create policy "Authenticated users can read all" on public.profiles for select to authenticated using (true);
create policy "Authenticated users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Authenticated users full access clients" on public.clients for all to authenticated using (true) with check (true);
create policy "Authenticated users full access factories" on public.factories for all to authenticated using (true) with check (true);
create policy "Authenticated users full access deals" on public.deals for all to authenticated using (true) with check (true);
create policy "Authenticated users full access deal_items" on public.deal_items for all to authenticated using (true) with check (true);
create policy "Authenticated users full access deal_status_history" on public.deal_status_history for all to authenticated using (true) with check (true);
create policy "Authenticated users full access payments" on public.payments for all to authenticated using (true) with check (true);

-- ============================================
-- 10. updated_at 自動更新トリガー
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles for each row execute function update_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function update_updated_at();
create trigger factories_updated_at before update on public.factories for each row execute function update_updated_at();
create trigger deals_updated_at before update on public.deals for each row execute function update_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function update_updated_at();

-- ============================================
-- 11. プロフィール自動作成（Auth連携）
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
