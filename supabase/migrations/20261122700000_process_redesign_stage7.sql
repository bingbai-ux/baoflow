-- 再設計 工程7: サンプル製造（必要な案件だけ。完成写真・動画 → 顧客の確認 → 修正なら次の回）と本製造（完成予定日・到着目安）。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。写真・動画・修正データは既存の deal_design_files（category 'sample_r<回>' / 'sample_fix_r<回>'）に置く。
-- Rollback: drop function save_deal_production(uuid,text,jsonb); drop table sample_rounds, deal_productions;

create table if not exists public.sample_rounds (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  round integer not null check (round between 1 and 99),
  expected_on date,                    -- 工場のサンプル完成予定日
  completed_at timestamptz,            -- 工場から完成の写真・動画を受け取った
  shared_at timestamptz,               -- 顧客へ写真・動画を渡した
  result text check (result is null or result in ('approved', 'revise')),
  feedback text,                       -- 顧客の修正指示
  decided_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (deal_id, round)
);
create table if not exists public.deal_productions (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  started_on date,                     -- 本製造の開始日
  due_on date,                         -- 工場の完成予定日
  transit_days integer check (transit_days is null or transit_days between 0 and 365),  -- 完成から到着までの日数（輸送・通関・検査を含む）
  finished_at timestamptz,             -- 製造完了
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_on is null or started_on is null or due_on >= started_on)
);
alter table public.sample_rounds enable row level security;
alter table public.deal_productions enable row level security;
drop policy if exists staff_read on public.sample_rounds;
drop policy if exists staff_read on public.deal_productions;
create policy staff_read on public.sample_rounds for select to authenticated using (public.is_staff());
create policy staff_read on public.deal_productions for select to authenticated using (public.is_staff());
revoke all on public.sample_rounds, public.deal_productions from anon, authenticated;
grant select on public.sample_rounds, public.deal_productions to authenticated; -- 書き込みは下の関数だけが行う

