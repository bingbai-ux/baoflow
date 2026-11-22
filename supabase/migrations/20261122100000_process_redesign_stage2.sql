-- 再設計 工程2: 商品登録（クリック選択・数量複数・配送・サンプル・食品検査・並べ替え・コピー・削除）
-- 追加のみ。既存のテーブル・カラムは削除も改名もしない。
-- 種類・形状・ディテール（大/中/小分類）は既存の product_catalog を使う。
-- Rollback: drop function save_project_product_v1(uuid,jsonb), reorder_project_products(uuid,uuid[]), delete_project_product(uuid);
--           alter table deal_products drop column sort_order, shipping_mode, shipping_arranger, sample_required, food_inspection_required, category_note;
--           alter table deal_product_variants drop column size_mode, diameter_mm, capacity_text, size_note, material_note, print_note, accessories, accessories_note;
--           drop table product_option_items;

-- 素材・印刷の色数・付属品の選択肢（設定 > 商品マスターで編集する）
create table if not exists public.product_option_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('material', 'print_colors', 'accessory')),
  name text not null check (btrim(name) <> ''),
  sort integer not null default 500,
  created_at timestamptz not null default now()
);
create unique index if not exists product_option_items_kind_name_key on public.product_option_items (kind, lower(btrim(name)));
alter table public.product_option_items enable row level security;
drop policy if exists staff_full_access on public.product_option_items;
create policy staff_full_access on public.product_option_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
revoke all on public.product_option_items from anon;
grant select, insert, update, delete on public.product_option_items to authenticated;

insert into public.product_option_items (kind, name, sort) values
  ('material', 'クラフト紙', 10), ('material', '白クラフト紙', 20), ('material', 'コート紙', 30),
  ('material', 'PET', 40), ('material', 'PE', 50), ('material', 'PP', 60), ('material', 'OPP', 70),
  ('material', 'アルミ蒸着', 80), ('material', 'アルミ箔', 90), ('material', 'ブリキ', 100),
  ('material', 'ガラス', 110), ('material', '生分解素材（PLA）', 120),
  ('print_colors', '印刷なし（無地）', 10), ('print_colors', '1色', 20), ('print_colors', '2色', 30),
  ('print_colors', '3色', 40), ('print_colors', '4色（フルカラー）', 50), ('print_colors', '5色', 60), ('print_colors', '6色以上', 70),
  ('accessory', 'ジップ', 10), ('accessory', 'バルブ', 20), ('accessory', '窓', 30), ('accessory', 'ノッチ', 40),
  ('accessory', '持ち手', 50), ('accessory', 'スパウト', 60), ('accessory', '吊り下げ穴', 70), ('accessory', 'ティンタイ', 80)
on conflict do nothing;

alter table public.deal_products
  add column if not exists sort_order integer,
  add column if not exists shipping_mode text,
  add column if not exists shipping_arranger text,
  add column if not exists sample_required boolean not null default false,
  add column if not exists food_inspection_required boolean not null default false,
  add column if not exists category_note text;
