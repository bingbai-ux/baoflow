import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`
const token='fixture-rfq-response-token-only'
const line={product_id:id(2),variant_id:id(3),unit_price_usd:0.1,moq:100,pcs_per_carton:1000,carton_w_cm:10,carton_h_cm:20,carton_d_cm:30,gross_weight_kg:12,production_lead_days:15}
async function setup(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;
 create table external_forms(id uuid primary key,token text,form_type text,related_id uuid,status text,cancelled_at timestamptz,expires_at timestamptz,submitted_at timestamptz,submission_data jsonb,submitted_by_email text,submission_ip text,submission_user_agent text,context jsonb);
 create table deals(id uuid primary key,archived_at timestamptz);
 create table rfq_requests(id uuid primary key,deal_id uuid,product_ids uuid[],rfq_number text,request_message text,response_deadline date,status text);
 create table rfq_factory_invitations(id uuid primary key,rfq_id uuid,factory_id uuid,responded_at timestamptz,external_form_id uuid);
 create table deal_products(id uuid primary key,deal_id uuid,description text,product_no int);
 create table deal_product_variants(id uuid primary key,product_id uuid,variant_label text,variant_order int,width_mm numeric,height_mm numeric,depth_mm numeric,material text,print_color_count text,pcs_per_carton int);
 create table deal_quotes(id uuid default gen_random_uuid(),deal_id uuid,variant_id uuid,factory_id uuid,quantity int,moq int,factory_unit_price_usd numeric,status text,source_type text,version int);
 insert into deals values('${id(1)}',null);insert into deal_products values('${id(2)}','${id(1)}','袋',1);insert into deal_product_variants(id,product_id,variant_label,variant_order) values('${id(3)}','${id(2)}','A',0);
 insert into deal_quotes(deal_id,variant_id,quantity,version) values('${id(1)}','${id(3)}',1000,1),('${id(1)}','${id(3)}',2000,2);
 insert into rfq_requests values('${id(4)}','${id(1)}',array['${id(2)}'::uuid],'RFQ-TEST',null,null,'open');
 insert into rfq_factory_invitations values('${id(5)}','${id(4)}','${id(6)}',null,'${id(7)}');
 insert into external_forms(id,token,form_type,related_id,status,expires_at) values('${id(7)}','${token}','rfq_response','${id(5)}','pending',now()+interval '1 day');`)
 await db.query('update external_forms set context=$1', [{requested_lines:[{product_id:id(2),variant_id:id(3),description:'袋',variant_label:'A',quantities:[1000,2000]}]}]);
 await db.exec(await readFile(new URL('../supabase/migrations/045_rfq_response_integrity.sql',import.meta.url),'utf8'));return db
}
const submit=(db:PGlite,payload:unknown)=>db.query<Record<string, unknown>>('select ext_submit_rfq($1,$2)',[token,payload]);
test('RFQ reply preserves requested quantities and independent factory packaging; identical retry adds nothing',async()=>{const db=await setup();try{
 await db.exec('set role anon');await submit(db,{products:[line]});await submit(db,{products:[line]});await db.exec('reset role');
 const rows=(await db.query<{quantity:number,factory_response:{line:typeof line}}>("select quantity,factory_response from deal_quotes where source_type='rfq_response' order by quantity")).rows;
 assert.deepEqual(rows.map(q=>q.quantity),[1000,2000]);assert.deepEqual(rows[0].factory_response.line,line);
 assert.equal((await db.query<Record<string, unknown>>('select pcs_per_carton from deal_product_variants')).rows[0].pcs_per_carton,null);
 await assert.rejects(submit(db,{products:[{...line,unit_price_usd:2}]}),/既に送信/)
 }finally{await db.close()}})
test('invalid ownership, duplicate lines and numbers cannot consume RFQ token',async()=>{const db=await setup();try{
 for(const products of [[{...line,product_id:id(8)}],[{...line,variant_id:id(8)}],[line,line],[{...line,moq:0.5}],[{...line,unit_price_usd:-1}],[{...line,carton_w_cm:null}]]) await assert.rejects(submit(db,{products}));
 assert.equal((await db.query<Record<string, unknown>>("select status from external_forms")).rows[0].status,'pending');assert.equal((await db.query<Record<string, unknown>>('select count(*)::int n from deal_quotes')).rows[0].n,2)
 }finally{await db.close()}})
test('late SQL failure rolls back RFQ state and every quotation then allows safe retry',async()=>{const db=await setup();try{
 await db.exec(`create function fail_late_reply() returns trigger language plpgsql as $$begin raise exception 'injected late failure';end$$;create trigger fail_reply before update on external_forms for each row execute function fail_late_reply();`);
 await assert.rejects(submit(db,{products:[line]}),/injected late/);assert.equal((await db.query<Record<string, unknown>>('select count(*)::int n from deal_quotes')).rows[0].n,2);assert.equal((await db.query<Record<string, unknown>>('select status from rfq_requests')).rows[0].status,'open');assert.equal((await db.query<Record<string, unknown>>('select responded_at from rfq_factory_invitations')).rows[0].responded_at,null);
 await db.exec('drop trigger fail_reply on external_forms');await submit(db,{products:[line]})
 }finally{await db.close()}})
test('expired/cancelled/closed forms reveal no RFQ specifications and reject submissions',async()=>{const db=await setup();try{
 for(const condition of ["status='cancelled'","status='pending',expires_at=now()-interval '1 day'"]){await db.exec(`update external_forms set ${condition}`);const result=(await db.query<{r:{error?:string}}>('select ext_rfq_context($1) r',[token])).rows[0].r;assert.ok(result.error);await assert.rejects(submit(db,{products:[line]}));}
 await db.exec("update external_forms set expires_at=now()+interval '1 day';update rfq_requests set status='closed'");assert.ok((await db.query<{r:{error?:string}}>('select ext_rfq_context($1) r',[token])).rows[0].r.error);await assert.rejects(submit(db,{products:[line]}));
 }finally{await db.close()}})

test('partial answers roll back and requested quantity snapshot survives later quote edits',async()=>{const db=await setup();try{
 await db.query('update external_forms set context=$1',[{requested_lines:[{product_id:id(2),variant_id:id(3),quantities:[1000]},{product_id:id(2),variant_id:id(8),quantities:[2000]}]}]);
 await assert.rejects(submit(db,{products:[line]}),/すべての仕様/);assert.equal((await db.query<{n:number}>('select count(*)::int n from deal_quotes')).rows[0].n,2);
 await db.query('update external_forms set context=$1',[{requested_lines:[{product_id:id(2),variant_id:id(3),quantities:[1000,2000]}]}]);await db.exec('update deal_quotes set quantity=9999');await submit(db,{products:[line]});assert.deepEqual((await db.query<{quantity:number}>("select quantity from deal_quotes where source_type='rfq_response' order by quantity")).rows.map(q=>q.quantity),[1000,2000]);
 }finally{await db.close()}})