-- サンプルと本製造の記録。p_action:
--   'sample_start'      {expected_on}                 次の回のサンプルを依頼（初回、または前の回が「修正」のとき）
--   'sample_done'       {}                            工場から完成の写真・動画を受け取った（その回のファイルが1件以上必要）
--   'sample_shared'     {}                            顧客へ渡した
--   'sample_result'     {result, feedback}            顧客の返事（approved / revise。revise は修正内容が必要）
--   'production_start'  {started_on, due_on, transit_days}  本製造を開始（サンプルが必要な案件は、承認済みの回が必要）
--   'production_update' {due_on, transit_days}        完成予定日・輸送日数を直す
--   'production_finish' {}                            製造完了 → 発送へ進む
create or replace function public.save_deal_production(p_deal_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; r public.sample_rounds; p public.deal_productions; v_need boolean; v_day date; v_due date; v_days integer; v_note text; v_wait text := 'us'; v_stage integer := 7;
  day_re constant text := '^\d{4}-\d{2}-\d{2}$';
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  if not exists (select 1 from public.deal_intakes where deal_id = d.id and production_started_at is not null) then raise exception '先に入稿と前払いを済ませて「製作開始へ進む」を押してください'; end if;
  p_payload := coalesce(p_payload, '{}'::jsonb);
  select * into p from public.deal_productions where deal_id = d.id for update;
  if p.finished_at is not null then raise exception '製造完了を記録したあとは変更できません'; end if;
  select * into r from public.sample_rounds where deal_id = d.id order by round desc limit 1 for update;
  v_need := exists (select 1 from public.deal_products where deal_id = d.id and sample_required);

  if p_action = 'sample_start' then
    if p.started_on is not null then raise exception '本製造を開始したあとはサンプルを依頼できません'; end if;
    if r.id is not null and r.result is distinct from 'revise' then raise exception '%', case when r.result = 'approved' then 'サンプルは承認済みです' else '進行中のサンプルがあります' end; end if;
    if coalesce(p_payload->>'expected_on', '') !~ day_re then raise exception 'サンプルの完成予定日を選んでください'; end if;
    insert into public.sample_rounds (deal_id, round, expected_on, created_by) values (d.id, coalesce(r.round, 0) + 1, (p_payload->>'expected_on')::date, auth.uid());
    v_note := '第' || (coalesce(r.round, 0) + 1) || '回サンプルを工場へ依頼（完成予定 ' || (p_payload->>'expected_on') || '）'; v_wait := 'factory';

  elsif p_action in ('sample_done', 'sample_shared', 'sample_result') then
    if r.id is null or r.result is not null then raise exception '進行中のサンプルがありません'; end if;
    if p_action = 'sample_done' then
      if r.completed_at is not null then return jsonb_build_object('success', true); end if;
      if not exists (select 1 from public.deal_design_files where deal_id = d.id and category = 'sample_r' || r.round) then raise exception '先にサンプルの写真・動画を登録してください'; end if;
      update public.sample_rounds set completed_at = now() where id = r.id;
      v_note := '第' || r.round || '回サンプルの完成写真・動画を工場から受け取った';
    elsif p_action = 'sample_shared' then
      if r.completed_at is null then raise exception '先に工場からの受け取りを記録してください'; end if;
      if r.shared_at is not null then return jsonb_build_object('success', true); end if;
      update public.sample_rounds set shared_at = now() where id = r.id;
      v_note := '第' || r.round || '回サンプルを顧客へ渡した'; v_wait := 'client';
    else
      if r.shared_at is null then raise exception '先に顧客へ渡したことを記録してください'; end if;
      if coalesce(p_payload->>'result', '') not in ('approved', 'revise') then raise exception '顧客の返事を選んでください'; end if;
      if p_payload->>'result' = 'revise' and nullif(btrim(coalesce(p_payload->>'feedback', '')), '') is null then raise exception '修正の内容を入力してください'; end if;
      update public.sample_rounds set result = p_payload->>'result', feedback = nullif(left(btrim(coalesce(p_payload->>'feedback', '')), 2000), ''), decided_at = now() where id = r.id;
      v_note := '第' || r.round || '回サンプル: ' || case when p_payload->>'result' = 'approved' then '顧客が承認' else '顧客から修正指示: ' || left(btrim(p_payload->>'feedback'), 300) end;
    end if;

  elsif p_action in ('production_start', 'production_update') then
    if coalesce(p_payload->>'due_on', '') !~ day_re then raise exception '完成予定日を選んでください'; end if;
    if coalesce(p_payload->>'transit_days', '') !~ '^\d{1,3}$' or (p_payload->>'transit_days')::integer > 365 then raise exception '完成から到着までの日数を入力してください'; end if;
    v_due := (p_payload->>'due_on')::date; v_days := (p_payload->>'transit_days')::integer;
    if p_action = 'production_start' then
      if p.started_on is not null then raise exception '本製造は開始済みです'; end if;
      if v_need and r.result is distinct from 'approved' then raise exception 'サンプルが必要な案件です。顧客がサンプルを承認してから本製造を開始してください'; end if;
      if r.id is not null and r.result is null then raise exception '進行中のサンプルがあります'; end if;
      if coalesce(p_payload->>'started_on', '') !~ day_re then raise exception '本製造の開始日を選んでください'; end if;
      v_day := (p_payload->>'started_on')::date;
      if v_due < v_day then raise exception '完成予定日は開始日以降の日付にしてください'; end if;
      insert into public.deal_productions (deal_id, started_on, due_on, transit_days) values (d.id, v_day, v_due, v_days)
        on conflict (deal_id) do update set started_on = excluded.started_on, due_on = excluded.due_on, transit_days = excluded.transit_days, updated_at = now();
      v_note := '本製造を開始（完成予定 ' || v_due || '・到着目安 ' || (v_due + v_days) || '）'; v_wait := 'factory';
    else
      if p.started_on is null then raise exception '本製造がまだ開始されていません'; end if;
      if v_due < p.started_on then raise exception '完成予定日は開始日以降の日付にしてください'; end if;
      if v_due = p.due_on and v_days = p.transit_days then return jsonb_build_object('success', true); end if;
      update public.deal_productions set due_on = v_due, transit_days = v_days, updated_at = now() where deal_id = d.id;
      v_note := '本製造の予定を変更（完成予定 ' || p.due_on || ' → ' || v_due || '・到着目安 ' || (v_due + v_days) || '）'; v_wait := 'factory';
    end if;

  elsif p_action = 'production_finish' then
    if p.started_on is null then raise exception '本製造がまだ開始されていません'; end if;
    update public.deal_productions set finished_at = now(), updated_at = now() where deal_id = d.id;
    v_note := '製造完了。発送へ進んだ'; v_stage := 8;
  else
    raise exception '操作が不正です';
  end if;

  update public.deals set process_stage = greatest(process_stage, v_stage), waiting_on = v_wait, last_activity_at = now() where id = d.id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, auth.uid(), 'status', v_note);
  return jsonb_build_object('success', true);
end $$;

revoke all on function public.save_deal_production(uuid, text, jsonb) from public, anon;
grant execute on function public.save_deal_production(uuid, text, jsonb) to authenticated;
