-- 再設計 工程9: 検収（到着 → 顧客へ確認を依頼 → 顧客が「受領しました」→ 納品書を送って完了）と、同じ内容での次回オーダー（リピート）。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。
-- Rollback: drop function create_deal_receipt(uuid,date), mark_deal_receipt_sent(uuid,text), staff_decide_deal_receipt(uuid,text), deal_receipt_by_token(text),
--           confirm_deal_receipt(text,text,text), deal_receipt_finish(uuid,text,uuid,text,text), repeat_project_v1(uuid,uuid); drop table deal_receipts;

create table if not exists public.deal_receipts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  seq integer not null,
  delivery_note_number text not null unique,   -- 納品書番号（{案件番号}-D{連番}）
  token text not null unique,
  status text not null default 'sent' check (status in ('sent', 'received', 'cancelled')),
  arrived_on date not null,                    -- 到着日
  snapshot jsonb not null,                     -- 納品した内容（商品・数量・発行元・追跡番号）。金額・原価は含めない
  contact_name text,
  contact_email text,
  send_status text check (send_status is null or send_status in ('accepted', 'rejected', 'unknown')),
  sent_at timestamptz,
  received_at timestamptz,
  received_via text check (received_via is null or received_via in ('link', 'staff')),
  received_by uuid references public.profiles(id) on delete set null,
  receive_ip text,
  receive_user_agent text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (deal_id, seq)
);
create unique index if not exists deal_receipts_one_live on public.deal_receipts (deal_id) where status in ('sent', 'received');
alter table public.deal_receipts enable row level security;
drop policy if exists staff_read on public.deal_receipts;
create policy staff_read on public.deal_receipts for select to authenticated using (public.is_staff());
revoke all on public.deal_receipts from anon, authenticated;
grant select on public.deal_receipts to authenticated; -- 書き込みは下の関数だけが行う

