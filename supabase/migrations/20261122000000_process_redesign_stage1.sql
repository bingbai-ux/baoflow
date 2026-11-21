-- 再設計 工程1: 9工程ステータス・ブランド・取引先担当者・プロジェクト作成
-- 追加のみ。既存のテーブル・カラムは削除も改名もしない。
-- Rollback: drop function create_project_v1(uuid,jsonb), set_process_stage(uuid,integer);
--           alter table deals drop column process_stage, drop column brand_id, drop column contact_id;
--           drop table brands, client_contacts;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists brands_client_name_key on public.brands (client_id, lower(btrim(name)));
alter table public.brands enable row level security;
drop policy if exists staff_full_access on public.brands;
create policy staff_full_access on public.brands for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
revoke all on public.brands from anon;
grant select, insert, update, delete on public.brands to authenticated;

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  email text,
  phone text,
  role text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_contacts_client_idx on public.client_contacts (client_id);
-- 主担当は1社に1人だけ
create unique index if not exists client_contacts_one_primary on public.client_contacts (client_id) where is_primary;
alter table public.client_contacts enable row level security;
drop policy if exists staff_full_access on public.client_contacts;
create policy staff_full_access on public.client_contacts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
revoke all on public.client_contacts from anon;
grant select, insert, update, delete on public.client_contacts to authenticated;

