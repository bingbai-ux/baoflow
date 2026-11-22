-- 再設計 工程4: 価格を決めて顧客へ提示（お見積書）→ 顧客が承認 / 差し戻し。何回でも繰り返せ、全ての回を残す。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。
-- Rollback: drop function save_offer_prices_v1(uuid,jsonb), create_price_offer(uuid), mark_price_offer_sent(uuid,text), staff_decide_price_offer(uuid,text,jsonb,text),
--           price_offer_by_token(text), decide_price_offer(text,text,jsonb,text,text,text), price_offer_snapshot(uuid), price_offer_finish(uuid,text,text,jsonb,text,uuid,text,text);
--           drop table price_offers; alter table deal_products drop column production_days;

alter table public.deal_products add column if not exists production_days integer check (production_days is null or production_days between 1 and 999);

create table if not exists public.price_offers (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  round integer not null,                 -- 第何回のお見積か
  token text not null unique,
  status text not null default 'sent' check (status in ('sent', 'approved', 'returned', 'cancelled')),
  snapshot jsonb not null,                -- 提示した内容（原価・工場名は含めない）
  contact_name text,
  contact_email text,
  send_status text check (send_status is null or send_status in ('accepted', 'rejected', 'unknown')),
  sent_at timestamptz,
  decided_at timestamptz,
  decided_via text check (decided_via is null or decided_via in ('link', 'staff')),
  decided_by uuid references public.profiles(id) on delete set null,
  choices jsonb,                          -- 承認のとき: 商品ごとに選ばれた数量（見積行のID）
  return_comment text,                    -- 差し戻しのとき: 顧客の要望
  decide_ip text,
  decide_user_agent text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (deal_id, round)
);
create index if not exists price_offers_deal_idx on public.price_offers (deal_id, round desc);
create unique index if not exists price_offers_one_open on public.price_offers (deal_id) where status = 'sent';
alter table public.price_offers enable row level security;
drop policy if exists staff_read on public.price_offers;
create policy staff_read on public.price_offers for select to authenticated using (public.is_staff());
revoke all on public.price_offers from anon, authenticated;
grant select on public.price_offers to authenticated; -- 書き込みは下の関数だけが行う

