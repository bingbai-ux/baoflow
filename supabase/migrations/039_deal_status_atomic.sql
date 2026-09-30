-- Prepared locally; do not apply to the old baoflow DB.
-- Status/history and archive/history must commit together. No table/RLS changes.
create or replace function public.set_deal_simple_status(
  p_deal_id uuid, p_to public.simple_status, p_note text default null,
  p_expected public.simple_status default null
) returns void language plpgsql security invoker set search_path = public as $$
declare d public.deals%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then
    raise exception 'この操作は営業・管理者のみ利用できます';
  end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  if p_to is null then raise exception 'ステータスを選んでください'; end if;
  if p_expected is not null and d.simple_status <> p_expected then
    raise exception '他の操作で状態が変わりました。画面を読み直してください';
  end if;
  if d.simple_status = p_to then return; end if;
  update public.deals set simple_status = p_to, last_activity_at = now() where id = d.id;
  -- master_status stays independent. Supply its current value to the legacy NOT NULL column.
  insert into public.deal_status_history
    (deal_id,from_status,to_status,from_simple_status,to_simple_status,changed_by,note,kind)
  values (d.id,d.master_status,d.master_status,d.simple_status,p_to,auth.uid(),p_note,'status');
end $$;
revoke all on function public.set_deal_simple_status(uuid,public.simple_status,text,public.simple_status) from public, anon;
grant execute on function public.set_deal_simple_status(uuid,public.simple_status,text,public.simple_status) to authenticated;

create or replace function public.archive_deal_safely(
  p_deal_id uuid, p_archive boolean, p_reason text default null, p_note text default null
) returns void language plpgsql security invoker set search_path = public as $$
declare d public.deals%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then
    raise exception 'この操作は営業・管理者のみ利用できます';
  end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if p_archive then
    if p_reason is null or p_reason not in ('completed','cancelled','lost','other') then
      raise exception 'クローズ理由を選んでください';
    end if;
    if p_reason = 'completed' and d.simple_status <> 'delivered' then
      raise exception '納品完了を確認してから完了としてクローズしてください';
    end if;
    if d.archived_at is not null then return; end if;
    update public.deals set archived_at=now(),archived_by=auth.uid(),archive_reason=p_reason,
      archive_note=nullif(trim(p_note),''),last_activity_at=now() where id=d.id;
  else
    if d.archived_at is null then return; end if;
    update public.deals set archived_at=null,archived_by=null,archive_reason=null,last_activity_at=now() where id=d.id;
  end if;
  insert into public.deal_status_history
    (deal_id,from_status,to_status,from_simple_status,to_simple_status,changed_by,note,kind)
  values(d.id,d.master_status,d.master_status,d.simple_status,d.simple_status,auth.uid(),
    case when p_archive then '案件をクローズ ('||p_reason||')' else '案件を再開' end
      ||case when nullif(trim(p_note),'') is not null then ': '||trim(p_note) else '' end,'status');
end $$;
revoke all on function public.archive_deal_safely(uuid,boolean,text,text) from public, anon;
grant execute on function public.archive_deal_safely(uuid,boolean,text,text) to authenticated;
