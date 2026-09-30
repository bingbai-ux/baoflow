-- Prepared locally only; do not apply before staging validation.
-- Rollback: drop function public.select_quote_atomic(uuid); redeploy prior action.
-- Existing approved rows are preserved until the complete switch succeeds.
create or replace function public.select_quote_atomic(p_quote_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare q public.deal_quotes; d public.deals;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then
    raise exception 'この操作は営業・管理者のみ利用できます';
  end if;
  select * into q from public.deal_quotes where id = p_quote_id;
  if not found then raise exception '見積が見つかりません'; end if;
  -- Serialize quote selection per deal. Always lock the parent before quote rows.
  select * into d from public.deals where id = q.deal_id for update;
  if not found then raise exception '案件が見つかりません'; end if;
  if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
  select * into q from public.deal_quotes where id = p_quote_id and deal_id = d.id for update;
  if not found then raise exception '見積が見つかりません'; end if;
  if q.quantity is null or q.quantity <= 0 or
     q.factory_unit_price_usd is null or q.factory_unit_price_usd <= 0 or
     q.selling_price_jpy is null or q.selling_price_jpy <= 0 or
     q.total_billing_jpy is null or q.total_billing_jpy <= 0 or
     q.total_billing_tax_jpy is null or q.total_billing_tax_jpy <= 0 or
     q.factory_unit_price_usd::text in ('NaN','Infinity','-Infinity') or
     q.selling_price_jpy::text in ('NaN','Infinity','-Infinity') or
     q.total_billing_jpy::text in ('NaN','Infinity','-Infinity') or
     q.total_billing_tax_jpy::text in ('NaN','Infinity','-Infinity') then
    raise exception '単価と数量を入力して見積を計算してから採用してください';
  end if;
  if q.moq is not null and (q.moq <= 0 or q.quantity < q.moq) then
    raise exception '数量が最小注文数量 (MOQ) を満たしていません';
  end if;
  if q.exchange_rate is null or q.exchange_rate <= 0 or
     q.exchange_rate::text in ('NaN','Infinity','-Infinity') then
    raise exception '為替レートは0より大きい有限の値で入力してください';
  end if;
  if q.cost_ratio is null or q.cost_ratio <= 0 or q.cost_ratio > 1 or
     q.cost_ratio::text in ('NaN','Infinity','-Infinity') then
    raise exception '掛け率は0より大きく1以下の有限の値で入力してください';
  end if;
  if q.variant_id is not null and not exists (
    select 1 from public.deal_product_variants v join public.deal_products p on p.id=v.product_id
    where v.id=q.variant_id and p.deal_id=q.deal_id
  ) then raise exception '仕様がこの案件に属していません'; end if;
  update public.deal_quotes set status='rejected', updated_at=now()
    where deal_id=q.deal_id and id<>q.id and status='approved' and (
      (q.variant_id is not null and variant_id=q.variant_id) or
      (q.variant_id is null and q.spec_id is not null and variant_id is null and spec_id=q.spec_id) or
      (q.variant_id is null and q.spec_id is null and variant_id is null and spec_id is null)
    );
  update public.deal_quotes set status='approved', updated_at=now() where id=q.id;
  if not found then raise exception '見積を採用する権限がありません'; end if;
  return jsonb_build_object('success',true,'deal_id',q.deal_id);
end $$;
revoke all on function public.select_quote_atomic(uuid) from public;
grant execute on function public.select_quote_atomic(uuid) to authenticated;
