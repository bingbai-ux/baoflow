-- 再設計 工程6: 入稿（顧客のデータ／工場の雛形を BAO が受け取って相手へ渡す。受け渡しの記録を残す）と、工場への前払いの記録。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。ファイル本体は既存の deal_design_files（category 'intake_template' / 'intake_artwork'）に置く。
-- Rollback: drop function save_deal_intake(uuid,text,jsonb), deal_intake_steps(text); drop table deal_intakes;

create table if not exists public.deal_intakes (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  pattern text check (pattern is null or pattern in ('customer', 'template')),  -- customer: 顧客がデータを用意 / template: 工場の雛形に顧客が流し込む
  template_received_at timestamptz,   -- 工場から雛形を受け取った
  template_sent_at timestamptz,       -- 雛形を顧客へ渡した
  artwork_received_at timestamptz,    -- 顧客から入稿データを受け取った
  artwork_sent_at timestamptz,        -- 入稿データを工場へ渡した
  factory_ok_at timestamptz,          -- 工場がデータを確認して問題なし
  prepay_rate integer check (prepay_rate is null or prepay_rate in (30, 50, 100)),
  prepay_amount_usd numeric check (prepay_amount_usd is null or prepay_amount_usd > 0),
  prepay_paid_on date,                -- 振込日。入っていれば前払い済み
  prepay_note text,
  prepay_recorded_by uuid references public.profiles(id) on delete set null,
  prepay_recorded_at timestamptz,
  production_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deal_intakes enable row level security;
drop policy if exists staff_read on public.deal_intakes;
create policy staff_read on public.deal_intakes for select to authenticated using (public.is_staff());
revoke all on public.deal_intakes from anon, authenticated;
grant select on public.deal_intakes to authenticated; -- 書き込みは下の関数だけが行う

-- 進め方ごとの手順（この順に記録する）
create or replace function public.deal_intake_steps(p_pattern text)
returns text[] language sql immutable as $$
  select case p_pattern when 'customer' then array['artwork_received', 'artwork_sent', 'factory_ok']
                        when 'template' then array['template_received', 'template_sent', 'artwork_received', 'artwork_sent', 'factory_ok'] else '{}'::text[] end
$$;

-- 入稿と前払いの記録。p_action:
--   'pattern'        {pattern}                       進め方を選ぶ（手順を記録し始めたら変えられない）
--   'step'           {step, done}                    手順を記録する / 直前の記録を取り消す
--   'prepay_rate'    {rate}                          前払いの割合（30 / 50 / 100）
--   'prepay_paid'    {paid_on, amount_usd, note}     工場へ振り込んだことを記録
--   'prepay_unpaid'  {}                              振込の記録を取り消す
--   'start'          {}                              製作開始へ進む（工場のデータ確認と前払いの記録が必要）
create or replace function public.save_deal_intake(p_deal_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; i public.deal_intakes; v_steps text[]; v_step text; v_idx integer; v_done boolean; v_at timestamptz; v_prev timestamptz; v_next timestamptz;
  v_note text; v_rate integer; v_amount numeric; v_day date;
  v_label constant jsonb := '{"template_received":"工場から雛形を受け取った","template_sent":"雛形を顧客へ渡した","artwork_received":"顧客から入稿データを受け取った","artwork_sent":"入稿データを工場へ渡した","factory_ok":"工場がデータを確認した"}';
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  if not exists (select 1 from public.order_agreements where deal_id = d.id and status = 'agreed') then raise exception '先に請求書の承認（契約成立）が必要です'; end if;
  insert into public.deal_intakes (deal_id) values (d.id) on conflict (deal_id) do nothing;
  select * into i from public.deal_intakes where deal_id = d.id for update;
  if i.production_started_at is not null then raise exception '製作開始へ進んだあとは変更できません'; end if;
  p_payload := coalesce(p_payload, '{}'::jsonb);

  if p_action = 'pattern' then
    if coalesce(p_payload->>'pattern', '') not in ('customer', 'template') then raise exception '進め方を選んでください'; end if;
    if i.pattern is distinct from p_payload->>'pattern' and coalesce(i.template_received_at, i.template_sent_at, i.artwork_received_at, i.artwork_sent_at, i.factory_ok_at) is not null then
      raise exception '記録を始めたあとは進め方を変えられません。先に記録を取り消してください';
    end if;
    update public.deal_intakes set pattern = p_payload->>'pattern', updated_at = now() where deal_id = d.id;

  elsif p_action = 'step' then
    v_steps := public.deal_intake_steps(i.pattern);
    if array_length(v_steps, 1) is null then raise exception '先に進め方を選んでください'; end if;
    v_step := p_payload->>'step'; v_idx := array_position(v_steps, v_step); v_done := coalesce((p_payload->>'done')::boolean, true);
    if v_idx is null then raise exception 'この進め方には無い手順です'; end if;
    v_at := (to_jsonb(i)->>(v_step || '_at'))::timestamptz;
    v_prev := case when v_idx > 1 then (to_jsonb(i)->>(v_steps[v_idx - 1] || '_at'))::timestamptz end;
    v_next := case when v_idx < array_length(v_steps, 1) then (to_jsonb(i)->>(v_steps[v_idx + 1] || '_at'))::timestamptz end;
    if v_done then
      if v_at is not null then return jsonb_build_object('success', true); end if; -- 二度押しても1回分
      if v_idx > 1 and v_prev is null then raise exception '前の手順を先に記録してください'; end if;
      if v_step = 'template_received' and not exists (select 1 from public.deal_design_files where deal_id = d.id and category = 'intake_template') then raise exception '先に雛形のファイルを登録してください'; end if;
      if v_step = 'artwork_received' and not exists (select 1 from public.deal_design_files where deal_id = d.id and category = 'intake_artwork') then raise exception '先に入稿データのファイルを登録してください'; end if;
      v_note := '入稿: ' || (v_label->>v_step);
    else
      if v_at is null then return jsonb_build_object('success', true); end if;
      if v_next is not null then raise exception '後ろの手順の記録を先に取り消してください'; end if;
      v_note := '入稿: 「' || (v_label->>v_step) || '」の記録を取り消した';
    end if;
    execute format('update public.deal_intakes set %I = $1, updated_at = now() where deal_id = $2', v_step || '_at') using case when v_done then now() end, d.id;
    update public.deals set waiting_on = case when v_done and v_step in ('template_sent') then 'client' when v_done and v_step in ('artwork_sent') then 'factory' else 'us' end,
      process_stage = greatest(process_stage, 6), last_activity_at = now() where id = d.id;
    insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
      values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status', v_note);

  elsif p_action = 'prepay_rate' then
    v_rate := nullif(p_payload->>'rate', '')::integer;
    if v_rate is null or v_rate not in (30, 50, 100) then raise exception '前払いの割合を選んでください'; end if;
    if i.prepay_paid_on is not null then raise exception '振込の記録を取り消してから変更してください'; end if;
    update public.deal_intakes set prepay_rate = v_rate, updated_at = now() where deal_id = d.id;

  elsif p_action = 'prepay_paid' then
    if i.prepay_rate is null then raise exception '先に前払いの割合を選んでください'; end if;
    if coalesce(p_payload->>'amount_usd', '') !~ '^[0-9]+(\.[0-9]{1,2})?$' or (p_payload->>'amount_usd')::numeric <= 0 then raise exception '振り込んだ金額（$）を入力してください'; end if;
    if coalesce(p_payload->>'paid_on', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '振込日を選んでください'; end if;
    v_amount := (p_payload->>'amount_usd')::numeric; v_day := (p_payload->>'paid_on')::date;
    if v_day > (now() at time zone 'Asia/Tokyo')::date then raise exception '振込日に未来の日付は選べません'; end if;
    update public.deal_intakes set prepay_amount_usd = v_amount, prepay_paid_on = v_day, prepay_note = nullif(left(btrim(coalesce(p_payload->>'note', '')), 500), ''),
      prepay_recorded_by = auth.uid(), prepay_recorded_at = now(), updated_at = now() where deal_id = d.id;
    update public.deals set last_activity_at = now() where id = d.id;
    insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
      values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status', '工場への前払いを記録: $' || v_amount || '（' || i.prepay_rate || '%・振込日 ' || v_day || '）');

  elsif p_action = 'prepay_unpaid' then
    if i.prepay_paid_on is null then return jsonb_build_object('success', true); end if;
    update public.deal_intakes set prepay_amount_usd = null, prepay_paid_on = null, prepay_note = null, prepay_recorded_by = null, prepay_recorded_at = null, updated_at = now() where deal_id = d.id;
    insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
      values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status', '工場への前払いの記録を取り消した');

  elsif p_action = 'start' then
    if i.factory_ok_at is null then raise exception '工場のデータ確認がまだ記録されていません'; end if;
    if i.prepay_paid_on is null then raise exception '工場への前払いがまだ記録されていません'; end if;
    update public.deal_intakes set production_started_at = now(), updated_at = now() where deal_id = d.id;
    update public.deals set process_stage = greatest(process_stage, 7), waiting_on = 'factory', last_activity_at = now() where id = d.id;
    insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
      values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status', '入稿と前払いが完了。製作開始へ進んだ');
  else
    raise exception '操作が不正です';
  end if;
  return jsonb_build_object('success', true);
end $$;

revoke all on function public.deal_intake_steps(text) from public, anon;
revoke all on function public.save_deal_intake(uuid, text, jsonb) from public, anon;
grant execute on function public.deal_intake_steps(text) to authenticated;
grant execute on function public.save_deal_intake(uuid, text, jsonb) to authenticated;
