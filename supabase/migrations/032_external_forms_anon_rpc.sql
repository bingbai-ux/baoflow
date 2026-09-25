-- ============================================================================
-- 032: 外部フォーム (anonymous) 用 RPC 層
--
-- 背景: RLS は全テーブル authenticated のみのため、トークンリンクを開いた
-- 外部ユーザー (anon) はフォームの読み取りも送信もできなかった (Sprint 8 の欠陥)。
-- テーブルを anon に開放するとトークン列挙が可能になるため、
-- 「正しいトークンを知っている場合のみ動く」SECURITY DEFINER 関数だけを公開する。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) トークンからフォーム 1 件を取得 (status 判定は呼び出し側)
-- ----------------------------------------------------------------------------
create or replace function public.ext_form_by_token(p_token text)
returns setof public.external_forms
language sql
security definer
set search_path = public
stable
as $$
  select * from public.external_forms where token = p_token;
$$;

revoke all on function public.ext_form_by_token(text) from public;
grant execute on function public.ext_form_by_token(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 内部ヘルパー: フォームの有効性チェック (行ロック付き)。エラー文字列 or NULL。
-- ----------------------------------------------------------------------------
create or replace function public.ext_validate_form(
  p_token text,
  p_expected_type text,
  out o_form public.external_forms,
  out o_error text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  select * into o_form from public.external_forms where token = p_token for update;
  if not found then
    o_error := 'フォームが見つかりません';
    return;
  end if;
  if o_form.form_type <> p_expected_type then
    o_error := 'フォーム種別が一致しません';
    return;
  end if;
  if o_form.status = 'submitted' then
    o_error := 'このフォームは既に送信されています';
    return;
  end if;
  if o_form.status = 'cancelled' or o_form.cancelled_at is not null then
    o_error := 'このフォームは無効化されました';
    return;
  end if;
  if o_form.expires_at is not null and o_form.expires_at < now() then
    o_error := 'このフォームは有効期限が切れています';
    return;
  end if;
  o_error := null;
end;
$$;

revoke all on function public.ext_validate_form(text, text) from public;
-- ヘルパーは直接呼ばせない (submit 関数からのみ)

-- ----------------------------------------------------------------------------
-- 2) クライアント自己登録の送信
-- ----------------------------------------------------------------------------
create or replace function public.ext_submit_client(
  p_token text,
  p_payload jsonb,
  p_ip text default null,
  p_ua text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chk record;
  v_form public.external_forms;
  v_err text;
  v_client_id uuid;
  v_addr jsonb;
  v_idx int := 0;
  v_inserted int := 0;
begin
  select * into v_chk from public.ext_validate_form(p_token, 'client_self_registration');
  v_form := v_chk.o_form;
  v_err := v_chk.o_error;
  if v_err is not null then
    return jsonb_build_object('success', false, 'error', v_err);
  end if;

  if coalesce(trim(p_payload->>'company_name'), '') = '' then
    return jsonb_build_object('success', false, 'error', '会社名は必須です');
  end if;
  if jsonb_typeof(p_payload->'addresses') is distinct from 'array'
     or jsonb_array_length(p_payload->'addresses') = 0 then
    return jsonb_build_object('success', false, 'error', '配送先を最低 1 件登録してください');
  end if;

  insert into public.clients (
    company_name, short_name, industry, contact_name, contact_role,
    phone, email, tax_id, payment_terms, tax_rate,
    self_registered_at, self_registration_form_id
  ) values (
    trim(p_payload->>'company_name'),
    nullif(trim(coalesce(p_payload->>'short_name', '')), ''),
    nullif(trim(coalesce(p_payload->>'industry', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_name', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_role', '')), ''),
    nullif(trim(coalesce(p_payload->>'phone', '')), ''),
    nullif(trim(coalesce(p_payload->>'email', '')), ''),
    nullif(trim(coalesce(p_payload->>'tax_id', '')), ''),
    nullif(trim(coalesce(p_payload->>'payment_terms', '')), ''),
    nullif(trim(coalesce(p_payload->>'tax_rate', '')), '')::numeric,
    now(),
    v_form.id
  ) returning id into v_client_id;

  for v_addr in select value from jsonb_array_elements(p_payload->'addresses')
  loop
    if coalesce(trim(v_addr->>'label'), '') <> ''
       and coalesce(trim(v_addr->>'address_line1'), '') <> '' then
      insert into public.client_addresses (
        client_id, label, recipient_name, postal_code,
        address_line1, address_line2, phone, email, is_default, notes
      ) values (
        v_client_id,
        trim(v_addr->>'label'),
        nullif(trim(coalesce(v_addr->>'recipient_name', '')), ''),
        nullif(trim(coalesce(v_addr->>'postal_code', '')), ''),
        trim(v_addr->>'address_line1'),
        nullif(trim(coalesce(v_addr->>'address_line2', '')), ''),
        nullif(trim(coalesce(v_addr->>'phone', '')), ''),
        nullif(trim(coalesce(v_addr->>'email', '')), ''),
        coalesce((v_addr->>'is_default')::boolean, v_inserted = 0),
        nullif(trim(coalesce(v_addr->>'notes', '')), '')
      );
      v_inserted := v_inserted + 1;
    end if;
    v_idx := v_idx + 1;
  end loop;

  update public.external_forms set
    status = 'submitted',
    submitted_at = now(),
    submitted_by_email = nullif(trim(coalesce(p_payload->>'email', '')), ''),
    submission_ip = p_ip,
    submission_user_agent = p_ua,
    related_id = v_client_id,
    submission_data = p_payload
  where id = v_form.id;

  return jsonb_build_object('success', true, 'client_id', v_client_id);
end;
$$;

revoke all on function public.ext_submit_client(text, jsonb, text, text) from public;
grant execute on function public.ext_submit_client(text, jsonb, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) 工場自己登録の送信
-- ----------------------------------------------------------------------------
create or replace function public.ext_submit_factory(
  p_token text,
  p_payload jsonb,
  p_ip text default null,
  p_ua text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chk record;
  v_form public.external_forms;
  v_err text;
  v_factory_id uuid;
  v_specialties text[];
begin
  select * into v_chk from public.ext_validate_form(p_token, 'factory_self_registration');
  v_form := v_chk.o_form;
  v_err := v_chk.o_error;
  if v_err is not null then
    return jsonb_build_object('success', false, 'error', v_err);
  end if;

  if coalesce(trim(p_payload->>'factory_name'), '') = '' then
    return jsonb_build_object('success', false, 'error', '工場名は必須です');
  end if;

  select coalesce(array_agg(trim(x)), '{}'::text[])
  into v_specialties
  from jsonb_array_elements_text(coalesce(p_payload->'specialties', '[]'::jsonb)) x
  where trim(x) <> '';

  insert into public.factories (
    factory_name, name_cn, contact_name, contact_phone, contact_email,
    wechat, address, specialties, payment_terms, incoterm, lead_time_range,
    bank_info, notes, basic_info_completed,
    self_registered_at, self_registration_form_id
  ) values (
    trim(p_payload->>'factory_name'),
    nullif(trim(coalesce(p_payload->>'name_cn', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_name', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_phone', '')), ''),
    nullif(trim(coalesce(p_payload->>'contact_email', '')), ''),
    nullif(trim(coalesce(p_payload->>'wechat', '')), ''),
    nullif(trim(coalesce(p_payload->>'address', '')), ''),
    v_specialties,
    nullif(trim(coalesce(p_payload->>'payment_terms', '')), ''),
    nullif(trim(coalesce(p_payload->>'incoterm', '')), ''),
    nullif(trim(coalesce(p_payload->>'lead_time_range', '')), ''),
    case when coalesce(trim(p_payload->>'bank_info_text'), '') <> ''
      then jsonb_build_object('raw', trim(p_payload->>'bank_info_text'))
      else null end,
    nullif(trim(coalesce(p_payload->>'notes', '')), ''),
    true,
    now(),
    v_form.id
  ) returning id into v_factory_id;

  update public.external_forms set
    status = 'submitted',
    submitted_at = now(),
    submitted_by_email = nullif(trim(coalesce(p_payload->>'contact_email', '')), ''),
    submission_ip = p_ip,
    submission_user_agent = p_ua,
    related_id = v_factory_id,
    submission_data = p_payload
  where id = v_form.id;

  return jsonb_build_object('success', true, 'factory_id', v_factory_id);
end;
$$;

revoke all on function public.ext_submit_factory(text, jsonb, text, text) from public;
grant execute on function public.ext_submit_factory(text, jsonb, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) RFQ 回答フォームの表示データ (案件名は返さない — §0.5-5 マスキング維持)
-- ----------------------------------------------------------------------------
create or replace function public.ext_rfq_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_form public.external_forms;
  v_rfq_id uuid;
  v_rfq record;
begin
  select * into v_form from public.external_forms where token = p_token;
  if not found or v_form.form_type <> 'rfq_response' then
    return jsonb_build_object('error', 'フォームが見つかりません');
  end if;

  select rfq_id into v_rfq_id
  from public.rfq_factory_invitations
  where id = v_form.related_id;
  if not found then
    return jsonb_build_object('error', '紐付く RFQ が見つかりません');
  end if;

  select id, product_ids, request_message, response_deadline, rfq_number
  into v_rfq
  from public.rfq_requests where id = v_rfq_id;
  if not found then
    return jsonb_build_object('error', 'RFQ が見つかりません');
  end if;

  return jsonb_build_object(
    'rfq', jsonb_build_object(
      'id', v_rfq.id,
      'rfq_number', v_rfq.rfq_number,
      'request_message', v_rfq.request_message,
      'response_deadline', v_rfq.response_deadline
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'description', p.description,
        'variants', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', v.id,
            'label', coalesce(v.variant_label, ''),
            'width_mm', v.width_mm,
            'height_mm', v.height_mm,
            'depth_mm', v.depth_mm,
            'material', v.material,
            'print_color_count', v.print_color_count,
            'pcs_per_carton', v.pcs_per_carton
          ) order by v.variant_order)
          from public.deal_product_variants v
          where v.product_id = p.id
        ), '[]'::jsonb)
      ) order by p.product_no)
      from public.deal_products p
      where p.id = any(v_rfq.product_ids)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.ext_rfq_context(text) from public;
