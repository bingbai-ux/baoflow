-- 再設計 工程5: 請求書の発行 → 顧客がリンクから内容を確認して承認（日時と操作記録を残す）= 契約成立。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。
-- Rollback: drop function create_order_agreement(uuid,date,date), mark_order_agreement_sent(uuid,text), staff_decide_order_agreement(uuid,text),
--           order_agreement_by_token(text), agree_order_agreement(text,text,text), order_agreement_finish(uuid,text,uuid,text,text), order_agreement_issuer(); drop table order_agreements;

create table if not exists public.order_agreements (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  seq integer not null,                   -- この案件で何通目の請求書か
  invoice_number text not null unique,
  token text not null unique,
  status text not null default 'sent' check (status in ('sent', 'agreed', 'cancelled')),
  issue_date date not null,
  due_date date not null,
  snapshot jsonb not null,                -- 発行した内容（明細・合計・発行者・振込先）。原価・工場名は含めない
  contact_name text,
  contact_email text,
  send_status text check (send_status is null or send_status in ('accepted', 'rejected', 'unknown')),
  sent_at timestamptz,
  agreed_at timestamptz,
  agreed_via text check (agreed_via is null or agreed_via in ('link', 'staff')),
  agreed_by uuid references public.profiles(id) on delete set null,
  agree_ip text,
  agree_user_agent text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (deal_id, seq),
  check (due_date >= issue_date)
);
create index if not exists order_agreements_deal_idx on public.order_agreements (deal_id, seq desc);
create unique index if not exists order_agreements_one_live on public.order_agreements (deal_id) where status in ('sent', 'agreed');
alter table public.order_agreements enable row level security;
drop policy if exists staff_read on public.order_agreements;
create policy staff_read on public.order_agreements for select to authenticated using (public.is_staff());
revoke all on public.order_agreements from anon, authenticated;
grant select on public.order_agreements to authenticated; -- 書き込みは下の関数だけが行う

