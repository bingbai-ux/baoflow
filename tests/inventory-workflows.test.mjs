import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const client = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
async function setup() {
  const db = new PGlite()
  await db.exec(`create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '${user}'::uuid $$;
    create function public.current_app_role() returns text language sql as $$ select coalesce(current_setting('test.app_role',true),'sales') $$;
    create function public.is_staff() returns boolean language sql as $$ select public.current_app_role() in ('sales','admin') $$;
    create function public.is_logistics() returns boolean language sql as $$ select public.current_app_role()='logistics' $$;
    create function public.my_client_id() returns uuid language sql as $$ select '${client}'::uuid $$;
    create function update_updated_at_column() returns trigger language plpgsql as $$ begin NEW.updated_at=now();return NEW;end $$;
    create table clients(id uuid primary key); create table deals(id uuid primary key); create table deal_products(id uuid primary key);
    create table profiles(id uuid primary key); insert into profiles values('${user}'); insert into clients values('${client}'),('${other}');`)
  await db.exec(await readFile(new URL('../supabase/migrations/031_sprint10_waiting_on_and_inventory.sql', import.meta.url),'utf8'))
  const migration35 = await readFile(new URL('../supabase/migrations/035_inventory_service.sql', import.meta.url),'utf8').catch(async()=> {
    const {readdir}=await import('node:fs/promises');const files=await readdir(new URL('../supabase/migrations/',import.meta.url));
    return readFile(new URL('../supabase/migrations/'+files.find(f=>f.startsWith('035')),import.meta.url),'utf8')
  })
  await db.exec(migration35.split('-- アカウント招待の受け取り')[0])
  await db.exec(`drop policy authenticated_full_access on inventory_items;
    create policy staff_access on inventory_items for all to authenticated using(public.is_staff()) with check(public.is_staff());
    create policy client_read on inventory_items for select to authenticated using(client_id=public.my_client_id());
    grant usage on schema auth to authenticated; grant all on all tables in schema public to authenticated;`)
  await db.exec(await readFile(new URL('../supabase/migrations/038_inventory_atomic_workflows.sql',import.meta.url),'utf8'))
  return db
}
async function rpc(db,name,...args) { return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result }
async function count(db,table) { return Number((await db.query(`select count(*) n from ${table}`)).rows[0].n) }
async function stock(db,id) { return (await db.query('select quantity_on_hand from inventory_items where id=$1',[id])).rows[0].quantity_on_hand }
async function item(db,qty=10,c=client) { return (await rpc(db,'create_inventory_item_atomic',{client_id:c,item_name:'袋',first_quantity:qty})).itemId }
async function request(db,id,qty=3,no='SR-1') { await rpc(db,'create_shipment_request_atomic',{client_id:client,destination_name:'店舗',items:[{item_id:id,quantity:qty}]},no);return (await db.query('select id from shipment_requests where request_no=$1',[no])).rows[0].id }

