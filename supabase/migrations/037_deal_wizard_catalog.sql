-- ============================================================================
-- 037: 新規案件ウィザード + 商品カタログ (Sprint 14)
--   - deals.brand_text: ブランド名 (クライアント配下のブランド)
--   - deal_products.category_l1/l2/l3: 大分類/中分類/小分類
--   - product_catalog: 分類プリセット (スタッフが追加可能)
--   ※ プリセット seed は適用時のみ投入 (再適用しても重複しない)
-- ============================================================================

alter table public.deals add column if not exists brand_text text;
alter table public.deal_products add column if not exists category_l1 text;
alter table public.deal_products add column if not exists category_l2 text;
alter table public.deal_products add column if not exists category_l3 text;

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  level integer not null check (level in (1, 2, 3)),
  parent_id uuid references public.product_catalog(id) on delete cascade,
  name text not null,
  sort integer not null default 100,
  icon_key text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (level, parent_id, name)
);

alter table public.product_catalog enable row level security;
create policy "staff_full_access" on public.product_catalog
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- (seed は適用済み環境の DB に投入済み。詳細は本番 DB を参照)