alter table public.deal_product_variants
  add column if not exists size_mode text,
  add column if not exists diameter_mm numeric,
  add column if not exists capacity_text text,
  add column if not exists size_note text,
  add column if not exists material_note text,
  add column if not exists print_note text,
  add column if not exists accessories text[] not null default '{}',
  add column if not exists accessories_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deal_products_shipping_mode_check') then
    alter table public.deal_products add constraint deal_products_shipping_mode_check check (shipping_mode is null or shipping_mode in ('sea', 'air'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'deal_products_shipping_arranger_check') then
    alter table public.deal_products add constraint deal_products_shipping_arranger_check check (shipping_arranger is null or shipping_arranger in ('factory', 'partner'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'deal_product_variants_size_mode_check') then
    alter table public.deal_product_variants add constraint deal_product_variants_size_mode_check check (size_mode is null or size_mode in ('box', 'round', 'capacity', 'undecided'));
  end if;
end $$;
update public.deal_products set sort_order = product_no where sort_order is null;

-- 商品名を仕様から自動で組み立てる（画面の下書き表示も同じ並びにする: src/lib/process/product-name.ts）
create or replace function public.project_product_name(p jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare parts text[] := '{}'; v_size text; v_acc text; n text;
  num text := '^[0-9]+(\.[0-9]+)?$';
  w text := nullif(p->>'width_mm', ''); h text := nullif(p->>'height_mm', ''); d text := nullif(p->>'depth_mm', ''); dia text := nullif(p->>'diameter_mm', '');
begin
  parts := parts || coalesce(nullif(btrim(p->>'category_l3'), ''), nullif(btrim(p->>'category_l2'), ''), nullif(btrim(p->>'category_l1'), ''), nullif(btrim(p->>'category_note'), ''), '商品');
  if p->>'size_mode' = 'box' then
    v_size := concat_ws('×', case when w ~ num then 'W' || w end, case when h ~ num then 'H' || h end, case when d ~ num then 'D' || d end);
    if v_size <> '' then v_size := v_size || 'mm'; end if;
  elsif p->>'size_mode' = 'round' then
    v_size := concat_ws('×', case when dia ~ num then 'φ' || dia end, case when h ~ num then 'H' || h end);
    if v_size <> '' then v_size := v_size || 'mm'; end if;
  elsif p->>'size_mode' = 'capacity' then
    v_size := nullif(btrim(p->>'capacity_text'), '');
    if v_size is not null then v_size := v_size || '入り'; end if;
  end if;
  if coalesce(v_size, '') = '' then v_size := 'サイズ未定'; end if;
  parts := parts || v_size;
  n := coalesce(nullif(btrim(p->>'material'), ''), nullif(btrim(p->>'material_note'), ''));
  if n is not null then parts := parts || n; end if;
  n := coalesce(nullif(btrim(p->>'print_color_count'), ''), nullif(btrim(p->>'print_note'), ''));
  if n is not null then parts := parts || n; end if;
  if jsonb_typeof(p->'accessories') = 'array' and jsonb_array_length(p->'accessories') > 0 then
    select string_agg(btrim(x), '・') into v_acc from jsonb_array_elements_text(p->'accessories') x where btrim(x) <> '';
    if v_acc is not null then parts := parts || v_acc; end if;
  end if;
  return array_to_string(parts, ' / ');
end $$;

-- 商品の登録・更新（商品・仕様・数量をまとめて1回で保存。途中で失敗したら何も残さない）
create or replace function public.save_project_product_v1(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.wizard_requests; d public.deals; v_product uuid; v_variant uuid; v_no integer; v_sort integer; v_name text;
  v_qty integer[]; q integer; v_bad integer; v_result jsonb; v_acc text[];
  num text := '^[0-9]+(\.[0-9]+)?$';
  function_name constant text := 'project_product';
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception '保存要求が不正です'; end if;
  insert into public.wizard_requests(request_id, user_id, operation, payload)
    values (p_request_id, auth.uid(), function_name, p_payload) on conflict (request_id) do nothing;
  select * into r from public.wizard_requests where request_id = p_request_id for update;
  if not found or r.user_id is distinct from auth.uid() then raise exception '保存要求の所有者が異なります'; end if;
  if r.operation is distinct from function_name or r.payload is distinct from p_payload then raise exception '同じ保存要求で内容が変わっています。新しい要求で保存してください'; end if;
  if r.result is not null then return r.result; end if;

  select * into d from public.deals where id = nullif(p_payload->>'deal_id', '')::uuid for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件には登録できません'; end if;

  if p_payload->>'size_mode' is not null and p_payload->>'size_mode' not in ('box', 'round', 'capacity', 'undecided') then raise exception '大きさの決め方を選び直してください'; end if;
  if p_payload->>'shipping_mode' is not null and p_payload->>'shipping_mode' not in ('sea', 'air') then raise exception '配送方法を選び直してください'; end if;
  if p_payload->>'shipping_arranger' is not null and p_payload->>'shipping_arranger' not in ('factory', 'partner') then raise exception '配送の手配先を選び直してください'; end if;
  if exists (select 1 from unnest(array['width_mm', 'height_mm', 'depth_mm', 'diameter_mm']) k
             where nullif(p_payload->>k, '') is not null and (p_payload->>k !~ num or (p_payload->>k)::numeric <= 0 or (p_payload->>k)::numeric > 100000)) then
    raise exception '大きさは 0 より大きい数字（mm）で入力してください';
  end if;

  if jsonb_typeof(p_payload->'quantities') is distinct from 'array' or jsonb_array_length(p_payload->'quantities') = 0 then raise exception '見積を取りたい数量を1つ以上選んでください'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'quantities') x where jsonb_typeof(x) <> 'number' or x::text !~ '^[0-9]+$' or x::text::numeric < 1 or x::text::numeric > 100000000) then
    raise exception '数量は 1 以上の整数で入力してください';
  end if;
  select array_agg(distinct x::text::integer order by x::text::integer) into v_qty from jsonb_array_elements(p_payload->'quantities') x;
  if jsonb_typeof(p_payload->'accessories') = 'array' then
    select coalesce(array_agg(btrim(x)), '{}') into v_acc from jsonb_array_elements_text(p_payload->'accessories') x where btrim(x) <> '';
  else v_acc := '{}'; end if;

  v_name := public.project_product_name(p_payload);
  v_product := nullif(p_payload->>'product_id', '')::uuid;

  if v_product is null then
    select coalesce(max(product_no), 0) + 1, coalesce(max(sort_order), 0) + 1 into v_no, v_sort from public.deal_products where deal_id = d.id;
    insert into public.deal_products (deal_id, product_no, sort_order, description, category_l1, category_l2, category_l3, category_note,
        shipping_mode, shipping_arranger, sample_required, food_inspection_required, product_memo)
      values (d.id, v_no, v_sort, v_name, nullif(btrim(p_payload->>'category_l1'), ''), nullif(btrim(p_payload->>'category_l2'), ''), nullif(btrim(p_payload->>'category_l3'), ''),
        nullif(btrim(p_payload->>'category_note'), ''), p_payload->>'shipping_mode', p_payload->>'shipping_arranger',
        coalesce((p_payload->>'sample_required')::boolean, false), coalesce((p_payload->>'food_inspection_required')::boolean, false), nullif(btrim(p_payload->>'memo'), ''))
      returning id into v_product;
    insert into public.deal_product_variants (product_id, variant_label, variant_order) values (v_product, '標準', 0) returning id into v_variant;
  else
    perform 1 from public.deal_products where id = v_product and deal_id = d.id for update;
    if not found then raise exception '商品がこの案件に見つかりません'; end if;
    update public.deal_products set description = v_name, category_l1 = nullif(btrim(p_payload->>'category_l1'), ''), category_l2 = nullif(btrim(p_payload->>'category_l2'), ''),
        category_l3 = nullif(btrim(p_payload->>'category_l3'), ''), category_note = nullif(btrim(p_payload->>'category_note'), ''),
        shipping_mode = p_payload->>'shipping_mode', shipping_arranger = p_payload->>'shipping_arranger',
        sample_required = coalesce((p_payload->>'sample_required')::boolean, false), food_inspection_required = coalesce((p_payload->>'food_inspection_required')::boolean, false),
        product_memo = nullif(btrim(p_payload->>'memo'), ''), updated_at = now()
      where id = v_product;
    select id into v_variant from public.deal_product_variants where product_id = v_product order by variant_order, created_at limit 1;
    if v_variant is null then
      insert into public.deal_product_variants (product_id, variant_label, variant_order) values (v_product, '標準', 0) returning id into v_variant;
    end if;
  end if;

  update public.deal_product_variants set
      size_mode = p_payload->>'size_mode',
      width_mm = case when p_payload->>'size_mode' = 'box' then nullif(p_payload->>'width_mm', '')::numeric end,
      height_mm = case when p_payload->>'size_mode' in ('box', 'round') then nullif(p_payload->>'height_mm', '')::numeric end,
      depth_mm = case when p_payload->>'size_mode' = 'box' then nullif(p_payload->>'depth_mm', '')::numeric end,
      diameter_mm = case when p_payload->>'size_mode' = 'round' then nullif(p_payload->>'diameter_mm', '')::numeric end,
      capacity_text = case when p_payload->>'size_mode' = 'capacity' then nullif(btrim(p_payload->>'capacity_text'), '') end,
      size_note = nullif(btrim(p_payload->>'size_note'), ''),
      material = nullif(btrim(p_payload->>'material'), ''), material_note = nullif(btrim(p_payload->>'material_note'), ''),
      print_color_count = nullif(btrim(p_payload->>'print_color_count'), ''), print_note = nullif(btrim(p_payload->>'print_note'), ''),
      accessories = v_acc, accessories_note = nullif(btrim(p_payload->>'accessories_note'), ''), updated_at = now()
    where id = v_variant;

  -- 数量: 外す数量に工場の価格や見積の記録があるなら断る（黙って消さない）
  select quantity into v_bad from public.deal_quotes
    where variant_id = v_variant and (quantity is null or not (quantity = any (v_qty)))
      and (factory_unit_price_usd is not null or selling_price_jpy is not null or coalesce(status::text, 'drafting') <> 'drafting')
    order by quantity limit 1;
  if found then raise exception '数量 % には工場の価格や見積の記録があるため外せません', coalesce(v_bad::text, '（未入力）'); end if;
  delete from public.deal_quotes where variant_id = v_variant and (quantity is null or not (quantity = any (v_qty)));
  foreach q in array v_qty loop
    if not exists (select 1 from public.deal_quotes where variant_id = v_variant and quantity = q) then
      insert into public.deal_quotes (deal_id, variant_id, quantity, status) values (d.id, v_variant, q, 'drafting');
    end if;
  end loop;

  update public.deals set process_stage = greatest(process_stage, 2), last_activity_at = now() where id = d.id;

  v_result := jsonb_build_object('success', true, 'productId', v_product, 'variantId', v_variant, 'name', v_name);
  update public.wizard_requests set result = v_result where request_id = p_request_id;
  return v_result;
end $$;

-- 商品の並べ替え（渡された順に 1,2,3… を振る）
create or replace function public.reorder_project_products(p_deal_id uuid, p_ids uuid[])
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_ids is null or (select count(*) from public.deal_products where deal_id = p_deal_id) <> coalesce(array_length(p_ids, 1), 0)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.deal_products where id = x and deal_id = p_deal_id)) then
    raise exception '商品の一覧が変わっています。画面を読み直してから並べ替えてください';
  end if;
  update public.deal_products p set sort_order = o.ord, updated_at = now()
    from unnest(p_ids) with ordinality as o(id, ord) where p.id = o.id and p.sort_order is distinct from o.ord;
  return jsonb_build_object('success', true);
