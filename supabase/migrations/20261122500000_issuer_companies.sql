-- 発行元の会社マスター: 帳票（商品内容の確認・お見積書・請求書）の発行元を複数登録して選べるようにする。
-- ロゴ・角印の画像とインボイス登録番号・振込先を会社ごとに持つ。
-- 追加のみ（自分で追加した工程5の関数 create_order_agreement / order_agreement_by_token / order_agreement_issuer は、この会社マスターを使う形に置き換える）。
-- Rollback: 工程5の migration を流し直して関数を戻す; drop function save_issuer_company(jsonb), set_default_issuer_company(uuid), issuer_company_missing(public.issuer_companies),
--           create_order_agreement(uuid,date,date,uuid); drop table issuer_companies;

create table if not exists public.issuer_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  postal_code text, address text, phone text, email text,
  registration_number text,               -- インボイス登録番号（T + 13桁）
  bank_name text, branch_name text, account_type text, account_number text, account_holder text,
  logo_data text check (logo_data is null or (logo_data ~ '^data:image/(png|jpeg);base64,' and char_length(logo_data) <= 700000)),   -- ロゴ画像
  stamp_data text check (stamp_data is null or (stamp_data ~ '^data:image/(png|jpeg);base64,' and char_length(stamp_data) <= 700000)), -- 角印の画像
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_number is null or registration_number ~ '^T[0-9]{13}$')
);
create unique index if not exists issuer_companies_name_key on public.issuer_companies (lower(btrim(name)));
create unique index if not exists issuer_companies_one_default on public.issuer_companies (is_default) where is_default;
alter table public.issuer_companies enable row level security;
drop policy if exists staff_read on public.issuer_companies;
create policy staff_read on public.issuer_companies for select to authenticated using (public.is_staff());
revoke all on public.issuer_companies from anon, authenticated;
grant select on public.issuer_companies to authenticated; -- 書き込みは下の関数だけが行う

insert into public.issuer_companies (name, is_default) values ('株式会社FOOD&COMPANY', true), ('株式会社Springroll', false)
  on conflict do nothing;
-- 以前の誤った社名を直す（従来の帳票画面が参照する設定）
update public.system_settings set company_info = jsonb_set(coalesce(company_info, '{}'::jsonb), '{name}', to_jsonb('株式会社FOOD&COMPANY'::text))
  where company_info->>'name' = 'kokon inc.';

-- 請求書の発行に足りない項目
create or replace function public.issuer_company_missing(c public.issuer_companies)
returns text[] language sql immutable as $$
  select array_remove(array[
    case when nullif(btrim(coalesce(c.address, '')), '') is null then '住所' end,
    case when nullif(btrim(coalesce(c.bank_name, '')), '') is null then '銀行名' end,
    case when nullif(btrim(coalesce(c.branch_name, '')), '') is null then '支店名' end,
    case when nullif(btrim(coalesce(c.account_type, '')), '') is null then '口座種別' end,
    case when nullif(btrim(coalesce(c.account_number, '')), '') is null then '口座番号' end,
    case when nullif(btrim(coalesce(c.account_holder, '')), '') is null then '口座名義' end], null)
$$;