grant execute on function public.ext_rfq_context(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) RFQ 回答の送信
-- ----------------------------------------------------------------------------
create or replace function public.ext_submit_rfq(
  p_token text,
  p_payload jsonb,
  p_ip text default null,
  p_ua text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chk record;
  v_form public.external_forms;
  v_err text;
  v_inv record;
  v_rfq record;
  v_line jsonb;
  v_responded int;
  v_total int;
begin
  select * into v_chk from public.ext_validate_form(p_token, 'rfq_response');
  v_form := v_chk.o_form;
  v_err := v_chk.o_error;
  if v_err is not null then
    return jsonb_build_object('success', false, 'error', v_err);
  end if;

  select id, rfq_id, factory_id into v_inv
  from public.rfq_factory_invitations
  where id = v_form.related_id;
  if not found then
    return jsonb_build_object('success', false, 'error', '紐付く RFQ 招待が見つかりません');
  end if;

  select id, deal_id into v_rfq from public.rfq_requests where id = v_inv.rfq_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'RFQ が見つかりません');
  end if;

  if v_inv.factory_id is not null then
    for v_line in select value from jsonb_array_elements(coalesce(p_payload->'products', '[]'::jsonb))
    loop
      if coalesce(v_line->>'product_id', '') <> '' then
        insert into public.deal_quotes (
          deal_id, variant_id, factory_id, quantity, moq,
          factory_unit_price_usd, status, source_type, version
        ) values (
          v_rfq.deal_id,
          nullif(v_line->>'variant_id', '')::uuid,
          v_inv.factory_id,
          null,
          nullif(trim(coalesce(v_line->>'moq', '')), '')::numeric::int,
          nullif(trim(coalesce(v_line->>'unit_price_usd', '')), '')::numeric,
          'drafting',
          'rfq_response',
          1
        );
      end if;
    end loop;
  end if;

  update public.rfq_factory_invitations
  set responded_at = now()
  where id = v_inv.id;

  select count(*) filter (where responded_at is not null), count(*)
  into v_responded, v_total
  from public.rfq_factory_invitations
  where rfq_id = v_inv.rfq_id;

  update public.rfq_requests
  set status = case when v_responded >= v_total then 'fully_responded' else 'partially_responded' end
  where id = v_inv.rfq_id;

  update public.external_forms set
    status = 'submitted',
    submitted_at = now(),
    submitted_by_email = nullif(trim(coalesce(p_payload->>'factory_email', '')), ''),
    submission_ip = p_ip,
    submission_user_agent = p_ua,
    submission_data = p_payload
  where id = v_form.id;

  return jsonb_build_object('success', true, 'deal_id', v_rfq.deal_id);
end;
$$;

revoke all on function public.ext_submit_rfq(text, jsonb, text, text) from public;
grant execute on function public.ext_submit_rfq(text, jsonb, text, text) to anon, authenticated;