-- 価格の保存。原価（工場単価・諸費用・送料）と提示単価から、原価率・総額・税込を計算して見積行に書く。
-- p_payload: { exchange_rate, tax_rate, lines: [{ quote_id, factory_unit_price_usd, fees_usd, freight_usd, selling_price_jpy }], production_days: { <商品ID>: 日数 } }
create or replace function public.save_offer_prices_v1(p_deal_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; l jsonb; q public.deal_quotes; v_fx numeric; v_tax numeric; v_unit numeric; v_fees numeric; v_freight numeric; v_sell numeric;
  v_total numeric; v_unit_jpy numeric; v_net numeric; k text; v_days integer; v_count integer := 0;
  num text := '^[0-9]+(\.[0-9]+)?$';
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'lines') is distinct from 'array' then raise exception '保存内容が不正です'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  if exists (select 1 from public.price_offers where deal_id = d.id and status = 'sent') then raise exception '顧客の返事待ちの間は価格を変更できません。先に提示を取り消してください'; end if;
  if coalesce(p_payload->>'exchange_rate', '') !~ num or coalesce(p_payload->>'tax_rate', '') !~ num then raise exception '為替と税率を入力してください'; end if;
  v_fx := (p_payload->>'exchange_rate')::numeric; v_tax := (p_payload->>'tax_rate')::numeric;
  if v_fx <= 0 or v_fx > 1000 then raise exception '為替は0より大きい値で入力してください'; end if;
  if v_tax > 100 then raise exception '税率は0〜100で入力してください'; end if;

  for l in select * from jsonb_array_elements(p_payload->'lines') loop
    select * into q from public.deal_quotes where id = nullif(l->>'quote_id', '')::uuid and deal_id = d.id for update;
    if not found then raise exception '見積の行が見つかりません'; end if;
    if q.pricing_snapshot is not null then raise exception '以前の画面で確定した価格は、ここでは変更できません'; end if;
    if q.quantity is null or q.quantity <= 0 then raise exception '数量が未登録の行があります'; end if;
    if coalesce(l->>'factory_unit_price_usd', '') !~ num or (l->>'factory_unit_price_usd')::numeric <= 0 then raise exception '工場単価を入力してください'; end if;
    if coalesce(l->>'fees_usd', '0') !~ num or coalesce(l->>'freight_usd', '0') !~ num then raise exception '諸費用と送料は0以上の数で入力してください'; end if;
    if coalesce(l->>'selling_price_jpy', '') !~ '^[0-9]+(\.[0-9]{1,2})?$' or (l->>'selling_price_jpy')::numeric <= 0 then raise exception '提示単価を入力してください（小数は2桁まで）'; end if;
    v_unit := (l->>'factory_unit_price_usd')::numeric; v_fees := coalesce(l->>'fees_usd', '0')::numeric; v_freight := coalesce(l->>'freight_usd', '0')::numeric;
    v_sell := (l->>'selling_price_jpy')::numeric;
    v_total := q.quantity * v_unit + v_fees + v_freight;
    v_unit_jpy := v_total / q.quantity * v_fx;
    if v_sell < v_unit_jpy then raise exception '提示単価が原価を下回っています（数量 %）', q.quantity; end if;
    v_net := ceil(v_sell * q.quantity);
    update public.deal_quotes set
      factory_unit_price_usd = v_unit, plate_fee_usd = v_fees, other_fees_usd = 0, pantone_color_fee_usd = 0,
      china_freight_usd = v_freight, domestic_china_freight_usd = 0, factory_calculated_freight_usd = 0,
      total_cost_usd = v_total, unit_cost_usd = v_total / q.quantity, exchange_rate = v_fx,
      cost_ratio = round(v_unit_jpy / v_sell, 6), selling_price_jpy = v_sell, selling_price_usd = round(v_sell / v_fx, 6),
      total_billing_jpy = v_net, total_billing_tax_jpy = ceil(v_net * (1 + v_tax / 100)),
      status = case when status in ('approved', 'presented') then status else 'drafting' end
    where id = q.id;
    v_count := v_count + 1;
  end loop;

  if jsonb_typeof(p_payload->'production_days') = 'object' then
    for k in select jsonb_object_keys(p_payload->'production_days') loop
      v_days := nullif(p_payload->'production_days'->>k, '')::integer;
      if v_days is not null and (v_days < 1 or v_days > 999) then raise exception '製造日数は1〜999で入力してください'; end if;
      update public.deal_products set production_days = v_days where id = k::uuid and deal_id = d.id;
    end loop;
  end if;
  update public.deals set process_stage = greatest(process_stage, 4), last_activity_at = now() where id = d.id;
  return jsonb_build_object('success', true, 'saved', v_count);
end $$;

-- 提示内容の写し（価格が入っている数量だけ。原価・工場名は含めない）
create or replace function public.price_offer_snapshot(p_deal_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'deal_name', d.deal_name, 'deal_code', d.deal_code, 'client_name', d.client_name_text, 'brand', d.brand_text,
    'tax_rate', (select default_tax_rate from public.system_settings limit 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', p.id, 'name', p.description, 'production_days', p.production_days,
        'shipping_mode', p.shipping_mode,
        'options', coalesce((select jsonb_agg(jsonb_build_object('quote_id', q.id, 'quantity', q.quantity, 'unit_jpy', q.selling_price_jpy,
                               'net_jpy', q.total_billing_jpy, 'tax_jpy', q.total_billing_tax_jpy) order by q.quantity)
                             from public.deal_quotes q join public.deal_product_variants v on v.id = q.variant_id
                             where v.product_id = p.id and q.deal_id = d.id and q.quantity > 0 and q.selling_price_jpy > 0 and q.total_billing_jpy > 0
                               and q.status <> 'rejected'), '[]'::jsonb)
      ) order by p.sort_order nulls last, p.product_no)
      from public.deal_products p where p.deal_id = d.id), '[]'::jsonb))
  from public.deals d where d.id = p_deal_id
