-- ============================================================================
-- 034: ロール別 RLS (Sprint 12 在庫保管サービスの前提)
--
-- これまで全テーブルが「authenticated なら全権」だったため、外部ログイン
-- (client / logistics) を発行すると社内データ (原価・粗利等) が REST API 経由で
-- 全て読めてしまう。スタッフのみ全権とし、外部ロールには必要最小限の
-- スコープ付きポリシーを個別に与える。
-- ============================================================================

-- ヘルパー (SECURITY DEFINER で profiles RLS を回避、再帰なし)
create or replace function public.current_app_role()
returns text
language sql security definer set search_path = public stable
as $$ select role::text from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql security definer set search_path = public stable
as $$ select coalesce((select role::text from public.profiles where id = auth.uid()) in ('admin','sales'), false) $$;

create or replace function public.is_logistics()
returns boolean
language sql security definer set search_path = public stable
as $$ select coalesce((select role::text from public.profiles where id = auth.uid()) = 'logistics', false) $$;

create or replace function public.my_client_id()
returns uuid
language sql security definer set search_path = public stable
as $$ select client_id from public.profiles where id = auth.uid() $$;

-- profiles に外部組織への紐付けを追加
alter table public.profiles add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.profiles add column if not exists logistics_partner_id uuid references public.logistics_partners(id) on delete set null;

-- 新規サインアップのデフォルトロールを最小権限 'client' に変更
-- (これまで 'sales' = スタッフ扱いだった。スタッフ追加は管理者が行う)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'client'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 全テーブルの authenticated_full_access → staff_full_access へ付け替え
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_policies
    where schemaname = 'public' and policyname = 'authenticated_full_access'
  loop
    execute format('drop policy "authenticated_full_access" on public.%I', t);
    execute format(
      'create policy "staff_full_access" on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      t
    );
  end loop;
end $$;

-- profiles: 自分の行は読める (middleware のロール判定・ポータル表示に必須)
drop policy if exists "read_own_profile" on public.profiles;
create policy "read_own_profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- clients: クライアントは自社の行を読める / ロジ会社は全クライアント名を読める
drop policy if exists "client_read_own" on public.clients;
create policy "client_read_own" on public.clients
  for select to authenticated using (id = public.my_client_id());
drop policy if exists "logistics_read" on public.clients;
create policy "logistics_read" on public.clients
  for select to authenticated using (public.is_logistics());

-- 在庫: ロジ会社は全権 / クライアントは自社分の読み取り
drop policy if exists "logistics_access" on public.inventory_items;
create policy "logistics_access" on public.inventory_items
  for all to authenticated using (public.is_logistics()) with check (public.is_logistics());
drop policy if exists "client_read_own" on public.inventory_items;
create policy "client_read_own" on public.inventory_items
  for select to authenticated using (client_id is not null and client_id = public.my_client_id());

drop policy if exists "logistics_access" on public.inventory_transactions;
create policy "logistics_access" on public.inventory_transactions
  for all to authenticated using (public.is_logistics()) with check (public.is_logistics());
drop policy if exists "client_read_own" on public.inventory_transactions;
create policy "client_read_own" on public.inventory_transactions
  for select to authenticated using (
    exists (
      select 1 from public.inventory_items i
      where i.id = inventory_transactions.item_id
        and i.client_id = public.my_client_id()
    )
  );
