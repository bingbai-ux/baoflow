-- 再設計 工程8: 発送（工場の完了報告 → 届け先と段ボールラベル → 発送依頼 → 梱包・ラベル貼付の写真 → 追跡番号つきで発送完了 → 顧客へ知らせる）。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。写真は既存の deal_design_files（category 'ship_done' / 'ship_pack' / 'ship_label'）に置く。
-- Rollback: drop function save_deal_shipment(uuid,text,jsonb); drop table deal_shipments;

create table if not exists public.deal_shipments (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  completion_received_at timestamptz,   -- 工場の完了報告（写真・動画）を受け取って確認した
  completion_note text,
  ship_to_name text, ship_to_postal_code text, ship_to_address text, ship_to_phone text,
  carton_count integer check (carton_count is null or carton_count between 1 and 999),
  inspection_days integer check (inspection_days is null or inspection_days between 0 and 365),  -- 食品検査にかかる日数（検査がある案件だけ）
  requested_at timestamptz,             -- 工場へ発送を依頼した
  packed_at timestamptz,                -- 梱包写真とラベル貼付写真を確認した
  carrier text, tracking_number text, tracking_url text,
  shipped_on date,                      -- 発送日。入っていれば発送完了
  shipped_recorded_at timestamptz,
  notify_status text check (notify_status is null or notify_status in ('accepted', 'rejected', 'unknown', 'skipped')),  -- 顧客への発送のお知らせメール
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deal_shipments enable row level security;
drop policy if exists staff_read on public.deal_shipments;
create policy staff_read on public.deal_shipments for select to authenticated using (public.is_staff());
revoke all on public.deal_shipments from anon, authenticated;
grant select on public.deal_shipments to authenticated; -- 書き込みは下の関数だけが行う

-- 発送の記録。p_action:
--   'completion'  {note}                                                 工場の完了報告を確認した（写真・動画が1件以上必要）
--   'destination' {name, postal_code, address, phone, carton_count, inspection_days}  届け先と箱数（発送完了までは直せる）
--   'request'     {}                                                     工場へ発送を依頼した（完了報告の確認と届け先が必要）
--   'packed'      {}                                                     梱包写真とラベル貼付写真を確認した（それぞれ1件以上必要）
--   'shipped'     {carrier, tracking_number, tracking_url, shipped_on}   発送完了 → 検収へ進む
--   'notified'    {status}                                               顧客へのお知らせメールの結果
create or replace function public.save_deal_shipment(p_deal_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; s public.deal_shipments; c record; v_food boolean; v_days integer; v_note text; v_wait text := 'us'; v_stage integer := 8; v_url text; v_day date;
  txt constant text[] := array['name', 'postal_code', 'address', 'phone'];
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  if not exists (select 1 from public.deal_productions where deal_id = d.id and finished_at is not null) then raise exception '先に製造完了を記録してください'; end if;
  p_payload := coalesce(p_payload, '{}'::jsonb);
  insert into public.deal_shipments (deal_id) values (d.id) on conflict (deal_id) do nothing;
  select * into s from public.deal_shipments where deal_id = d.id for update;
  v_food := exists (select 1 from public.deal_products where deal_id = d.id and food_inspection_required);

  if p_action = 'notified' then
    if s.shipped_on is null then raise exception '発送完了がまだ記録されていません'; end if;
    if coalesce(p_payload->>'status', '') not in ('accepted', 'rejected', 'unknown', 'skipped') then raise exception '送信結果が不正です'; end if;
    update public.deal_shipments set notify_status = p_payload->>'status', notified_at = now(), updated_at = now() where deal_id = d.id;
    return jsonb_build_object('success', true);
  end if;
  if s.shipped_on is not null then raise exception '発送完了を記録したあとは変更できません'; end if;

  if p_action = 'completion' then
    if s.completion_received_at is not null then return jsonb_build_object('success', true); end if;
    if not exists (select 1 from public.deal_design_files where deal_id = d.id and category = 'ship_done') then raise exception '先に完成品の写真・動画を登録してください'; end if;
    update public.deal_shipments set completion_received_at = now(), completion_note = nullif(left(btrim(coalesce(p_payload->>'note', '')), 2000), ''), updated_at = now() where deal_id = d.id;
    v_note := '工場の完了報告（完成品の写真・動画）を確認した';

  elsif p_action = 'destination' then
    if nullif(btrim(coalesce(p_payload->>'name', '')), '') is null or nullif(btrim(coalesce(p_payload->>'address', '')), '') is null then raise exception '届け先の名前と住所を入力してください'; end if;
    if coalesce(p_payload->>'carton_count', '') !~ '^\d{1,3}$' or (p_payload->>'carton_count')::integer < 1 then raise exception '箱数を入力してください'; end if;
    if v_food then
      if coalesce(p_payload->>'inspection_days', '') !~ '^\d{1,3}$' or (p_payload->>'inspection_days')::integer > 365 then raise exception '食品検査の日数を入力してください'; end if;
      v_days := (p_payload->>'inspection_days')::integer;
    end if;
    update public.deal_shipments set ship_to_name = btrim(p_payload->>'name'), ship_to_postal_code = nullif(btrim(coalesce(p_payload->>'postal_code', '')), ''), ship_to_address = btrim(p_payload->>'address'),
      ship_to_phone = nullif(btrim(coalesce(p_payload->>'phone', '')), ''), carton_count = (p_payload->>'carton_count')::integer, inspection_days = v_days, updated_at = now() where deal_id = d.id;
    update public.deals set last_activity_at = now() where id = d.id;
    return jsonb_build_object('success', true); -- 届け先の保存は履歴に残さない（依頼・発送の記録に内容が残る）

  elsif p_action = 'request' then
    if s.requested_at is not null then return jsonb_build_object('success', true); end if;
    if s.completion_received_at is null then raise exception '先に工場の完了報告を確認してください'; end if;
    if s.ship_to_address is null or s.carton_count is null then raise exception '先に届け先と箱数を保存してください'; end if;
    update public.deal_shipments set requested_at = now(), updated_at = now() where deal_id = d.id;
    v_note := '工場へ発送を依頼した（' || s.carton_count || '箱・届け先 ' || s.ship_to_name || '）'; v_wait := 'factory';

  elsif p_action = 'packed' then
    if s.packed_at is not null then return jsonb_build_object('success', true); end if;
    if s.requested_at is null then raise exception '先に工場へ発送を依頼してください'; end if;
    if not exists (select 1 from public.deal_design_files where deal_id = d.id and category = 'ship_pack') then raise exception '先に梱包の写真を登録してください'; end if;
    if not exists (select 1 from public.deal_design_files where deal_id = d.id and category = 'ship_label') then raise exception '先にラベルを貼った写真を登録してください'; end if;
    update public.deal_shipments set packed_at = now(), updated_at = now() where deal_id = d.id;
    v_note := '梱包とラベル貼付の写真を確認した'; v_wait := 'factory';

  elsif p_action = 'shipped' then
    if s.packed_at is null then raise exception '先に梱包とラベル貼付の写真を確認してください'; end if;
    if nullif(btrim(coalesce(p_payload->>'tracking_number', '')), '') is null then raise exception '追跡番号を入力してください'; end if;
    v_url := nullif(btrim(coalesce(p_payload->>'tracking_url', '')), '');
    if v_url is not null and v_url !~* '^https?://[^\s]+$' then raise exception '追跡URLは http:// か https:// で始まる形で入力してください'; end if;
    if coalesce(p_payload->>'shipped_on', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '発送日を選んでください'; end if;
    v_day := (p_payload->>'shipped_on')::date;
    if v_day > (now() at time zone 'Asia/Tokyo')::date then raise exception '発送日に未来の日付は選べません'; end if;
    update public.deal_shipments set carrier = nullif(left(btrim(coalesce(p_payload->>'carrier', '')), 100), ''), tracking_number = left(btrim(p_payload->>'tracking_number'), 100), tracking_url = left(v_url, 500),
      shipped_on = v_day, shipped_recorded_at = now(), updated_at = now() where deal_id = d.id;
    v_note := '発送完了（追跡番号 ' || left(btrim(p_payload->>'tracking_number'), 100) || '・発送日 ' || v_day || '）。検収へ進んだ'; v_wait := 'client'; v_stage := 9;
  else
    raise exception '操作が不正です';
  end if;

  update public.deals set process_stage = greatest(process_stage, v_stage), waiting_on = v_wait, last_activity_at = now() where id = d.id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status', v_note);
  if p_action = 'shipped' then
    -- 顧客への発送のお知らせに使う宛先（案件の担当者 → 取引先の主担当）
    select cc.name, cc.email into c from public.client_contacts cc
      where cc.client_id = d.client_id and (cc.id = d.contact_id or d.contact_id is null)
      order by (cc.id = d.contact_id) desc nulls last, cc.is_primary desc, cc.created_at limit 1;
    return jsonb_build_object('success', true, 'contactName', c.name, 'contactEmail', nullif(btrim(c.email), ''), 'clientName', d.client_name_text, 'dealName', coalesce(d.deal_name, d.deal_code));
  end if;
  return jsonb_build_object('success', true);
end $$;

revoke all on function public.save_deal_shipment(uuid, text, jsonb) from public, anon;
grant execute on function public.save_deal_shipment(uuid, text, jsonb) to authenticated;
