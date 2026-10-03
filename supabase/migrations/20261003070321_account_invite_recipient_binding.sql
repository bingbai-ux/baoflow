-- Recipient-bound account invitations. Unapplied; release with matching UI/actions.
-- Existing warehouse RLS and assigned-transport scope are unchanged.
-- Unbound older invitations are rejected without being consumed.
create or replace function public.claim_account_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_form public.external_forms;
  v_role text;
  v_client uuid;
  v_partner uuid;
  v_factory uuid;
  v_email text;
  v_recipient text;
  v_confirmed_at timestamptz;
  v_current_role text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'ログインしてください');
  end if;

  select * into v_form from public.external_forms where token = p_token for update;
  if not found or v_form.form_type <> 'account_invite' then
    return jsonb_build_object('success', false, 'error', '招待リンクが見つかりません');
  end if;
  if v_form.status = 'submitted' then
    return jsonb_build_object('success', false, 'error', 'この招待は既に使用されています');
  end if;
  if v_form.status = 'cancelled' or v_form.cancelled_at is not null then
    return jsonb_build_object('success', false, 'error', 'この招待は無効化されました');
  end if;
  if v_form.expires_at is not null and v_form.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'この招待は有効期限が切れています');
  end if;

  -- Exact verified Auth email; plus labels remain distinct login identities.
  v_recipient := nullif(lower(btrim(v_form.context->>'recipient_email')), '');
  if v_recipient is null then
    return jsonb_build_object('success', false, 'error', '宛先を指定した新しい招待を依頼してください');
  end if;
  select email, email_confirmed_at into v_email, v_confirmed_at
  from auth.users where id = auth.uid() for share;
  if not found or v_confirmed_at is null or v_email is null
     or lower(btrim(v_email)) <> v_recipient then
    return jsonb_build_object('success', false, 'error', '招待先の確認済みメールアドレスでログインしてください');
  end if;

  v_role := v_form.context->>'portal_role';
  if v_role is null or v_role not in ('client', 'logistics', 'factory') then
    return jsonb_build_object('success', false, 'error', '招待の種別が不正です');
  end if;
  v_client := nullif(v_form.context->>'client_id', '')::uuid;
  v_partner := nullif(v_form.context->>'partner_id', '')::uuid;
  v_factory := nullif(v_form.context->>'factory_id', '')::uuid;

  select role::text into v_current_role from public.profiles
  where id = auth.uid() for update;
  if not found or v_current_role is null then
    return jsonb_build_object('success', false, 'error', 'プロフィールを確認できません');
  end if;
  if v_current_role in ('admin','sales') then
    return jsonb_build_object('success', false, 'error', 'スタッフアカウントではこの招待を使えません');
  end if;

  update public.profiles set
    role = v_role::public.user_role,
    client_id = v_client,
    logistics_partner_id = v_partner,
    factory_id = v_factory
  where id = auth.uid();

  update public.external_forms set
    status = 'submitted',
    submitted_at = now(),
    submitted_by_email = v_email,
    related_id = auth.uid(),
    submission_data = jsonb_build_object('claimed_by', auth.uid())
  where id = v_form.id;

  return jsonb_build_object('success', true, 'portal_role', v_role);
end;
$$;

revoke all on function public.claim_account_invite(text) from public, anon;
grant execute on function public.claim_account_invite(text) to authenticated;