alter table public.deals
  add column if not exists process_stage smallint not null default 1,
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists contact_id uuid references public.client_contacts(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_process_stage_range') then
    alter table public.deals add constraint deals_process_stage_range check (process_stage between 1 and 9);
  end if;
end $$;

-- 裁定D6: 旧7段階 → 新9工程 の初期値移行（simple_status 自体は変更しない）
update public.deals set process_stage = case simple_status::text
  when 'quoting' then 2
  when 'quote_confirmed' then 5
  when 'paid' then 6
  when 'data_confirmed' then 7
  when 'in_production' then 7
  when 'shipped' then 8
  when 'delivered' then 9
  else process_stage end
where process_stage = 1;

-- 既存の担当者情報（clients に1人分だけ持っていたもの）を担当者表へ写す
insert into public.client_contacts (client_id, name, email, phone, role, is_primary)
select c.id, coalesce(nullif(btrim(c.contact_name), ''), '担当者'), nullif(btrim(c.email), ''),
       nullif(btrim(coalesce(c.contact_phone, c.phone)), ''), nullif(btrim(c.contact_role), ''), true
from public.clients c
where (nullif(btrim(c.contact_name), '') is not null or nullif(btrim(c.email), '') is not null)
  and not exists (select 1 from public.client_contacts x where x.client_id = c.id);

-- 既存のブランド名（会社名と違うものだけ）をブランド表へ写す
insert into public.brands (client_id, name)
select c.id, btrim(c.brand_name) from public.clients c
where nullif(btrim(c.brand_name), '') is not null
  and lower(btrim(c.brand_name)) <> lower(btrim(c.company_name))
on conflict do nothing;

-- プロジェクト作成（取引先・担当者・ブランドを選んで1件つくる）。同じ要求IDの再送は同じ結果を返す。
create or replace function public.create_project_v1(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.wizard_requests; c public.clients; v_contact uuid; v_brand uuid; v_brand_name text;
  v_name text; v_client_name text; v_prefix text; v_next integer; v_code text; v_deal uuid; v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception '保存要求が不正です'; end if;
  insert into public.wizard_requests(request_id, user_id, operation, payload)
    values (p_request_id, auth.uid(), 'project', p_payload) on conflict (request_id) do nothing;
  select * into r from public.wizard_requests where request_id = p_request_id for update;
  if not found or r.user_id is distinct from auth.uid() then raise exception '保存要求の所有者が異なります'; end if;
  if r.operation is distinct from 'project' or r.payload is distinct from p_payload then raise exception '同じ保存要求で内容が変わっています。新しい要求で保存してください'; end if;
  if r.result is not null then return r.result; end if;

  select * into c from public.clients where id = nullif(p_payload->>'client_id', '')::uuid;
  if not found then raise exception '取引先を選んでください'; end if;
  v_client_name := coalesce(nullif(btrim(c.short_name), ''), c.company_name);

  v_contact := nullif(p_payload->>'contact_id', '')::uuid;
  if v_contact is not null and not exists (select 1 from public.client_contacts where id = v_contact and client_id = c.id) then
    raise exception '担当者がこの取引先に登録されていません';
  end if;
  v_brand := nullif(p_payload->>'brand_id', '')::uuid;
  if v_brand is not null then
    select name into v_brand_name from public.brands where id = v_brand and client_id = c.id;
    if not found then raise exception 'ブランドがこの取引先に登録されていません'; end if;
  end if;
  if nullif(p_payload->>'sales_user_id', '') is not null and not exists (
    select 1 from public.profiles where id = (p_payload->>'sales_user_id')::uuid and role::text in ('admin', 'sales')) then
    raise exception '担当者を確認してください';
  end if;

  v_name := nullif(btrim(p_payload->>'deal_name'), '');
  if v_name is null then
    v_name := coalesce(v_brand_name, v_client_name) || ' ' || to_char(current_date, 'YYYY"年"FMMM"月"');
  end if;

  v_prefix := 'PF-' || to_char(current_date, 'YYYYMM') || '-';
  perform pg_advisory_xact_lock(hashtext(v_prefix));
  select coalesce(max(substring(deal_code from '[0-9]+$')::integer), 0) + 1 into v_next from public.deals where deal_code like v_prefix || '%';
  v_code := v_prefix || lpad(v_next::text, greatest(3, length(v_next::text)), '0');

  insert into public.deals (deal_code, deal_name, client_id, client_name_text, brand_text, brand_id, contact_id,
      desired_delivery_date, sales_user_id, simple_status, visibility, waiting_on, process_stage)
    values (v_code, v_name, c.id, v_client_name, v_brand_name, v_brand, v_contact,
      nullif(p_payload->>'desired_delivery_date', '')::date,
      coalesce(nullif(p_payload->>'sales_user_id', '')::uuid, auth.uid()), 'quoting', 'internal', 'us', 1)
    returning id into v_deal;
  insert into public.deal_status_history (deal_id, to_status, to_simple_status, changed_by, kind, note)
    values (v_deal, 'M01', 'quoting', auth.uid(), 'status', 'プロジェクト作成');

  v_result := jsonb_build_object('success', true, 'dealId', v_deal, 'dealCode', v_code);
  update public.wizard_requests set result = v_result where request_id = p_request_id;
  return v_result;
end $$;

-- 工程の変更（変更と履歴を必ず一緒に残す）
create or replace function public.set_process_stage(p_deal_id uuid, p_stage integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare d public.deals;
  v_names text[] := array['プロジェクト作成','商品登録','工場見積','価格提示','請求・契約','入稿','製造','発送','検収'];
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_stage is null or p_stage < 1 or p_stage > 9 then raise exception '工程は1〜9で指定してください'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  if d.process_stage = p_stage then return jsonb_build_object('success', true, 'changed', false); end if;
  update public.deals set process_stage = p_stage, last_activity_at = now() where id = p_deal_id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (p_deal_id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status',
      '工程を「' || v_names[d.process_stage] || '」から「' || v_names[p_stage] || '」に変更');
  return jsonb_build_object('success', true, 'changed', true);
end $$;

revoke all on function public.create_project_v1(uuid, jsonb) from public, anon;
revoke all on function public.set_process_stage(uuid, integer) from public, anon;
grant execute on function public.create_project_v1(uuid, jsonb) to authenticated;
grant execute on function public.set_process_stage(uuid, integer) to authenticated;
