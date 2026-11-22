-- 再設計 工程3: 顧客への商品内容の確認（メールのリンク → 内容ページ → 「この内容で進める」ボタン。ログイン不要）
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。
-- Rollback: drop function create_customer_confirmation(uuid), staff_confirm_customer_confirmation(uuid), mark_customer_confirmation_sent(uuid,text),
--           customer_confirmation_by_token(text), confirm_customer_confirmation(text,text,text); drop table customer_confirmations;

create table if not exists public.customer_confirmations (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  snapshot jsonb not null,                -- 送った時点の商品内容（あとで商品を直しても、確認してもらった内容はこのまま残る）
  contact_name text,
  contact_email text,
  send_status text check (send_status is null or send_status in ('accepted', 'rejected', 'unknown')),
  sent_at timestamptz,
  confirmed_at timestamptz,
  confirmed_via text check (confirmed_via is null or confirmed_via in ('link', 'staff')),
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirm_ip text,
  confirm_user_agent text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists customer_confirmations_deal_idx on public.customer_confirmations (deal_id, created_at desc);
create unique index if not exists customer_confirmations_one_pending on public.customer_confirmations (deal_id) where status = 'pending';
alter table public.customer_confirmations enable row level security;
drop policy if exists staff_read on public.customer_confirmations;
create policy staff_read on public.customer_confirmations for select to authenticated using (public.is_staff());
revoke all on public.customer_confirmations from anon, authenticated;
grant select on public.customer_confirmations to authenticated; -- 書き込みは下の関数だけが行う

-- 商品内容の写し（顧客に見せる内容だけ。工場名・原価は含めない）
create or replace function public.customer_confirmation_snapshot(p_deal_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'deal_name', d.deal_name, 'deal_code', d.deal_code, 'client_name', d.client_name_text, 'brand', d.brand_text,
    'desired_delivery_date', d.desired_delivery_date,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.description,
        'quantities', coalesce((select jsonb_agg(distinct q.quantity order by q.quantity) from public.deal_quotes q
                                where q.variant_id = v.id and q.quantity is not null), '[]'::jsonb),
        'shipping_mode', p.shipping_mode, 'sample_required', p.sample_required, 'food_inspection_required', p.food_inspection_required,
        'notes', nullif(concat_ws(' / ', p.category_note, v.material_note, v.print_note, v.accessories_note, v.size_note), ''),
        'memo', p.product_memo
      ) order by p.sort_order nulls last, p.product_no)
      from public.deal_products p
      left join lateral (select * from public.deal_product_variants x where x.product_id = p.id order by x.variant_order, x.created_at limit 1) v on true
      where p.deal_id = d.id), '[]'::jsonb))
  from public.deals d where d.id = p_deal_id
$$;