$$;

-- お見積をつくる（返事待ちの前の回は取り消す）
create or replace function public.create_price_offer(p_deal_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; c record; v_snapshot jsonb; v_id uuid; v_token text; v_round integer;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件では提示できません'; end if;
  if exists (select 1 from public.price_offers where deal_id = d.id and status = 'approved') then raise exception 'このお見積は承認済みです'; end if;
  v_snapshot := public.price_offer_snapshot(d.id);
  if jsonb_array_length(v_snapshot->'items') = 0 then raise exception '先に商品を登録してください'; end if;
  if exists (select 1 from jsonb_array_elements(v_snapshot->'items') i where jsonb_array_length(i->'options') = 0) then raise exception '提示単価が未入力の商品があります'; end if;
  select cc.name, cc.email into c from public.client_contacts cc
    where cc.client_id = d.client_id and (cc.id = d.contact_id or d.contact_id is null)
    order by (cc.id = d.contact_id) desc nulls last, cc.is_primary desc, cc.created_at limit 1;
  update public.price_offers set status = 'cancelled' where deal_id = d.id and status = 'sent';
  select coalesce(max(round), 0) + 1 into v_round from public.price_offers where deal_id = d.id and status <> 'cancelled';
  -- 取り消した回の番号は使い回さない（同じ番号が2つできないよう、全体の最大も見る）
  select greatest(v_round, coalesce(max(round), 0) + 1) into v_round from public.price_offers where deal_id = d.id;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_snapshot := v_snapshot || jsonb_build_object('round', v_round);
  insert into public.price_offers (deal_id, round, token, snapshot, contact_name, contact_email, created_by, expires_at)
    values (d.id, v_round, v_token, v_snapshot, c.name, nullif(btrim(c.email), ''), auth.uid(), now() + interval '30 days')
    returning id into v_id;
  update public.deal_quotes q set status = 'presented'
    where q.deal_id = d.id and q.status in ('drafting', 'revising') and q.pricing_snapshot is null
      and q.id in (select (o->>'quote_id')::uuid from jsonb_array_elements(v_snapshot->'items') i, jsonb_array_elements(i->'options') o);
  update public.deals set process_stage = greatest(process_stage, 4), last_activity_at = now() where id = d.id;
  return jsonb_build_object('success', true, 'id', v_id, 'token', v_token, 'round', v_round, 'contactName', c.name, 'contactEmail', nullif(btrim(c.email), ''), 'snapshot', v_snapshot);
end $$;

create or replace function public.mark_price_offer_sent(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_status not in ('accepted', 'rejected', 'unknown') then raise exception '送信結果が不正です'; end if;
  update public.price_offers set send_status = p_status, sent_at = now() where id = p_id;
  if not found then raise exception 'お見積が見つかりません'; end if;
  if p_status = 'accepted' then
    update public.deals set waiting_on = 'client', last_activity_at = now() where id = (select deal_id from public.price_offers where id = p_id);
  end if;
  return jsonb_build_object('success', true);
end $$;

-- 承認 / 差し戻しの共通処理
create or replace function public.price_offer_finish(p_id uuid, p_decision text, p_via text, p_choices jsonb, p_comment text, p_by uuid, p_ip text, p_ua text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.price_offers; d public.deals; i jsonb; v_quote uuid; v_ids uuid[] := '{}'; v_all uuid[]; v_note text;
begin
  select * into o from public.price_offers where id = p_id for update;
  select * into d from public.deals where id = o.deal_id for update;
  select array_agg((x->>'quote_id')::uuid) into v_all from jsonb_array_elements(o.snapshot->'items') it, jsonb_array_elements(it->'options') x;

  if p_decision = 'approve' then
    -- 商品ごとに数量を1つ選ぶ（数量が1つだけの商品は選ばなくてよい）
    for i in select * from jsonb_array_elements(o.snapshot->'items') loop
      v_quote := nullif(p_choices->>(i->>'product_id'), '')::uuid;
      if v_quote is null and jsonb_array_length(i->'options') = 1 then v_quote := (i->'options'->0->>'quote_id')::uuid; end if;
      if v_quote is null or not exists (select 1 from jsonb_array_elements(i->'options') x where (x->>'quote_id')::uuid = v_quote) then
        raise exception '「%」の数量を選んでください', i->>'name';
      end if;
      v_ids := v_ids || v_quote;
    end loop;
    -- 提示したあとで価格が変わっていたら承認させない
    if exists (select 1 from jsonb_array_elements(o.snapshot->'items') it, jsonb_array_elements(it->'options') x
               left join public.deal_quotes q on q.id = (x->>'quote_id')::uuid and q.deal_id = d.id
               where (x->>'quote_id')::uuid = any(v_ids) and (q.id is null or q.selling_price_jpy is distinct from (x->>'unit_jpy')::numeric
                 or q.total_billing_jpy is distinct from (x->>'net_jpy')::numeric or q.quantity is distinct from (x->>'quantity')::integer)) then
      raise exception 'お見積の内容が更新されています。担当者から届く新しいお見積をご確認ください';
    end if;
    update public.deal_quotes set status = 'rejected' where deal_id = d.id and id = any(v_all) and not (id = any(v_ids)) and status in ('presented', 'approved') and pricing_snapshot is null;
    update public.deal_quotes set status = 'approved' where deal_id = d.id and id = any(v_ids);
    update public.price_offers set status = 'approved', decided_at = now(), decided_via = p_via, decided_by = p_by, choices = to_jsonb(v_ids),
      decide_ip = left(p_ip, 100), decide_user_agent = left(p_ua, 400) where id = o.id;
    update public.deals set process_stage = greatest(process_stage, 5), waiting_on = 'us', last_activity_at = now(),
      simple_status = case when simple_status = 'quoting' then 'quote_confirmed'::public.simple_status else simple_status end where id = d.id;
    v_note := '第' || o.round || '回お見積を' || case when p_via = 'link' then '顧客が承認しました（メールのリンクから）' else '承認済みとして記録しました（営業が記録）' end;
    insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
      values (d.id, d.master_status, d.master_status, d.simple_status,
        case when d.simple_status = 'quoting' then 'quote_confirmed'::public.simple_status else d.simple_status end, p_by, 'status', v_note);
  else
    if nullif(btrim(coalesce(p_comment, '')), '') is null then raise exception '変更したい内容を入力してください'; end if;
    update public.deal_quotes set status = 'revising' where deal_id = d.id and id = any(v_all) and status = 'presented' and pricing_snapshot is null;
    update public.price_offers set status = 'returned', decided_at = now(), decided_via = p_via, decided_by = p_by, return_comment = left(btrim(p_comment), 2000),
      decide_ip = left(p_ip, 100), decide_user_agent = left(p_ua, 400) where id = o.id;
    update public.deals set waiting_on = 'us', last_activity_at = now() where id = d.id;
    v_note := '第' || o.round || '回お見積が差し戻されました' || case when p_via = 'staff' then '（営業が記録）' else '' end || ': ' || left(btrim(p_comment), 300);
    insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
      values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, p_by, 'status', v_note);
  end if;
  if p_via = 'link' and d.sales_user_id is not null then
    insert into public.notifications (user_id, deal_id, type, status, content)
      values (d.sales_user_id, d.id, 'dashboard', 'pending', coalesce(d.client_name_text, '顧客') || ' が「' || coalesce(d.deal_name, d.deal_code) || '」の第' || o.round || '回お見積を'
        || case when p_decision = 'approve' then '承認しました。請求書を発行できます。' else '差し戻しました: ' || left(btrim(p_comment), 120) end);
  end if;
end $$;

-- 電話などで返事をもらったとき、営業が記録する
create or replace function public.staff_decide_price_offer(p_deal_id uuid, p_decision text, p_choices jsonb default '{}'::jsonb, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_decision not in ('approve', 'return', 'cancel') then raise exception '操作が不正です'; end if;
  perform 1 from public.deals where id = p_deal_id for update;
  select id into v_id from public.price_offers where deal_id = p_deal_id and status = 'sent' for update;
  if v_id is null then raise exception '返事待ちのお見積がありません'; end if;
  if p_decision = 'cancel' then
    update public.price_offers set status = 'cancelled' where id = v_id;
    update public.deal_quotes set status = 'drafting' where deal_id = p_deal_id and status = 'presented' and pricing_snapshot is null;
    update public.deals set waiting_on = 'us', last_activity_at = now() where id = p_deal_id;
  else
    perform public.price_offer_finish(v_id, p_decision, 'staff', coalesce(p_choices, '{}'::jsonb), p_comment, auth.uid(), null, null);
  end if;
  return jsonb_build_object('success', true);
end $$;

-- ここから下の2つは、ログインしていない顧客がリンクから使う
create or replace function public.price_offer_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare o public.price_offers;
begin
  select * into o from public.price_offers where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'status', case when o.status = 'sent' and o.expires_at <= now() then 'expired' else o.status end,
    'snapshot', o.snapshot, 'decidedAt', o.decided_at, 'choices', o.choices, 'createdAt', o.created_at, 'expiresAt', o.expires_at);
end $$;

create or replace function public.decide_price_offer(p_token text, p_decision text, p_choices jsonb default '{}'::jsonb, p_comment text default null, p_ip text default null, p_ua text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.price_offers; d public.deals; v_email text;
begin
  if p_decision not in ('approve', 'return') then raise exception '操作が不正です'; end if;
  select * into o from public.price_offers where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then raise exception 'このお見積のページは見つかりません'; end if;
  perform 1 from public.deals where id = o.deal_id for update;
  select * into o from public.price_offers where id = o.id for update;
  if o.status = 'approved' and p_decision = 'approve' then return jsonb_build_object('success', true, 'already', true); end if;
  if o.status = 'returned' and p_decision = 'return' then return jsonb_build_object('success', true, 'already', true); end if;
  if o.status <> 'sent' then raise exception 'このお見積は受付を終了しました。担当者から届いた新しいメールをご確認ください'; end if;
  if o.expires_at <= now() then raise exception 'このお見積は有効期限が切れました。担当者へご連絡ください'; end if;
  perform public.price_offer_finish(o.id, p_decision, 'link', coalesce(p_choices, '{}'::jsonb), p_comment, null, p_ip, p_ua);
  select * into d from public.deals where id = o.deal_id;
  select email into v_email from public.profiles where id = d.sales_user_id;
  -- notify* はサーバー側で営業へのお知らせメールに使う（顧客の画面には返さない）
  return jsonb_build_object('success', true, 'already', false, 'notifyEmail', v_email, 'notifyDealId', d.id,
    'notifyDealName', coalesce(d.deal_name, d.deal_code), 'notifyClientName', d.client_name_text, 'round', o.round);
end $$;

revoke all on function public.price_offer_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.price_offer_finish(uuid, text, text, jsonb, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.save_offer_prices_v1(uuid, jsonb) from public, anon;
revoke all on function public.create_price_offer(uuid) from public, anon;
revoke all on function public.mark_price_offer_sent(uuid, text) from public, anon;
revoke all on function public.staff_decide_price_offer(uuid, text, jsonb, text) from public, anon;
revoke all on function public.price_offer_by_token(text) from public;
revoke all on function public.decide_price_offer(text, text, jsonb, text, text, text) from public;
grant execute on function public.save_offer_prices_v1(uuid, jsonb) to authenticated;
grant execute on function public.create_price_offer(uuid) to authenticated;
grant execute on function public.mark_price_offer_sent(uuid, text) to authenticated;
grant execute on function public.staff_decide_price_offer(uuid, text, jsonb, text) to authenticated;
grant execute on function public.price_offer_by_token(text) to anon, authenticated;
grant execute on function public.decide_price_offer(text, text, jsonb, text, text, text) to anon, authenticated;
