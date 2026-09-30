// Runs only an in-memory Postgres instance. No credentials or external DB access.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const db = new PGlite()
const deal = '00000000-0000-0000-0000-000000000001'
const variant = '00000000-0000-0000-0000-000000000002'
const product = '00000000-0000-0000-0000-000000000003'
const ids = [10, 11, 12, 13, 14, 15].map(n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`)
try {
  await db.exec(`create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '${deal}'::uuid $$;
    create function public.is_staff() returns boolean language sql as $$ select current_setting('test.staff',true)='true' $$;
    create table deals(id uuid primary key, archived_at timestamptz);
    create table deal_products(id uuid primary key, deal_id uuid);
    create table deal_product_variants(id uuid primary key, product_id uuid);
    create table deal_quotes(id uuid primary key, deal_id uuid, variant_id uuid, spec_id uuid, quantity integer, factory_unit_price_usd numeric, selling_price_jpy numeric, total_billing_jpy numeric, total_billing_tax_jpy numeric, status text, updated_at timestamptz, moq integer, exchange_rate numeric, cost_ratio numeric);
    insert into deals values('${deal}',null);
    insert into deal_products values('${product}','${deal}');
    insert into deal_product_variants values('${variant}','${product}');
    set test.staff='true';`)
  await db.exec(readFileSync('supabase/migrations/040_select_quote_atomic.sql', 'utf8'))
  for (const [i,id] of ids.entries()) {
    const v = i < 3 ? `'${variant}'` : 'null'
    await db.exec(`insert into deal_quotes values('${id}','${deal}',${v},null,100,1,300,30000,33000,'${[0,3].includes(i)?'approved':'drafting'}',null,null,150,0.5)`)
  }
  const select = id => db.query('select public.select_quote_atomic($1::uuid)', [id])
  const statuses = async () => (await db.query('select id,status from deal_quotes order by id')).rows.map(r=>r.status)
  await select(ids[1])
  assert.deepEqual(await statuses(), ['rejected','approved','drafting','approved','drafting','drafting'])
  await select(ids[1]) // idempotent
  assert.equal((await statuses())[1], 'approved')
  await select(ids[4]) // legacy deal-wide quote stays separate from variants
  assert.deepEqual(await statuses(), ['rejected','approved','drafting','rejected','approved','drafting'])
  await db.exec(`update deal_quotes set selling_price_jpy=null where id='${ids[2]}'`)
  await assert.rejects(select(ids[2]), /計算してから/)
  assert.equal((await statuses())[1], 'approved')
  await db.exec(`update deals set archived_at=now()`)
  await assert.rejects(select(ids[1]), /アーカイブ/)
  await db.exec(`update deals set archived_at=null; set test.staff='false'`)
  await assert.rejects(select(ids[1]), /営業・管理者/)
  await db.exec(`set test.staff='true'; update deal_quotes set selling_price_jpy=300 where id='${ids[2]}';
    create function force_quote_failure() returns trigger language plpgsql as $$ begin if new.id='${ids[2]}'::uuid and new.status='approved' then raise exception 'forced failure'; end if; return new; end $$;
    create trigger fail_approval before update on deal_quotes for each row execute function force_quote_failure();`)
  await assert.rejects(select(ids[2]), /forced failure/)
  assert.equal((await statuses())[1], 'approved', 'prior approval must survive failed switch')
  assert.equal((await statuses())[2], 'drafting')
  await db.exec(`update deal_quotes set moq=101 where id='${ids[1]}'`)
  await assert.rejects(select(ids[1]), /MOQ/)
  await db.exec(`update deal_quotes set moq=100 where id='${ids[1]}'`)
  await select(ids[1]) // boundary accepted
  for (const [column, values] of [['exchange_rate', ['0', '-1', 'null', "'NaN'", "'Infinity'"]], ['cost_ratio', ['0', '-0.1', '1.1', 'null', "'NaN'"]]]) {
    for (const value of values) {
      await db.exec(`update deal_quotes set ${column}=${value} where id='${ids[1]}'`)
      await assert.rejects(select(ids[1]), column==='exchange_rate' ? /為替/ : /掛け率/)
      assert.equal((await statuses())[1], 'approved')
    }
    await db.exec(`update deal_quotes set ${column}=${column==='exchange_rate' ? 150 : 0.5} where id='${ids[1]}'`)
  }
  await db.exec(`create or replace function public.is_staff() returns boolean language sql as $$ select null::boolean $$`)
  await assert.rejects(select(ids[1]), /営業・管理者/)
  await db.exec(`create or replace function public.is_staff() returns boolean language sql as $$ select current_setting('test.staff',true)='true' $$`)
  const spec = '00000000-0000-0000-0000-000000000099'
  const specOld = '00000000-0000-0000-0000-000000000098'
  const specNew = '00000000-0000-0000-0000-000000000097'
  await db.exec(`insert into deal_quotes values('${specOld}','${deal}',null,'${spec}',100,1,300,30000,33000,'approved',null,null,150,0.5),('${specNew}','${deal}',null,'${spec}',100,1,300,30000,33000,'drafting',null,null,150,0.5)` )
  await select(specNew)
  assert.equal((await db.query('select status from deal_quotes where id=$1',[specOld])).rows[0].status,'rejected')
  assert.equal((await statuses())[4],'approved', 'legacy specification must not reject deal-wide quote')
  console.log('PASS: atomic selection, separate groups, idempotence, price/MOQ/rate/archive/role/null guards, forced rollback')
} finally { await db.close() }