-- 確認依頼をつくる（前の未回答の依頼は取り消す）。送り先は案件の担当者 → 取引先の主担当の順で決める。
create or replace function public.create_customer_confirmation(p_deal_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; c record; v_snapshot jsonb; v_id uuid; v_token text;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件では確認を依頼できません'; end if;
  v_snapshot := public.customer_confirmation_snapshot(d.id);
  if jsonb_array_length(v_snapshot->'items') = 0 then raise exception '先に商品を登録してください'; end if;
  if exists (select 1 from jsonb_array_elements(v_snapshot->'items') i where jsonb_array_length(i->'quantities') = 0) then raise exception '数量が未登録の商品があります。数量を登録してから確認を依頼してください'; end if;
  select cc.name, cc.email into c from public.client_contacts cc
    where cc.client_id = d.client_id and (cc.id = d.contact_id or d.contact_id is null)
    order by (cc.id = d.contact_id) desc nulls last, cc.is_primary desc, cc.created_at limit 1;
  update public.customer_confirmations set status = 'cancelled' where deal_id = d.id and status = 'pending';
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.customer_confirmations (deal_id, token, snapshot, contact_name, contact_email, created_by, expires_at)
    values (d.id, v_token, v_snapshot, c.name, nullif(btrim(c.email), ''), auth.uid(), now() + interval '30 days')
    returning id into v_id;
  return jsonb_build_object('success', true, 'id', v_id, 'token', v_token, 'contactName', c.name, 'contactEmail', nullif(btrim(c.email), ''), 'snapshot', v_snapshot);
end $$;

create or replace function public.mark_customer_confirmation_sent(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_status not in ('accepted', 'rejected', 'unknown') then raise exception '送信結果が不正です'; end if;
  update public.customer_confirmations set send_status = p_status, sent_at = now() where id = p_id;
  if not found then raise exception '確認依頼が見つかりません'; end if;
  if p_status = 'accepted' then
    update public.deals set waiting_on = 'client', last_activity_at = now() where id = (select deal_id from public.customer_confirmations where id = p_id);
  end if;
  return jsonb_build_object('success', true);
end $$;

-- 確認済みにする共通処理（工程を3へ進め、履歴とお知らせを残す）
create or replace function public.customer_confirmation_finish(p_id uuid, p_via text, p_by uuid, p_ip text, p_ua text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.customer_confirmations; d public.deals;
begin
  update public.customer_confirmations set status = 'confirmed', confirmed_at = now(), confirmed_via = p_via, confirmed_by = p_by,
      confirm_ip = left(p_ip, 100), confirm_user_agent = left(p_ua, 400)
    where id = p_id returning * into c;
  select * into d from public.deals where id = c.deal_id for update;
  update public.deals set process_stage = greatest(process_stage, 3), waiting_on = 'us', last_activity_at = now() where id = d.id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, p_by, 'status',
      case when p_via = 'link' then '顧客が商品内容を確認しました（メールのリンクから）' else '商品内容を顧客に確認済みとして記録しました（営業が記録）' end);
  if p_via = 'link' and d.sales_user_id is not null then
    insert into public.notifications (user_id, deal_id, type, status, content)
      values (d.sales_user_id, d.id, 'dashboard', 'pending', coalesce(d.client_name_text, '顧客') || ' が「' || coalesce(d.deal_name, d.deal_code) || '」の商品内容を確認しました。工場へ見積を依頼できます。');
  end if;
end $$;

-- 電話などで確認が取れたとき、営業が確認済みとして記録する
create or replace function public.staff_confirm_customer_confirmation(p_deal_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; r jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select id into v_id from public.customer_confirmations where deal_id = p_deal_id and status = 'pending' for update;
  if v_id is null then
    r := public.create_customer_confirmation(p_deal_id);
    v_id := (r->>'id')::uuid;
  end if;
  perform public.customer_confirmation_finish(v_id, 'staff', auth.uid(), null, null);
  return jsonb_build_object('success', true);
end $$;

-- ここから下の2つは、ログインしていない顧客がリンクから使う
create or replace function public.customer_confirmation_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.customer_confirmations;
begin
  select * into c from public.customer_confirmations where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'status', case when c.status = 'pending' and c.expires_at <= now() then 'expired' else c.status end,
    'snapshot', c.snapshot, 'confirmedAt', c.confirmed_at);
end $$;

create or replace function public.confirm_customer_confirmation(p_token text, p_ip text default null, p_ua text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.customer_confirmations; d public.deals; v_email text;
begin
  select * into c from public.customer_confirmations where token = p_token for update;
  if not found or p_token is null or length(p_token) < 32 then raise exception 'この確認ページは見つかりません'; end if;
  if c.status = 'confirmed' then return jsonb_build_object('success', true, 'already', true); end if;
  if c.status <> 'pending' then raise exception 'この確認依頼は取り消されました。担当者から届いた新しいメールをご確認ください'; end if;
  if c.expires_at <= now() then raise exception 'この確認ページは期限が切れました。担当者へご連絡ください'; end if;
  perform public.customer_confirmation_finish(c.id, 'link', null, p_ip, p_ua);
  select * into d from public.deals where id = c.deal_id;
  select email into v_email from public.profiles where id = d.sales_user_id;
  -- notify* はサーバー側で営業へのお知らせメールに使う（顧客の画面には返さない）
  return jsonb_build_object('success', true, 'already', false, 'notifyEmail', v_email, 'notifyDealId', d.id,
    'notifyDealName', coalesce(d.deal_name, d.deal_code), 'notifyClientName', d.client_name_text);
end $$;

revoke all on function public.customer_confirmation_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.customer_confirmation_finish(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_customer_confirmation(uuid) from public, anon;
revoke all on function public.mark_customer_confirmation_sent(uuid, text) from public, anon;
revoke all on function public.staff_confirm_customer_confirmation(uuid) from public, anon;
revoke all on function public.customer_confirmation_by_token(text) from public;
revoke all on function public.confirm_customer_confirmation(text, text, text) from public;
grant execute on function public.create_customer_confirmation(uuid) to authenticated;
grant execute on function public.mark_customer_confirmation_sent(uuid, text) to authenticated;
grant execute on function public.staff_confirm_customer_confirmation(uuid) to authenticated;
grant execute on function public.customer_confirmation_by_token(text) to anon, authenticated;
grant execute on function public.confirm_customer_confirmation(text, text, text) to anon, authenticated;