test('inventory atomic workflows: regression cases without external services',async(t)=>{
 const db=await setup();t.after(()=>db.close())
 await t.test('fractional quantity is rejected without creating parent',async()=>{
  const n=await count(db,'inventory_items');await assert.rejects(rpc(db,'create_inventory_item_atomic',{item_name:'袋',first_quantity:0.5}),/整数/);assert.equal(await count(db,'inventory_items'),n)
 })
 await t.test('duplicate lines count against total stock and leave no partial outbound',async()=>{
  const id=await item(db);await rpc(db,'create_shipment_request_atomic',{client_id:client,destination_name:'店舗',items:[{item_id:id,quantity:6},{item_id:id,quantity:6}]},'SR-duplicate');const r=(await db.query("update shipment_requests set status='confirmed' where request_no='SR-duplicate' returning id")).rows[0].id;
  await assert.rejects(rpc(db,'ship_shipment_request_atomic',r),/在庫不足/);assert.equal(await stock(db,id),10);assert.equal((await db.query('select status from shipment_requests where id=$1',[r])).rows[0].status,'confirmed')
 })
 await t.test('approval required; successful shipment retry cannot deduct stock twice',async()=>{
  const id=await item(db);const r=await request(db,id);await assert.rejects(rpc(db,'ship_shipment_request_atomic',r),/確認/);await db.query("update shipment_requests set status='confirmed' where id=$1",[r]);await rpc(db,'ship_shipment_request_atomic',r);await rpc(db,'ship_shipment_request_atomic',r);assert.equal(await stock(db,id),7)
 })
 await t.test('client cannot request another client inventory; no empty request remains',async()=>{
  const id=await item(db,10,other);const n=await count(db,'shipment_requests');await db.exec("set test.app_role='client'");await assert.rejects(rpc(db,'create_shipment_request_atomic',{client_id:other,destination_name:'店舗',items:[{item_id:id,quantity:1}]},'SR-other'),/クライアント/);assert.equal(await count(db,'shipment_requests'),n);await db.exec("set test.app_role='sales'")
 })
 await t.test('zero-row or missing-row receipt is rejected; retry adds once',async()=>{
  await rpc(db,'create_inbound_shipment_atomic',{client_id:client,lines:[{item_name:'箱',expected_quantity:5}]},'IB-1');const s=(await db.query("select id from inbound_shipments where shipment_no='IB-1'")).rows[0].id;const l=(await db.query('select id from inbound_shipment_items where shipment_id=$1',[s])).rows[0].id;
  await assert.rejects(rpc(db,'receive_inbound_shipment_atomic',s,[]),/明細/);await assert.rejects(rpc(db,'receive_inbound_shipment_atomic',s,[{line_id:l}]),/整数/);await rpc(db,'receive_inbound_shipment_atomic',s,[{line_id:l,received_quantity:5}]);await rpc(db,'receive_inbound_shipment_atomic',s,[{line_id:l,received_quantity:5}]);const id=(await db.query('select item_id from inbound_shipment_items where id=$1',[l])).rows[0].item_id;assert.equal(await stock(db,id),5)
 })
 await t.test('late failure rolls back all stock deductions and request status',async()=>{
  const a=await item(db),b=await item(db);await rpc(db,'create_shipment_request_atomic',{client_id:client,destination_name:'店舗',items:[{item_id:a,quantity:2},{item_id:b,quantity:2}]},'SR-fail');const r=(await db.query("update shipment_requests set status='confirmed' where request_no='SR-fail' returning id")).rows[0].id;
  await db.exec(`create function fail_test_tx() returns trigger language plpgsql as $$ begin if NEW.item_id='${b}' and NEW.tx_type='outbound' then raise exception 'injected failure';end if;return NEW;end $$;create trigger test_failure before insert on inventory_transactions for each row execute function fail_test_tx();`);
  await assert.rejects(rpc(db,'ship_shipment_request_atomic',r),/injected failure/);assert.equal(await stock(db,a),10);assert.equal(await stock(db,b),10);assert.equal((await db.query('select status from shipment_requests where id=$1',[r])).rows[0].status,'confirmed');await db.exec('drop trigger test_failure on inventory_transactions')
 })
 await t.test('negative adjustment and cartons underflow reject before any ledger write',async()=>{
  const id=await item(db);const n=await count(db,'inventory_transactions');await assert.rejects(rpc(db,'record_inventory_transaction_atomic',{item_id:id,tx_type:'adjust',quantity:-11}),/足りません/);await assert.rejects(rpc(db,'record_inventory_transaction_atomic',{item_id:id,tx_type:'outbound',quantity:1,cartons_delta:-1}),/カートン/);assert.equal(await count(db,'inventory_transactions'),n);assert.equal(await stock(db,id),10)
 })
 await t.test('receipt failure after the first transaction rolls back all received lines',async()=>{
  await rpc(db,'create_inbound_shipment_atomic',{client_id:client,lines:[{item_name:'A',expected_quantity:5},{item_name:'B',expected_quantity:5}]},'IB-fail');
  const shipment=(await db.query("select id from inbound_shipments where shipment_no='IB-fail'")).rows[0].id;
  const lines=(await db.query('select id from inbound_shipment_items where shipment_id=$1 order by id',[shipment])).rows;
  const n=await count(db,'inventory_items');
  await db.exec(`create function fail_receipt_test() returns trigger language plpgsql as $$ begin if NEW.item_name='B' then raise exception 'receipt failure'; end if;return NEW;end $$;create trigger receipt_failure before insert on inventory_items for each row execute function fail_receipt_test();`);
  await assert.rejects(rpc(db,'receive_inbound_shipment_atomic',shipment,lines.map(l=>({line_id:l.id,received_quantity:5}))),/receipt failure/);
  assert.equal(await count(db,'inventory_items'),n);assert.equal((await db.query('select status from inbound_shipments where id=$1',[shipment])).rows[0].status,'in_transit');
  assert.ok((await db.query('select received_quantity from inbound_shipment_items where shipment_id=$1',[shipment])).rows.every(l=>l.received_quantity===null));
  await db.exec('drop trigger receipt_failure on inventory_items');
 })
 await t.test('RLS blocks direct other-client line insertion under authenticated role',async()=>{
  const own=await item(db),foreign=await item(db,10,other),r=await request(db,own,1,'SR-rls');
  await db.exec("set test.app_role='client'; set role authenticated");
  try {
   await assert.rejects(db.query('delete from inventory_transactions where item_id=$1',[own]),/permission denied/);
   await db.query('insert into shipment_request_items(request_id,item_id,quantity) values($1,$2,1)',[r,own]);
   await assert.rejects(db.query('insert into shipment_request_items(request_id,item_id,quantity) values($1,$2,1)',[r,foreign]),/row-level security/);
  } finally {await db.exec("reset role; set test.app_role='sales'")}
 })
 await t.test('external role cannot receive or ship',async()=>{
  await db.exec("set test.app_role='client'");await assert.rejects(rpc(db,'ship_shipment_request_atomic',client),/権限/);await assert.rejects(rpc(db,'receive_inbound_shipment_atomic',client,[]),/権限/);await db.exec("set test.app_role='sales'")
 })
})