end $$;

-- 商品の削除（工場の価格や見積・サンプルの記録がある商品は断る）
create or replace function public.delete_project_product(p_product_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare p public.deal_products;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into p from public.deal_products where id = p_product_id for update;
  if not found then raise exception '商品が見つかりません'; end if;
  if exists (select 1 from public.deals where id = p.deal_id and archived_at is not null) then raise exception 'アーカイブ済み案件の商品は削除できません'; end if;
  if exists (select 1 from public.deal_quotes q join public.deal_product_variants v on v.id = q.variant_id
             where v.product_id = p.id and (q.factory_unit_price_usd is not null or q.selling_price_jpy is not null or coalesce(q.status::text, 'drafting') <> 'drafting')) then
    raise exception 'この商品には工場の価格や見積の記録があるため削除できません';
  end if;
  if exists (select 1 from public.sample_rounds where product_id = p.id) then raise exception 'この商品にはサンプルの記録があるため削除できません'; end if;
  delete from public.deal_products where id = p.id;
  return jsonb_build_object('success', true, 'dealId', p.deal_id);
end $$;

revoke all on function public.project_product_name(jsonb) from public, anon;
revoke all on function public.save_project_product_v1(uuid, jsonb) from public, anon;
revoke all on function public.reorder_project_products(uuid, uuid[]) from public, anon;
revoke all on function public.delete_project_product(uuid) from public, anon;
grant execute on function public.project_product_name(jsonb) to authenticated;
grant execute on function public.save_project_product_v1(uuid, jsonb) to authenticated;
grant execute on function public.reorder_project_products(uuid, uuid[]) to authenticated;
grant execute on function public.delete_project_product(uuid) to authenticated;