-- 会社の登録・変更。p_payload のキー: id（変更時）, name, postal_code, address, phone, email, registration_number, bank_name, branch_name, account_type, account_number, account_holder,
--   logo_data / stamp_data（キーがあるときだけ更新。null で画像を外す）, archived（true で使わない会社にする）
create or replace function public.save_issuer_company(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; c public.issuer_companies; t text := nullif(btrim(coalesce(p_payload->>'name', '')), ''); v_reg text := nullif(upper(btrim(coalesce(p_payload->>'registration_number', ''))), '');
  f text; v_txt constant text[] := array['postal_code', 'address', 'phone', 'email', 'bank_name', 'branch_name', 'account_type', 'account_number', 'account_holder'];
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception '保存内容が不正です'; end if;
  if t is null then raise exception '会社名を入力してください'; end if;
  if v_reg is not null and v_reg !~ '^T[0-9]{13}$' then raise exception 'インボイス登録番号は「T」と数字13桁で入力してください'; end if;
  foreach f in array array['logo_data', 'stamp_data'] loop
    if p_payload ? f and jsonb_typeof(p_payload->f) <> 'null' then
      if (p_payload->>f) !~ '^data:image/(png|jpeg);base64,' then raise exception '画像は PNG か JPEG を選んでください'; end if;
      if char_length(p_payload->>f) > 700000 then raise exception '画像が大きすぎます（500KB まで）'; end if;
    end if;
  end loop;
  v_id := nullif(p_payload->>'id', '')::uuid;
  if exists (select 1 from public.issuer_companies where lower(btrim(name)) = lower(t) and id is distinct from v_id) then raise exception '同じ会社名が既にあります'; end if;
  if v_id is null then
    insert into public.issuer_companies (name, is_default) values (t, not exists (select 1 from public.issuer_companies where is_default)) returning id into v_id;
  else
    update public.issuer_companies set name = t where id = v_id;
    if not found then raise exception '会社が見つかりません'; end if;
  end if;
  update public.issuer_companies set
    postal_code = nullif(btrim(coalesce(p_payload->>'postal_code', '')), ''), address = nullif(btrim(coalesce(p_payload->>'address', '')), ''),
    phone = nullif(btrim(coalesce(p_payload->>'phone', '')), ''), email = nullif(btrim(coalesce(p_payload->>'email', '')), ''), registration_number = v_reg,
    bank_name = nullif(btrim(coalesce(p_payload->>'bank_name', '')), ''), branch_name = nullif(btrim(coalesce(p_payload->>'branch_name', '')), ''),
    account_type = nullif(btrim(coalesce(p_payload->>'account_type', '')), ''), account_number = nullif(btrim(coalesce(p_payload->>'account_number', '')), ''),
    account_holder = nullif(btrim(coalesce(p_payload->>'account_holder', '')), ''),
    logo_data = case when p_payload ? 'logo_data' then p_payload->>'logo_data' else logo_data end,
    stamp_data = case when p_payload ? 'stamp_data' then p_payload->>'stamp_data' else stamp_data end,
    archived_at = case when coalesce((p_payload->>'archived')::boolean, false) then coalesce(archived_at, now()) else null end,
    updated_at = now()
  where id = v_id returning * into c;
  if c.archived_at is not null and c.is_default then raise exception '既定の会社は「使わない」にできません。先に別の会社を既定にしてください'; end if;
  return jsonb_build_object('success', true, 'id', v_id);
end $$;

create or replace function public.set_default_issuer_company(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  perform 1 from public.issuer_companies where id = p_id and archived_at is null for update;
  if not found then raise exception '会社が見つかりません'; end if;
  update public.issuer_companies set is_default = false where is_default and id <> p_id;
  update public.issuer_companies set is_default = true, updated_at = now() where id = p_id;
  return jsonb_build_object('success', true);
end $$;

-- 請求書: 発行元の会社を選んで発行する
create or replace function public.create_order_agreement(p_deal_id uuid, p_issue_date date, p_due_date date, p_issuer_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; c record; i public.issuer_companies; v_missing text[]; v_lines jsonb; v_sub numeric; v_tax_rate numeric; v_notes text; v_total numeric; v_snapshot jsonb;
  v_seq integer; v_no text; v_token text; v_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_issue_date is null or p_due_date is null then raise exception '発行日と振込期限を選んでください'; end if;
  if p_due_date < p_issue_date then raise exception '振込期限は発行日以降の日付にしてください'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件では発行できません'; end if;
  if exists (select 1 from public.order_agreements where deal_id = d.id and status = 'agreed') then raise exception 'この案件は契約成立済みです'; end if;
  select * into i from public.issuer_companies where id = p_issuer_id and archived_at is null;
  if not found then raise exception '発行元の会社を選んでください'; end if;
  v_missing := public.issuer_company_missing(i);
  if array_length(v_missing, 1) > 0 then raise exception '「%」の登録情報が足りません: %', i.name, array_to_string(v_missing, '・'); end if;
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
  select default_tax_rate, nullif(btrim(coalesce(invoice_default_text, '')), '') into v_tax_rate, v_notes from public.system_settings limit 1;
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
    'issuer', jsonb_build_object('id', i.id, 'name', i.name, 'postal_code', i.postal_code, 'address', i.address, 'phone', i.phone, 'email', i.email, 'registration_number', i.registration_number),
    'bank', jsonb_build_object('bank_name', i.bank_name, 'branch_name', i.branch_name, 'account_type', i.account_type, 'account_number', i.account_number, 'account_holder', i.account_holder),
    'notes', v_notes);
  insert into public.order_agreements (deal_id, seq, invoice_number, token, issue_date, due_date, snapshot, contact_name, contact_email, created_by, expires_at)
    values (d.id, v_seq, v_no, v_token, p_issue_date, p_due_date, v_snapshot, c.name, nullif(btrim(c.email), ''), auth.uid(), now() + interval '60 days')
    returning id into v_id;
  update public.deals set process_stage = greatest(process_stage, 5), last_activity_at = now() where id = d.id;
  return jsonb_build_object('success', true, 'id', v_id, 'token', v_token, 'invoiceNumber', v_no, 'contactName', c.name, 'contactEmail', nullif(btrim(c.email), ''), 'snapshot', v_snapshot,
    'logo', i.logo_data, 'stamp', i.stamp_data);
end $$;

-- 発行元を指定しない古い呼び方は、既定の会社で発行する
create or replace function public.create_order_agreement(p_deal_id uuid, p_issue_date date, p_due_date date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return public.create_order_agreement(p_deal_id, p_issue_date, p_due_date, (select id from public.issuer_companies where is_default and archived_at is null));
end $$;

-- 設定（system_settings）を見る古い関数は使わない。呼ばれても会社マスターの既定の会社の状態を返す
create or replace function public.order_agreement_issuer()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare i public.issuer_companies;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into i from public.issuer_companies where is_default and archived_at is null;
  if not found then return jsonb_build_object('missing', jsonb_build_array('既定の会社')); end if;
  return jsonb_build_object('missing', to_jsonb(public.issuer_company_missing(i)));
end $$;

-- 顧客の請求書ページ: 発行元のロゴ・角印も返す
create or replace function public.order_agreement_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare a public.order_agreements; i public.issuer_companies;
begin
  select * into a from public.order_agreements where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then return jsonb_build_object('found', false); end if;
  select * into i from public.issuer_companies where id = nullif(a.snapshot->'issuer'->>'id', '')::uuid;
  return jsonb_build_object('found', true, 'status', case when a.status = 'sent' and a.expires_at <= now() then 'expired' else a.status end,
    'snapshot', a.snapshot, 'agreedAt', a.agreed_at, 'logo', i.logo_data, 'stamp', i.stamp_data);
end $$;

revoke all on function public.issuer_company_missing(public.issuer_companies) from public, anon;
revoke all on function public.save_issuer_company(jsonb) from public, anon;
revoke all on function public.set_default_issuer_company(uuid) from public, anon;
revoke all on function public.create_order_agreement(uuid, date, date, uuid) from public, anon;
grant execute on function public.issuer_company_missing(public.issuer_companies) to authenticated;
grant execute on function public.save_issuer_company(jsonb) to authenticated;
grant execute on function public.set_default_issuer_company(uuid) to authenticated;
grant execute on function public.create_order_agreement(uuid, date, date, uuid) to authenticated;