-- 到着を記録し、顧客へ受領の確認を依頼する（未回答の前の依頼は取り消す）
create or replace function public.create_deal_receipt(p_deal_id uuid, p_arrived_on date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; s public.deal_shipments; i public.issuer_companies; c record; v_lines jsonb; v_seq integer; v_no text; v_token text; v_id uuid; v_snapshot jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_arrived_on is null then raise exception '到着日を選んでください'; end if;
  if p_arrived_on > (now() at time zone 'Asia/Tokyo')::date then raise exception '到着日に未来の日付は選べません'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  select * into s from public.deal_shipments where deal_id = d.id;
  if s.shipped_on is null then raise exception '先に発送完了を記録してください'; end if;
  if p_arrived_on < s.shipped_on then raise exception '到着日は発送日以降の日付にしてください'; end if;
  if exists (select 1 from public.deal_receipts where deal_id = d.id and status = 'received') then raise exception 'この案件は受領済みです'; end if;
  -- 納品書の発行元は、請求書と同じ会社（請求書が無い従来の案件は既定の会社）
  select ic.* into i from public.issuer_companies ic
    where ic.id = coalesce((select nullif(a.snapshot->'issuer'->>'id', '')::uuid from public.order_agreements a where a.deal_id = d.id and a.status = 'agreed' limit 1),
                           (select id from public.issuer_companies where is_default and archived_at is null));
  if not found then raise exception '発行元の会社が登録されていません'; end if;
  select jsonb_agg(jsonb_build_object('name', coalesce(p.description, '商品'), 'quantity', q.quantity) order by p.sort_order nulls last, p.product_no, q.quantity) into v_lines
    from public.deal_quotes q
    left join public.deal_product_variants v on v.id = q.variant_id
    left join public.deal_products p on p.id = v.product_id
    where q.deal_id = d.id and q.status = 'approved' and q.quantity > 0;
  if v_lines is null then raise exception '承認済みのお見積がありません'; end if;
  select cc.name, cc.email into c from public.client_contacts cc
    where cc.client_id = d.client_id and (cc.id = d.contact_id or d.contact_id is null)
    order by (cc.id = d.contact_id) desc nulls last, cc.is_primary desc, cc.created_at limit 1;
  update public.deal_receipts set status = 'cancelled' where deal_id = d.id and status = 'sent';
  select coalesce(max(seq), 0) + 1 into v_seq from public.deal_receipts where deal_id = d.id;
  v_no := coalesce(d.deal_code, 'BAO') || '-D' || v_seq;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_snapshot := jsonb_build_object('delivery_note_number', v_no, 'arrived_on', p_arrived_on, 'shipped_on', s.shipped_on,
    'deal_name', d.deal_name, 'deal_code', d.deal_code, 'client_name', d.client_name_text, 'brand', d.brand_text, 'lines', v_lines,
    'ship_to', jsonb_build_object('name', s.ship_to_name, 'postal_code', s.ship_to_postal_code, 'address', s.ship_to_address),
    'carton_count', s.carton_count, 'carrier', s.carrier, 'tracking_number', s.tracking_number,
    'issuer', jsonb_build_object('id', i.id, 'name', i.name, 'postal_code', i.postal_code, 'address', i.address, 'phone', i.phone, 'email', i.email, 'registration_number', i.registration_number));
  insert into public.deal_receipts (deal_id, seq, delivery_note_number, token, arrived_on, snapshot, contact_name, contact_email, created_by, expires_at)
    values (d.id, v_seq, v_no, v_token, p_arrived_on, v_snapshot, c.name, nullif(btrim(c.email), ''), auth.uid(), now() + interval '60 days')
    returning id into v_id;
  update public.deals set process_stage = greatest(process_stage, 9), waiting_on = 'client', last_activity_at = now() where id = d.id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status', '到着を記録（' || p_arrived_on || '）。顧客へ受領の確認を依頼');
  return jsonb_build_object('success', true, 'id', v_id, 'token', v_token, 'contactName', c.name, 'contactEmail', nullif(btrim(c.email), ''), 'snapshot', v_snapshot);
end $$;

create or replace function public.mark_deal_receipt_sent(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_status not in ('accepted', 'rejected', 'unknown') then raise exception '送信結果が不正です'; end if;
  update public.deal_receipts set send_status = p_status, sent_at = now() where id = p_id;
  if not found then raise exception '受領の確認依頼が見つかりません'; end if;
  return jsonb_build_object('success', true);
end $$;

-- 受領の共通処理（履歴とお知らせを残し、案件を完了にする）
create or replace function public.deal_receipt_finish(p_id uuid, p_via text, p_by uuid, p_ip text, p_ua text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.deal_receipts; d public.deals;
begin
  select * into r from public.deal_receipts where id = p_id for update;
  select * into d from public.deals where id = r.deal_id for update;
  update public.deal_receipts set status = 'received', received_at = now(), received_via = p_via, received_by = p_by, receive_ip = left(p_ip, 100), receive_user_agent = left(p_ua, 400) where id = r.id;
  update public.deals set process_stage = greatest(process_stage, 9), waiting_on = 'none', last_activity_at = now() where id = d.id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, p_by, 'status',
      case when p_via = 'link' then '顧客が受領を確認しました（メールのリンクから）。' else '受領済みとして記録しました（営業が記録）。' end || '納品書 ' || r.delivery_note_number || '。案件完了');
  if p_via = 'link' and d.sales_user_id is not null then
    insert into public.notifications (user_id, deal_id, type, status, content)
      values (d.sales_user_id, d.id, 'dashboard', 'pending', coalesce(d.client_name_text, '顧客') || ' が「' || coalesce(d.deal_name, d.deal_code) || '」の受領を確認しました。案件完了です。');
  end if;
end $$;

-- 電話などで受領の連絡をもらったときの記録と、依頼の取り消し
create or replace function public.staff_decide_deal_receipt(p_deal_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; r public.deal_receipts;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_decision not in ('received', 'cancel') then raise exception '操作が不正です'; end if;
  perform 1 from public.deals where id = p_deal_id for update;
  select id into v_id from public.deal_receipts where deal_id = p_deal_id and status = 'sent' for update;
  if v_id is null then raise exception '返事待ちの確認依頼がありません'; end if;
  if p_decision = 'cancel' then
    update public.deal_receipts set status = 'cancelled' where id = v_id;
    update public.deals set waiting_on = 'us', last_activity_at = now() where id = p_deal_id;
    return jsonb_build_object('success', true);
  end if;
  perform public.deal_receipt_finish(v_id, 'staff', auth.uid(), null, null);
  select * into r from public.deal_receipts where id = v_id;
  return jsonb_build_object('success', true, 'id', r.id, 'snapshot', r.snapshot, 'contactName', r.contact_name, 'contactEmail', r.contact_email);
end $$;

-- ここから下の2つは、ログインしていない顧客がリンクから使う
create or replace function public.deal_receipt_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.deal_receipts; i public.issuer_companies;
begin
  select * into r from public.deal_receipts where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then return jsonb_build_object('found', false); end if;
  select * into i from public.issuer_companies where id = nullif(r.snapshot->'issuer'->>'id', '')::uuid;
  return jsonb_build_object('found', true, 'status', case when r.status = 'sent' and r.expires_at <= now() then 'expired' else r.status end,
    'snapshot', r.snapshot, 'receivedAt', r.received_at, 'logo', i.logo_data, 'stamp', i.stamp_data);
end $$;

create or replace function public.confirm_deal_receipt(p_token text, p_ip text default null, p_ua text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.deal_receipts; d public.deals; v_email text;
begin
  select * into r from public.deal_receipts where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then raise exception 'このページは見つかりません'; end if;
  perform 1 from public.deals where id = r.deal_id for update;
  select * into r from public.deal_receipts where id = r.id for update;
  if r.status = 'received' then return jsonb_build_object('success', true, 'already', true); end if;
  if r.status <> 'sent' then raise exception 'この確認依頼は取り消されました。担当者から届いた新しいメールをご確認ください'; end if;
  if r.expires_at <= now() then raise exception 'このページは期限が切れました。担当者へご連絡ください'; end if;
  perform public.deal_receipt_finish(r.id, 'link', null, p_ip, p_ua);
  select * into d from public.deals where id = r.deal_id;
  select email into v_email from public.profiles where id = d.sales_user_id;
  -- notify* などはサーバー側で、納品書の送付と営業へのお知らせに使う（顧客の画面には返さない）
  return jsonb_build_object('success', true, 'already', false, 'notifyEmail', v_email, 'notifyDealId', d.id, 'notifyDealName', coalesce(d.deal_name, d.deal_code),
    'notifyClientName', d.client_name_text, 'customerEmail', r.contact_email, 'customerName', r.contact_name, 'snapshot', r.snapshot);
end $$;

-- リピート: 同じ取引先・同じ商品（仕様と数量）で新しい案件をつくる。価格・工場の回答・進み具合は引き継がない。
create or replace function public.repeat_project_v1(p_request_id uuid, p_deal_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare d public.deals; v_result jsonb; v_new uuid; p public.deal_products; v public.deal_product_variants; v_product uuid; v_variant uuid;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into d from public.deals where id = p_deal_id;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.client_id is null then raise exception '取引先が登録されていない案件はリピートできません'; end if;
  v_result := public.create_project_v1(p_request_id, jsonb_build_object('client_id', d.client_id, 'contact_id', d.contact_id, 'brand_id', d.brand_id, 'sales_user_id', d.sales_user_id,
    'deal_name', left(coalesce(d.deal_name, d.deal_code, '案件') || '（リピート）', 200)));
  v_new := (v_result->>'dealId')::uuid;
  -- 同じ要求の2回目（通信の再送など）は、もう商品を写してあるので何もしない
  if exists (select 1 from public.deal_products where deal_id = v_new) then return v_result; end if;
  for p in select * from public.deal_products where deal_id = d.id order by sort_order nulls last, product_no loop
    v_product := gen_random_uuid();
    insert into public.deal_products select (jsonb_populate_record(null::public.deal_products,
      to_jsonb(p) || jsonb_build_object('id', v_product, 'deal_id', v_new, 'is_selected', false, 'production_days', null, 'created_at', now(), 'updated_at', now()))).*;
    for v in select * from public.deal_product_variants where product_id = p.id order by variant_order, created_at loop
      v_variant := gen_random_uuid();
      insert into public.deal_product_variants select (jsonb_populate_record(null::public.deal_product_variants,
        to_jsonb(v) || jsonb_build_object('id', v_variant, 'product_id', v_product, 'is_selected', false, 'created_at', now(), 'updated_at', now()))).*;
      insert into public.deal_quotes (deal_id, variant_id, quantity, status, version)
        select v_new, v_variant, x.quantity, 'drafting', 1 from (select distinct quantity from public.deal_quotes where variant_id = v.id and deal_id = d.id and quantity > 0) x order by x.quantity;
    end loop;
  end loop;
  update public.deals set process_stage = greatest(process_stage, 2), last_activity_at = now() where id = v_new;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    select v_new, n.master_status, n.master_status, n.simple_status, n.simple_status, auth.uid(), 'status', '「' || coalesce(d.deal_name, d.deal_code) || '」（' || d.deal_code || '）の内容を引き継いで作成' from public.deals n where n.id = v_new;
  return v_result;
end $$;

revoke all on function public.deal_receipt_finish(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_deal_receipt(uuid, date) from public, anon;
revoke all on function public.mark_deal_receipt_sent(uuid, text) from public, anon;
revoke all on function public.staff_decide_deal_receipt(uuid, text) from public, anon;
revoke all on function public.repeat_project_v1(uuid, uuid) from public, anon;
revoke all on function public.deal_receipt_by_token(text) from public;
revoke all on function public.confirm_deal_receipt(text, text, text) from public;
grant execute on function public.create_deal_receipt(uuid, date) to authenticated;
grant execute on function public.mark_deal_receipt_sent(uuid, text) to authenticated;
grant execute on function public.staff_decide_deal_receipt(uuid, text) to authenticated;
grant execute on function public.repeat_project_v1(uuid, uuid) to authenticated;
grant execute on function public.deal_receipt_by_token(text) to anon, authenticated;
grant execute on function public.confirm_deal_receipt(text, text, text) to anon, authenticated;
