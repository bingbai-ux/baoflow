-- (1) 工場の返信ページ: 工場がログインなしで返事・写真を書き込めるリンク。書き込みは案件のトーク欄（deal_communications）に入る。
-- (2) AIの使い分けの設定: 返信の下書き・カタログの読み取りで使うAIを、設定画面から切り替える。
-- 追加のみ。既存のテーブル・カラム・関数は変更しない。
-- Rollback: drop function create_talk_link(uuid,uuid), cancel_talk_link(uuid), talk_link_by_token(text), post_talk_link(text,text,jsonb,text,text), save_ai_settings(text,text); drop table talk_links, ai_settings;

create table if not exists public.talk_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  deal_id uuid not null references public.deals(id) on delete cascade,
  factory_id uuid not null references public.factories(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  post_count integer not null default 0,
  last_posted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create unique index if not exists talk_links_one_active on public.talk_links (deal_id, factory_id) where status = 'active';
alter table public.talk_links enable row level security;
drop policy if exists staff_read on public.talk_links;
create policy staff_read on public.talk_links for select to authenticated using (public.is_staff());
revoke all on public.talk_links from anon, authenticated;
grant select on public.talk_links to authenticated;

-- 返信ページのリンクをつくる（同じ案件・同じ工場で有効なリンクがあれば、それを返す）。見積をもらっている工場だけ。
create or replace function public.create_talk_link(p_deal_id uuid, p_factory_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.deals; l public.talk_links; v_token text;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件ではリンクをつくれません'; end if;
  if not exists (select 1 from public.deal_quotes q where q.deal_id = d.id and q.factory_id = p_factory_id) then raise exception 'この案件で見積をもらっている工場を選んでください'; end if;
  update public.talk_links set status = 'cancelled' where deal_id = d.id and factory_id = p_factory_id and status = 'active' and expires_at <= now();
  select * into l from public.talk_links where deal_id = d.id and factory_id = p_factory_id and status = 'active';
  if found then return jsonb_build_object('success', true, 'token', l.token, 'reused', true); end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.talk_links (token, deal_id, factory_id, created_by, expires_at) values (v_token, d.id, p_factory_id, auth.uid(), now() + interval '90 days');
  return jsonb_build_object('success', true, 'token', v_token, 'reused', false);
end $$;

create or replace function public.cancel_talk_link(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  update public.talk_links set status = 'cancelled' where id = p_id;
  if not found then raise exception 'リンクが見つかりません'; end if;
  return jsonb_build_object('success', true);
end $$;

-- リンクを開いた工場に見せる内容（案件番号と工場名だけ。顧客名・金額・ほかのやり取りは返さない）。読むだけ。
create or replace function public.talk_link_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare l public.talk_links;
begin
  select * into l from public.talk_links where token = p_token;
  if not found or p_token is null or length(p_token) < 32 then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'status', case when l.status = 'active' and l.expires_at <= now() then 'expired' else l.status end,
    'dealId', l.deal_id, 'dealCode', (select deal_code from public.deals where id = l.deal_id), 'factoryName', (select factory_name from public.factories where id = l.factory_id));
end $$;

-- 工場の書き込みをトーク欄に入れる。サーバーの受け口だけが管理用の鍵で呼ぶ（ファイルの保存先はサーバーが決めたものだけ）。
-- p_files: [{name, type, size, storage_path, url}]
create or replace function public.post_talk_link(p_token text, p_body text, p_files jsonb default '[]'::jsonb, p_ip text default null, p_ua text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.talk_links; d public.deals; f jsonb; v_name text; v_names text; v_version integer; v_body text; v_comm uuid;
begin
  select * into l from public.talk_links where token = p_token for update;
  if not found or p_token is null or length(p_token) < 32 then raise exception 'このページは見つかりません'; end if;
  if l.status <> 'active' or l.expires_at <= now() then raise exception 'このページは使えなくなりました'; end if;
  if l.post_count >= 300 then raise exception '書き込みの上限に達しました'; end if;
  if jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 5 then raise exception 'ファイルは5件までです'; end if;
  if coalesce(btrim(p_body), '') = '' and jsonb_array_length(coalesce(p_files, '[]'::jsonb)) = 0 then raise exception '本文がありません'; end if;
  if length(p_body) > 4000 then raise exception '本文が長すぎます'; end if;
  select * into d from public.deals where id = l.deal_id for update;
  select factory_name into v_name from public.factories where id = l.factory_id;
  select string_agg(left(x->>'name', 120), '、') into v_names from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) x;
  v_body := coalesce(nullif(btrim(p_body), ''), '（本文なし）') || case when v_names is not null then E'\n\n添付: ' || v_names else '' end;
  insert into public.deal_communications (deal_id, author_user_id, author_role, channel, subject, body, is_read, occurred_at)
    values (d.id, null, 'factory', 'link', coalesce(v_name, '工場') || '（返信ページ）', v_body, false, now()) returning id into v_comm;
  select coalesce(max(version_number), 0) into v_version from public.deal_design_files where deal_id = d.id;
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if coalesce(f->>'storage_path', '') not like d.id::text || '/%' or coalesce(f->>'url', '') = '' then raise exception 'ファイルの保存先が正しくありません'; end if;
    v_version := v_version + 1;
    insert into public.deal_design_files (deal_id, file_url, storage_path, file_name, file_type, file_size_bytes, version_number, category, comment)
      values (d.id, f->>'url', f->>'storage_path', left(f->>'name', 200), nullif(f->>'type', ''), nullif(f->>'size', '')::bigint, v_version, 'talk_link', coalesce(v_name, '工場') || 'が返信ページから送付');
  end loop;
  update public.talk_links set post_count = post_count + 1, last_posted_at = now() where id = l.id;
  update public.deals set waiting_on = 'us', last_activity_at = now() where id = d.id;
  insert into public.deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, kind, note)
    values (d.id, d.master_status, d.master_status, d.simple_status, d.simple_status, null, 'comm', coalesce(v_name, '工場') || ' が返信ページから連絡しました（' || coalesce(left(p_ip, 60), '接続元不明') || '）');
  if d.sales_user_id is not null then
    insert into public.notifications (user_id, deal_id, type, status, content)
      values (d.sales_user_id, d.id, 'dashboard', 'pending', coalesce(v_name, '工場') || ' から「' || coalesce(d.deal_name, d.deal_code) || '」に連絡が届きました。');
  end if;
  return jsonb_build_object('success', true, 'communicationId', v_comm);
end $$;

-- AIの使い分け（1行だけ持つ）
create table if not exists public.ai_settings (
  id boolean primary key default true check (id),
  draft_model text not null default 'claude-sonnet-5-5' check (draft_model in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')),
  catalog_model text not null default 'claude-opus-5-5' check (catalog_model in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.ai_settings (id) values (true) on conflict (id) do nothing;
alter table public.ai_settings enable row level security;
drop policy if exists staff_read on public.ai_settings;
create policy staff_read on public.ai_settings for select to authenticated using (public.is_staff());
revoke all on public.ai_settings from anon, authenticated;
grant select on public.ai_settings to authenticated;

create or replace function public.save_ai_settings(p_draft_model text, p_catalog_model text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_draft_model not in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5') or p_catalog_model not in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5') then raise exception 'AIの種類が正しくありません'; end if;
  update public.ai_settings set draft_model = p_draft_model, catalog_model = p_catalog_model, updated_by = auth.uid(), updated_at = now() where id;
  return jsonb_build_object('success', true);
end $$;

revoke all on function public.create_talk_link(uuid, uuid) from public, anon;
revoke all on function public.cancel_talk_link(uuid) from public, anon;
revoke all on function public.talk_link_by_token(text) from public;
revoke all on function public.post_talk_link(text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.save_ai_settings(text, text) from public, anon;
grant execute on function public.create_talk_link(uuid, uuid) to authenticated;
grant execute on function public.cancel_talk_link(uuid) to authenticated;
grant execute on function public.talk_link_by_token(text) to anon, authenticated;
grant execute on function public.post_talk_link(text, text, jsonb, text, text) to service_role;
grant execute on function public.save_ai_settings(text, text) to authenticated;
