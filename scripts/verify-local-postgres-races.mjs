// ONLY the explicitly authorized, isolated local Supabase container. No URLs/credentials.
// Synthetic rows use random UUIDs and are cleaned in finally; no other containers are inspected.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const docker='/opt/homebrew/bin/docker', context='colima', container='supabase_db_baoflow-codex-20260930'
const runId=randomUUID(), app=`bao-race-${runId.slice(0,8)}`
const id=Object.fromEntries(['admin','sales','clientUser','logistics','factoryUser','factoryOtherUser','client','otherClient','factory','otherFactory','deal','product','variant','q1','q2','stock1','stock2','stock3','otherStock','r1','r2','r3','receive','receiveLine'].map(k=>[k,randomUUID()]))
const dockerRun=args=>new Promise(resolve=>{const p=spawn(docker,['--context',context,...args],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',e=>resolve({code:-1,stdout,stderr:e.message}));p.on('close',code=>resolve({code,stdout,stderr}));p.stdin.end()})
function raw(sql){return new Promise(resolve=>{const p=spawn(docker,['--context',context,'exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',e=>resolve({code:-1,stdout,stderr:e.message}));p.on('close',code=>resolve({code,stdout,stderr}));p.stdin.end(sql)})}
async function sql(text){const r=await raw(text);assert.equal(r.code,0,r.stderr);return r.stdout.trim()}
function auth(user,role='authenticated'){return `set local role ${role};select set_config('request.jwt.claim.sub','${user||''}',true);select set_config('request.jwt.claims','${JSON.stringify(user?{sub:user,role}:{role})}',true);`}
const tx=(user,text,hold=0,name=app)=>raw(`begin;set local application_name='${name}';set local statement_timeout='8s';${auth(user)}${text};${hold?`select pg_sleep(${hold});`:''}commit;`)
const number=async q=>Number(await sql(q))
const scalar=async(user,q)=>{const r=await tx(user,q);assert.equal(r.code,0,r.stderr);return r.stdout.trim().split('\n').at(-1)}
async function race(label,user,a,b,{oneFails=false,sameResult=false}={}){
 const name=`${app}-${label}`;const pa=tx(user,a,1.5,name);let holding=false;
 for(let i=0;i<10;i++){if(await number(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep'`)>0){holding=true;break}await new Promise(r=>setTimeout(r,80))}
 if(!holding){const failure=await pa;assert.fail(`${label}: first transaction did not hold lock: ${failure.stderr}`)}const pb=tx(user,b,0,name);
 let blocked=false;
 for(let i=0;i<6;i++){await new Promise(r=>setTimeout(r,90));if(await number(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event_type='Lock'`)>0){blocked=true;break}}
 const results=await Promise.all([pa,pb]);assert.ok(blocked,`${label}: no database lock wait observed`);
 assert.equal(results.filter(r=>r.code===0).length,oneFails?1:2,results.map(r=>r.stderr).join('\n'));
 if(oneFails) assert.match(results.find(r=>r.code!==0).stderr,/在庫|足りません|超え/);
 if(sameResult){const parsed=results.map(r=>JSON.parse(r.stdout.split('\n').find(line=>line.startsWith('{'))));assert.equal(parsed[0].orderId,parsed[1].orderId)}
 console.log(`PASS ${label}: separate connections observed lock wait; ${oneFails?'one safely rejected':'both completed safely'}`)
}
async function denied(user,statement,pattern){const r=await tx(user,statement);assert.notEqual(r.code,0,'forbidden operation succeeded');if(pattern)assert.match(r.stderr,pattern)}
let seeded=false;
try{
 const inspect=await dockerRun(['inspect','--format','{{.Name}}',container]);assert.equal(inspect.code,0,`Authorized isolated container is not available: ${inspect.stderr}`);assert.equal(inspect.stdout.trim(),'/'+container)
 assert.equal(await sql(`select current_database()='postgres' and to_regprocedure('public.issue_document_atomic(uuid,uuid,text,jsonb,jsonb)') is not null and to_regprocedure('public.create_factory_order_atomic(uuid,uuid,text)') is not null`),'t','Local schema is not ready through migration 047')
 // All values below are synthetic, unrelated to customer records.
 await sql(`begin;
 insert into clients(id,company_name) values('${id.client}','Synthetic race ${runId}'),('${id.otherClient}','Synthetic other ${runId}');
 insert into factories(id,factory_name,basic_info_completed) values('${id.factory}','Synthetic factory ${runId}',true),('${id.otherFactory}','Synthetic other factory ${runId}',true);
 insert into auth.users(id,email,aud,role,raw_user_meta_data) values
 ${['admin','sales','clientUser','logistics','factoryUser','factoryOtherUser'].map(k=>`('${id[k]}','race-${k}-${runId}@example.invalid','authenticated','authenticated','{}')`).join(',')};
 update profiles set role='admin' where id='${id.admin}';update profiles set role='sales' where id='${id.sales}';
 update profiles set role='client',client_id='${id.client}' where id='${id.clientUser}';update profiles set role='logistics' where id='${id.logistics}';
 update profiles set role='factory',factory_id='${id.factory}' where id='${id.factoryUser}';update profiles set role='factory',factory_id='${id.otherFactory}' where id='${id.factoryOtherUser}';
 insert into deals(id,deal_code,deal_name,client_id,sales_user_id,simple_status) values('${id.deal}','RACE-${runId}','Synthetic concurrency ${runId}','${id.client}','${id.sales}','data_confirmed');
 insert into deal_products(id,deal_id,product_no,description) values('${id.product}','${id.deal}',1,'Synthetic bags');
 insert into deal_product_variants(id,product_id,variant_label,pcs_per_carton) values('${id.variant}','${id.product}','Synthetic specification',100);
 insert into deal_quotes(id,deal_id,variant_id,quantity,moq,factory_unit_price_usd,selling_price_jpy,total_billing_jpy,total_billing_tax_jpy,cost_ratio,exchange_rate,status)
 values('${id.q1}','${id.deal}','${id.variant}',100,50,1,300,30000,33000,0.5,150,'drafting'),('${id.q2}','${id.deal}','${id.variant}',200,50,1,300,60000,66000,0.5,150,'drafting');
 insert into inventory_items(id,client_id,item_name) values('${id.stock1}','${id.client}','Synthetic same request'),('${id.stock2}','${id.client}','Synthetic oversell'),('${id.stock3}','${id.client}','Synthetic manual'),('${id.otherStock}','${id.otherClient}','Synthetic other company');
 insert into inventory_transactions(item_id,tx_type,quantity_delta,created_by) values('${id.stock1}','inbound',10,'${id.sales}'),('${id.stock2}','inbound',10,'${id.sales}'),('${id.stock3}','inbound',10,'${id.sales}'),('${id.otherStock}','inbound',10,'${id.sales}');
 insert into shipment_requests(id,request_no,client_id,status,requested_by) values('${id.r1}','R1-${runId}','${id.client}','confirmed','${id.clientUser}'),('${id.r2}','R2-${runId}','${id.client}','confirmed','${id.clientUser}'),('${id.r3}','R3-${runId}','${id.client}','confirmed','${id.clientUser}');
 insert into shipment_request_items(request_id,item_id,quantity) values('${id.r1}','${id.stock1}',6),('${id.r2}','${id.stock2}',6),('${id.r3}','${id.stock2}',6);
 insert into inbound_shipments(id,shipment_no,client_id,created_by) values('${id.receive}','IB-${runId}','${id.client}','${id.sales}');
 insert into inbound_shipment_items(id,shipment_id,item_name,expected_quantity) values('${id.receiveLine}','${id.receive}','Synthetic receipt',5);
 commit;`);seeded=true
 await race('same-shipment',id.logistics,`select ship_shipment_request_atomic('${id.r1}')`,`select ship_shipment_request_atomic('${id.r1}')`)
 assert.equal(await number(`select quantity_on_hand from inventory_items where id='${id.stock1}'`),4);assert.equal(await number(`select count(*) from inventory_transactions where item_id='${id.stock1}' and tx_type='outbound'`),1)
 await race('oversell',id.logistics,`select ship_shipment_request_atomic('${id.r2}')`,`select ship_shipment_request_atomic('${id.r3}')`,{oneFails:true});assert.equal(await number(`select quantity_on_hand from inventory_items where id='${id.stock2}'`),4)
 await race('same-receipt',id.logistics,`select receive_inbound_shipment_atomic('${id.receive}','[{"line_id":"${id.receiveLine}","received_quantity":5}]')`,`select receive_inbound_shipment_atomic('${id.receive}','[{"line_id":"${id.receiveLine}","received_quantity":5}]')`);assert.equal(await number(`select quantity_on_hand from inventory_items where id=(select item_id from inbound_shipment_items where id='${id.receiveLine}')`),5)
 const manual=`select record_inventory_transaction_atomic('{"item_id":"${id.stock3}","tx_type":"outbound","quantity":7}')`
 await race('manual-oversell',id.logistics,manual,manual,{oneFails:true});assert.equal(await number(`select quantity_on_hand from inventory_items where id='${id.stock3}'`),3)
 await race('quote-selection',id.sales,`select select_quote_atomic('${id.q1}')`,`select select_quote_atomic('${id.q2}')`);assert.equal(await number(`select count(*) from deal_quotes where deal_id='${id.deal}' and status='approved'`),1)
 const selected=await sql(`select id from deal_quotes where deal_id='${id.deal}' and status='approved'`)
 await race('same-factory-order',id.sales,`select create_factory_order_atomic('${selected}','${id.factory}','PO-A-${runId}')`,`select create_factory_order_atomic('${selected}','${id.factory}','PO-B-${runId}')`,{sameResult:true});assert.equal(await number(`select count(*) from factory_purchase_orders where deal_id='${id.deal}'`),1)
 const order=await sql(`select id from factory_purchase_orders where deal_id='${id.deal}'`),qty=await number(`select quantity from factory_purchase_orders where id='${order}'`)
 const plan=`select create_inbound_shipment_atomic('{"purchase_order_id":"${order}","request_key":"${runId}","lines":[{"item_name":"Synthetic ordered bags","expected_quantity":${qty}}]}','IB-ORDER-${runId}')`
 await race('same-order-inbound',id.sales,plan,plan);assert.equal(await number(`select count(*) from inbound_shipments where purchase_order_id='${order}'`),1)
 // Competing different plan keys must not reserve more than the factory ordered.
 await sql(`update inbound_shipments set status='cancelled' where purchase_order_id='${order}'`)
 const partialPlan=(key,orderId)=>`select create_inbound_shipment_atomic('{"purchase_order_id":"${orderId}","request_key":"${key}","lines":[{"item_name":"Synthetic ordered bags","expected_quantity":${qty}}]}','IB-PART-${key}')`
 await race('order-plan-overschedule',id.sales,partialPlan(runId+'-A',order),partialPlan(runId+'-B',order.toUpperCase()),{oneFails:true})
 assert.equal(await number(`select count(*) from inbound_shipments where purchase_order_id='${order}' and status<>'cancelled'`),1)
 // Real policies / helpers from migrations, not substitute policies or role stubs.
 for(const [role,user] of [['admin',id.admin],['sales',id.sales],['client',id.clientUser],['logistics',id.logistics],['factory',id.factoryUser]]){
  assert.equal(await scalar(user,'select current_app_role()'),role)
  const ownOrders=Number(await scalar(user,`select count(*) from factory_purchase_orders where deal_id='${id.deal}'`));assert.equal(ownOrders,['admin','sales','factory'].includes(role)?1:0)
  const ownStock=Number(await scalar(user,`select count(*) from inventory_items where id='${id.stock1}'`));assert.equal(ownStock,role==='factory'?0:1)
  const otherStock=Number(await scalar(user,`select count(*) from inventory_items where id='${id.otherStock}'`));assert.equal(otherStock,['admin','sales','logistics'].includes(role)?1:0)
  if(!['admin','sales'].includes(role)) await denied(user,`select select_quote_atomic('${selected}')`,/営業・管理者/)
 }
 assert.equal(Number(await scalar(id.factoryOtherUser,`select count(*) from factory_purchase_orders where deal_id='${id.deal}'`)),0)
 await denied(id.sales,`update factory_purchase_orders set quantity=1 where id='${order}'`,/permission denied/);
 await denied(id.sales,`delete from factory_purchase_orders where id='${order}'`,/permission denied/);
 assert.equal(await scalar(id.clientUser,`with changed as (update profiles set role='admin' where id='${id.clientUser}' returning id) select count(*) from changed`),'0');
 assert.equal(await scalar(id.clientUser,'select current_app_role()'),'client');
 await denied(id.clientUser,`select create_shipment_request_atomic('{"destination_name":"Synthetic destination","items":[{"item_id":"${id.otherStock}","quantity":1}]}','SR-FORBIDDEN-${runId}')`,/クライアント/)
 await denied(id.clientUser,`select record_inventory_transaction_atomic('{"item_id":"${id.stock1}","tx_type":"inbound","quantity":1}')`,/権限/)
 await denied(id.logistics,`update shipment_requests set status='cancelled' where id='${id.r3}'`,/営業・管理者|変更/)
 const anon=await raw(`begin;${auth(null,'anon')}select create_factory_order_atomic('${selected}','${id.factory}','PO-ANON');rollback;`);assert.notEqual(anon.code,0)
 console.log('PASS actual RLS: admin / sales / client / logistics / factory / other factory / anonymous')
 console.log('PASS all local PostgreSQL concurrency and role checks')
}finally{
 if(seeded){await sql(`begin;
 delete from inventory_transactions where item_id in (select id from inventory_items where client_id in ('${id.client}','${id.otherClient}'));
 delete from shipment_requests where client_id in ('${id.client}','${id.otherClient}');
 delete from inbound_shipments where client_id in ('${id.client}','${id.otherClient}');
 delete from factory_purchase_orders where deal_id='${id.deal}';
 delete from inventory_items where client_id in ('${id.client}','${id.otherClient}');
 delete from deals where id='${id.deal}';delete from clients where id in ('${id.client}','${id.otherClient}');
 delete from auth.users where id in (${['admin','sales','clientUser','logistics','factoryUser','factoryOtherUser'].map(k=>`'${id[k]}'`).join(',')});
 delete from factories where id in ('${id.factory}','${id.otherFactory}');commit;`);console.log('CLEANUP: removed only this run\'s synthetic rows')}
}
