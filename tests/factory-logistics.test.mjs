import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile,readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const ids={client:'11111111-1111-4111-8111-111111111111',other:'22222222-2222-4222-8222-222222222222',deal:'33333333-3333-4333-8333-333333333333',factory:'44444444-4444-4444-8444-444444444444',otherFactory:'55555555-5555-4555-8555-555555555555',variant:'66666666-6666-4666-8666-666666666666',product:'77777777-7777-4777-8777-777777777777',quote:'88888888-8888-4888-8888-888888888888',user:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}
const sqlFile=async prefix=>{const dir=new URL('../supabase/migrations/',import.meta.url);const files=await readdir(dir);return readFile(new URL(files.find(f=>f.startsWith(prefix)),dir),'utf8')}
async function setup(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;alter default privileges in schema public grant all on tables to authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${ids.user}'::uuid$$;
 create function current_app_role() returns text language sql as $$select current_setting('test.role',true)$$;
 create function is_staff() returns boolean language sql as $$select coalesce(current_app_role() in ('sales','admin'),false)$$;
 create function is_logistics() returns boolean language sql as $$select coalesce(current_app_role()='logistics',false)$$;
 create function my_client_id() returns uuid language sql as $$select '${ids.client}'::uuid$$;
 create function my_factory_id() returns uuid language sql as $$select '${ids.factory}'::uuid$$;
 create function update_updated_at_column() returns trigger language plpgsql as $$begin NEW.updated_at=now();return NEW;end$$;
 create table profiles(id uuid primary key);insert into profiles values('${ids.user}');
 create table clients(id uuid primary key);insert into clients values('${ids.client}'),('${ids.other}');
 create table factories(id uuid primary key,factory_name text);insert into factories values('${ids.factory}','工場A'),('${ids.otherFactory}','工場B');
 create table deals(id uuid primary key,client_id uuid,simple_status text,archived_at timestamptz,desired_delivery_date date);
 insert into deals values('${ids.deal}','${ids.client}','data_confirmed',null,'2026-12-01');
 create table deal_products(id uuid primary key,deal_id uuid,description text);insert into deal_products(id,deal_id) values('${ids.product}','${ids.deal}');
 create table deal_product_variants(id uuid primary key,product_id uuid,variant_label text,material text,width_mm numeric,height_mm numeric,depth_mm numeric,print_color_count text,pcs_per_carton integer);
 insert into deal_product_variants values('${ids.variant}','${ids.product}','袋','紙',100,150,null,'1',100);
 create table deal_quotes(id uuid primary key,deal_id uuid,variant_id uuid,factory_id uuid,status text,quantity integer,moq integer,factory_unit_price_usd numeric,factory_response jsonb);
 insert into deal_quotes(id,deal_id,variant_id,factory_id,status,quantity,moq,factory_unit_price_usd) values('${ids.quote}','${ids.deal}','${ids.variant}',null,'approved',1000,500,0.2);
 update deal_quotes set factory_response='{"line":{"pcs_per_carton":200,"carton_w_cm":40}}';
 set test.role='sales';`)
 await db.exec(await sqlFile('031'));await db.exec((await sqlFile('035')).split('-- アカウント招待の受け取り')[0]);await db.exec(await sqlFile('038'));await db.exec(await sqlFile('044'));
 assert.equal((await db.query("select has_table_privilege('authenticated','factory_purchase_orders','UPDATE') can_update")).rows[0].can_update,false,'migration must revoke grants inherited from Supabase default privileges');
 await db.exec(`drop policy authenticated_full_access on inventory_items;drop policy authenticated_full_access on inventory_transactions;
 create policy staff_access on inventory_items for all to authenticated using(is_staff()) with check(is_staff());
 create policy logistics_access on inventory_items for all to authenticated using(is_logistics()) with check(is_logistics());
 create policy client_read on inventory_items for select to authenticated using(current_app_role()='client' and client_id=my_client_id());
 create policy staff_access on inventory_transactions for all to authenticated using(is_staff()) with check(is_staff());
 create policy logistics_access on inventory_transactions for all to authenticated using(is_logistics()) with check(is_logistics());
 grant usage on schema auth to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;
 revoke update,delete on inventory_transactions from authenticated;revoke update,delete on factory_purchase_orders from authenticated;
 alter table deals enable row level security;create policy staff_deals on deals for all to authenticated using(is_staff()) with check(is_staff());`)
 return db
}
async function rpc(db,name,...args){return (await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result}
async function asRole(db,role,fn){await db.exec(`set test.role='${role}';set role authenticated`);try{return await fn()}finally{await db.exec("reset role;set test.role='sales'")}}
test('factory order → inbound → client request → logistics with role isolation',async t=>{
 const db=await setup();t.after(()=>db.close());let order,shipment,line,item,request;
 await t.test('production blocked before factory order',async()=>{await assert.rejects(db.query("update deals set simple_status='in_production' where id=$1",[ids.deal]),/工場発注/)})
 await t.test('client/factory/logistics cannot create purchase order',async()=>{for(const role of ['client','factory','logistics','']) await asRole(db,role,async()=>assert.rejects(rpc(db,'create_factory_order_atomic',ids.quote,ids.factory,'PO-denied'),/営業・管理者/))})
 await t.test('late quote-write failure rolls back new purchase order',async()=>{
  await db.exec(`create function fail_order_test() returns trigger language plpgsql as $$begin raise exception 'forced quote write failure';end$$;create trigger fail_order_test before update of factory_id on deal_quotes for each row execute function fail_order_test();`);
  await assert.rejects(rpc(db,'create_factory_order_atomic',ids.quote,ids.factory,'PO-fail'),/forced quote write failure/);
  assert.equal((await db.query('select count(*)::int n from factory_purchase_orders')).rows[0].n,0);
  assert.equal((await db.query('select factory_id from deal_quotes where id=$1',[ids.quote])).rows[0].factory_id,null);
  await db.exec('drop trigger fail_order_test on deal_quotes');
 })
 await t.test('staff creates order once and immutable snapshot excludes sales price',async()=>{const a=await asRole(db,'sales',()=>rpc(db,'create_factory_order_atomic',ids.quote,ids.factory,'PO-1'));order=a.orderId;const b=await rpc(db,'create_factory_order_atomic',ids.quote,ids.factory,'PO-retry');assert.equal(b.orderId,order);await assert.rejects(rpc(db,'create_factory_order_atomic',ids.quote,ids.otherFactory,'PO-wrong'),/一致/);const row=(await db.query('select * from factory_purchase_orders')).rows[0];assert.equal(row.quantity,1000);assert.equal(row.snapshot.pcs_per_carton,200);assert.equal(row.snapshot.carton_width_cm,40);assert.equal(row.snapshot.selling_price_jpy,undefined);await asRole(db,'sales',async()=>assert.rejects(db.query('update factory_purchase_orders set quantity=1'),/permission denied/));await db.query("update deals set simple_status='in_production' where id=$1",[ids.deal])})
 await t.test('factory reads own order only; client/logistics cannot see purchase prices',async()=>{await db.query('insert into factory_purchase_orders(order_no,deal_id,factory_id,quantity,unit_price_usd,snapshot) values($1,$2,$3,10,0.3,$4)',['PO-other',ids.deal,ids.otherFactory,{}]);await asRole(db,'factory',async()=>assert.equal((await db.query('select * from factory_purchase_orders')).rows.length,1));for(const role of ['client','logistics']) await asRole(db,role,async()=>assert.equal((await db.query('select * from factory_purchase_orders')).rows.length,0))})
 await t.test('order drives client/deal in inbound and prevents mismatched client',async()=>{await assert.rejects(rpc(db,'create_inbound_shipment_atomic',{purchase_order_id:order,client_id:ids.other,lines:[{item_name:'袋',expected_quantity:1000}]},'IB-other'),/クライアント/);await rpc(db,'create_inbound_shipment_atomic',{purchase_order_id:order,request_key:'full-plan',lines:[{item_name:'袋',expected_quantity:1000}]},'IB-order');const s=(await db.query("select * from inbound_shipments where shipment_no='IB-order'")).rows[0];shipment=s.id;const retry=await rpc(db,'create_inbound_shipment_atomic',{purchase_order_id:order,request_key:'full-plan',lines:[{item_name:'袋',expected_quantity:1000}]},'IB-retry');assert.equal(retry.shipmentId,shipment);assert.equal(s.client_id,ids.client);assert.equal(s.deal_id,ids.deal);line=(await db.query('select id from inbound_shipment_items where shipment_id=$1',[shipment])).rows[0].id;await assert.rejects(rpc(db,'create_inbound_shipment_atomic',{purchase_order_id:order,lines:[{item_name:'袋',expected_quantity:1}]},'IB-over'),/超え/)})
 await t.test('logistics receives without access to internal deals and client views own stock',async()=>{await asRole(db,'logistics',async()=>assert.rejects(rpc(db,'receive_inbound_shipment_atomic',shipment,[{line_id:line,received_quantity:1001}]),/超え/));await asRole(db,'logistics',()=>rpc(db,'receive_inbound_shipment_atomic',shipment,[{line_id:line,received_quantity:1000}]));item=(await db.query('select item_id from inbound_shipment_items where id=$1',[line])).rows[0].item_id;await asRole(db,'client',async()=>assert.equal((await db.query('select quantity_on_hand from inventory_items')).rows[0].quantity_on_hand,1000));await asRole(db,'factory',async()=>assert.equal((await db.query('select * from inventory_items')).rows.length,0))})
 await t.test('client requests; warehouse cannot bypass staff approval; confirmed shipment deducts once',async()=>{await asRole(db,'client',()=>rpc(db,'create_shipment_request_atomic',{destination_name:'店舗',items:[{item_id:item,quantity:100}]},'SR-ordered'));request=(await db.query("select id from shipment_requests where request_no='SR-ordered'")).rows[0].id;await asRole(db,'logistics',async()=>{await assert.rejects(db.query("update shipment_requests set status='confirmed' where id=$1",[request]),/営業・管理者/);await assert.rejects(rpc(db,'ship_shipment_request_atomic',request),/確認/)});await asRole(db,'admin',()=>db.query("update shipment_requests set status='confirmed' where id=$1",[request]));await asRole(db,'logistics',()=>rpc(db,'ship_shipment_request_atomic',request));assert.equal((await db.query('select quantity_on_hand from inventory_items where id=$1',[item])).rows[0].quantity_on_hand,900);await asRole(db,'logistics',()=>db.query("update shipment_requests set status='delivered' where id=$1",[request]))})
})