-- 発行者と振込先（システム設定から）。足りない項目は missing に入る。
create or replace function public.order_agreement_issuer()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.system_settings; c jsonb; b jsonb; e jsonb; v_missing text[] := '{}';
  t text;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into s from public.system_settings limit 1;
  c := coalesce(s.company_info, '{}'::jsonb);
  -- 振込先は配列。要素が文字列として入っている古い形にも対応し、既定（is_default）を優先する
  if s.bank_accounts is not null then
    foreach e in array s.bank_accounts loop
      if jsonb_typeof(e) = 'string' then e := (e #>> '{}')::jsonb; end if;
      if jsonb_typeof(e) = 'object' and (b is null or coalesce((e->>'is_default')::boolean, false)) then b := e; end if;
    end loop;
  end if;
  b := coalesce(b, '{}'::jsonb);
  if nullif(btrim(coalesce(c->>'name', '')), '') is null then v_missing := v_missing || '会社名'::text; end if;
  if nullif(btrim(coalesce(c->>'address', '')), '') is null then v_missing := v_missing || '住所'::text; end if;
  foreach t in array array['bank_name', 'branch_name', 'account_type', 'account_number', 'account_holder'] loop
    if nullif(btrim(coalesce(b->>t, '')), '') is null then
      v_missing := v_missing || (case t when 'bank_name' then '銀行名' when 'branch_name' then '支店名' when 'account_type' then '口座種別' when 'account_number' then '口座番号' else '口座名義' end);
    end if;
  end loop;
  return jsonb_build_object(
    'issuer', jsonb_build_object('name', btrim(coalesce(c->>'name', '')), 'address', btrim(coalesce(c->>'address', '')), 'phone', nullif(btrim(coalesce(c->>'phone', '')), ''),
      'email', nullif(btrim(coalesce(c->>'email', '')), ''), 'registration_number', nullif(btrim(coalesce(s.invoice_registration_number, '')), '')),
    'bank', jsonb_build_object('bank_name', b->>'bank_name', 'branch_name', b->>'branch_name', 'account_type', b->>'account_type', 'account_number', b->>'account_number', 'account_holder', b->>'account_holder'),
    'notes', nullif(btrim(coalesce(s.invoice_default_text, '')), ''), 'tax_rate', s.default_tax_rate, 'missing', to_jsonb(v_missing));
end $$;

-- 請求書をつくる（承認済みの見積が元。未承認のままの前の請求書は取り消す）
create or replace function public.create_order_agreement(p_deal_id uuid, p_issue_date date, p_due_date date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; c record; v_issuer jsonb; v_lines jsonb; v_sub numeric; v_tax_rate numeric; v_total numeric; v_snapshot jsonb;
  v_seq integer; v_no text; v_token text; v_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_issue_date is null or p_due_date is null then raise exception '発行日と振込期限を選んでください'; end if;
  if p_due_date < p_issue_date then raise exception '振込期限は発行日以降の日付にしてください'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件では発行できません'; end if;
  if exists (select 1 from public.order_agreements where deal_id = d.id and status = 'agreed') then raise exception 'この案件は契約成立済みです'; end if;
  v_issuer := public.order_agreement_issuer();
  if jsonb_array_length(v_issuer->'missing') > 0 then
    raise exception '設定に請求書の発行者情報が足りません: %', (select string_agg(x, '・') from jsonb_array_elements_text(v_issuer->'missing') x);
  end if;
  select jsonb_agg(jsonb_build_object('name', coalesce(p.description, '商品'), 'quantity', q.quantity, 'unit_jpy', q.selling_price_jpy, 'net_jpy', q.total_billing_jpy)
           order by p.sort_order nulls last, p.product_no, q.quantity), sum(q.total_billing_jpy)
    into v_lines, v_sub
    from public.deal_quotes q
    left join public.deal_product_variants v on v.id = q.variant_id
    left join public.deal_products p on p.id = v.product_id
    where q.deal_id = d.id and q.status = 'approved';
  if v_lines is null then raise exception '承認済みのお見積がありません'; end if;
  if exists (select 1 from public.deal_quotes q where q.deal_id = d.id and q.status = 'approved'
             and (q.quantity is null or q.quantity <= 0 or q.selling_price_jpy is null or q.selling_price_jpy <= 0 or q.total_billing_jpy is null or q.total_billing_jpy <= 0)) then
    raise exception '承認済みのお見積に金額が入っていません';
  end if;
  v_tax_rate := (v_issuer->>'tax_rate')::numeric;
  if v_tax_rate is null then raise exception '設定に消費税率がありません'; end if;
  -- 消費税は請求書全体で1回だけ端数処理する（切り上げ）
  v_total := ceil(v_sub * (1 + v_tax_rate / 100));
  select cc.name, cc.email into c from public.client_contacts cc
    where cc.client_id = d.client_id and (cc.id = d.contact_id or d.contact_id is null)
    order by (cc.id = d.contact_id) desc nulls last, cc.is_primary desc, cc.created_at limit 1;
  update public.order_agreements set status = 'cancelled' where deal_id = d.id and status = 'sent';
  select coalesce(max(seq), 0) + 1 into v_seq from public.order_agreements where deal_id = d.id;
  v_no := coalesce(d.deal_code, 'BAO') || '-I' || v_seq;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_snapshot := jsonb_build_object('invoice_number', v_no, 'issue_date', p_issue_date, 'due_date', p_due_date,
    'deal_name', d.deal_name, 'deal_code', d.deal_code, 'client_name', d.client_name_text, 'brand', d.brand_text,
    'lines', v_lines, 'subtotal_jpy', v_sub, 'tax_rate', v_tax_rate, 'tax_jpy', v_total - v_sub, 'total_jpy', v_total,
    'issuer', v_issuer->'issuer', 'bank', v_issuer->'bank', 'notes', v_issuer->'notes');
  insert into public.order_agreements (deal_id, seq, invoice_number, token, issue_date, due_date, snapshot, contact_name, contact_email, created_by, expires_at)
    values (d.id, v_seq, v_no, v_token, p_issue_date, p_due_date, v_snapshot, c.name, nullif(btrim(c.email), ''), auth.uid(), now() + interval '60 days')
    returning id into v_id;
  update public.deals set process_stage = greatest(process_stage, 5), last_activity_at = now() where id = d.id;
  return jsonb_build_object('success', true, 'id', v_id, 'token', v_token, 'invoiceNumber', v_no, 'contactName', c.name, 'contactEmail', nullif(btrim(c.email), ''), 'snapshot', v_snapshot);
end $$;

create or replace function public.mark_order_agreement_sent(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_status not in ('accepted', 'rejected', 'unknown') then raise exception '送信結果が不正です'; end if;
  update public.order_agreements set send_status = p_status, sent_at = now() where id = p_id;
  if not found then raise exception '請求書が見つかりません'; end if;
  if p_status = 'accepted' then
    update public.deals set waiting_on = 'client', last_activity_at = now() where id = (select deal_id from public.order_agreements where id = p_id);
  end if;
  return jsonb_build_object('success', true);
end $$;

-- 契約成立の共通処理（工程を6へ進め、履歴とお知らせを残す）
create or replace function public.order_agreement_finish(p_id uuid, p_via text, p_by uuid, p_ip text, p_ua text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.order_agreements; d public.deals;
begin
  select * into a from public.order_agreements where id = p_id for update;
  select * into d from public.deals where id = a.deal_id for update;
  -- 発行したあとで承認済みの金額が変わっていたら成立させない
  if (select coalesce(sum(q.total_billing_jpy), 0) from public.deal_quotes q where q.deal_id = d.id and q.status = 'approved') is distinct from (a.snapshot->>'subtotal_jpy')::numeric then
    raise exception '請求書の内容が更新されています。担当者から届く新しい請求書をご確認ください';
  end if;
  update public.order_agreements set status = 'agreed', agreed_at = now(), agreed_via = p_via, agreed_by = p_by,
    agree_ip = left(p_ip, 100), agree_user_agent = left(p_ua, 400) where id = a.id;
  update public.deals set process_stage = greatest(process_stage, 6), waiting_on = 'us', last_activity_at = now() where id = d.id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, p_by, 'status',
      '請求書 ' || a.invoice_number || ' を' || case when p_via = 'link' then '顧客が承認しました（契約成立・メールのリンクから）' else '承認済みとして記録しました（契約成立・営業が記録）' end);
  if p_via = 'link' and d.sales_user_id is not null then
    insert into public.notifications (user_id, deal_id, type, status, content)
      values (d.sales_user_id, d.id, 'dashboard', 'pending', coalesce(d.client_name_text, '顧客') || ' が「' || coalesce(d.deal_name, d.deal_code) || '」の請求書を承認しました（契約成立）。入稿に進めます。');
  end if;
end $$;

-- 電話などで承認をもらったときの記録と、発行の取り消し
create or replace function public.staff_decide_order_agreement(p_deal_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_decision not in ('agree', 'cancel') then raise exception '操作が不正です'; end if;
  perform 1 from public.deals where id = p_deal_id for update;
  select id into v_id from public.order_agreements where deal_id = p_deal_id and status = 'sent' for update;
  if v_id is null then raise exception '承認待ちの請求書がありません'; end if;
  if p_decision = 'cancel' then
    update public.order_agreements set status = 'cancelled' where id = v_id;
    update public.deals set waiting_on = 'us', last_activity_at = now() where id = p_deal_id;
  else
    perform public.order_agreement_finish(v_id, 'staff', auth.uid(), null, null);
  end if;
  return jsonb_build_object('success', true);
end $$;

-- ここから下の2つは、ログインしていない顧客がリンクから使う
create or replace function public.order_agreement_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare a public.order_agreements;
begin
  select * into a from public.order_agreements where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'status', case when a.status = 'sent' and a.expires_at <= now() then 'expired' else a.status end,
    'snapshot', a.snapshot, 'agreedAt', a.agreed_at);
end $$;

create or replace function public.agree_order_agreement(p_token text, p_ip text default null, p_ua text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.order_agreements; d public.deals; v_email text;
begin
  select * into a from public.order_agreements where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then raise exception 'この請求書のページは見つかりません'; end if;
  perform 1 from public.deals where id = a.deal_id for update;
  select * into a from public.order_agreements where id = a.id for update;
  if a.status = 'agreed' then return jsonb_build_object('success', true, 'already', true); end if;
  if a.status <> 'sent' then raise exception 'この請求書は取り消されました。担当者から届いた新しいメールをご確認ください'; end if;
  if a.expires_at <= now() then raise exception 'このページは期限が切れました。担当者へご連絡ください'; end if;
  perform public.order_agreement_finish(a.id, 'link', null, p_ip, p_ua);
  select * into d from public.deals where id = a.deal_id;
  select email into v_email from public.profiles where id = d.sales_user_id;
  -- notify* はサーバー側で双方への成立メールに使う（顧客の画面には返さない）
  return jsonb_build_object('success', true, 'already', false, 'notifyEmail', v_email, 'notifyDealId', d.id, 'notifyDealName', coalesce(d.deal_name, d.deal_code),
    'notifyClientName', d.client_name_text, 'customerEmail', a.contact_email, 'customerName', a.contact_name, 'invoiceNumber', a.invoice_number, 'totalJpy', a.snapshot->'total_jpy');
end $$;

revoke all on function public.order_agreement_issuer() from public, anon;
revoke all on function public.order_agreement_finish(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_order_agreement(uuid, date, date) from public, anon;
revoke all on function public.mark_order_agreement_sent(uuid, text) from public, anon;
revoke all on function public.staff_decide_order_agreement(uuid, text) from public, anon;
revoke all on function public.order_agreement_by_token(text) from public;
revoke all on function public.agree_order_agreement(text, text, text) from public;
grant execute on function public.order_agreement_issuer() to authenticated;
grant execute on function public.create_order_agreement(uuid, date, date) to authenticated;
grant execute on function public.mark_order_agreement_sent(uuid, text) to authenticated;
grant execute on function public.staff_decide_order_agreement(uuid, text) to authenticated;
grant execute on function public.order_agreement_by_token(text) to anon, authenticated;
grant execute on function public.agree_order_agreement(text, text, text) to anon, authenticated;
