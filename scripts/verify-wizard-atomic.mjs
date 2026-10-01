// In-memory Postgres only. Never connects to Supabase.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
const uid='00000000-0000-0000-0000-000000000001'
const id=n=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`
try {
 await db.exec(`create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
 create function is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='true'$$;
 create table profiles(id uuid primary key,role text); insert into profiles values('${uid}','sales');
 create table deals(id uuid primary key default gen_random_uuid(),deal_code text unique,deal_name text,client_id uuid,client_name_text text,brand_text text,desired_delivery_date date,sales_user_id uuid,simple_status text,visibility text,waiting_on text,master_status text default 'M01',archived_at timestamptz,last_activity_at timestamptz);
 create table deal_products(id uuid primary key default gen_random_uuid(),deal_id uuid references deals(id),product_no integer,description text,category_l1 text,category_l2 text,category_l3 text,is_selected boolean,unique(deal_id,product_no));
 create table deal_product_variants(id uuid primary key default gen_random_uuid(),product_id uuid references deal_products(id),variant_label text,variant_order integer,width_mm numeric,height_mm numeric,depth_mm numeric,material text,print_color_count text,print_method text,processing text,color_description text,other_notes text,is_selected boolean);
 create table deal_quotes(id uuid primary key default gen_random_uuid(),deal_id uuid references deals(id),variant_id uuid references deal_product_variants(id),quantity integer,version integer,status text);
 create table deal_status_history(id uuid primary key default gen_random_uuid(),deal_id uuid references deals(id),to_status text not null,to_simple_status text,changed_by uuid,kind text,note text);
 set test.staff='true';`)
 await db.exec(readFileSync('supabase/migrations/042_wizard_atomic_workflows.sql','utf8'))
 const rpc=async(key,op,payload)=>(await db.query('select wizard_atomic($1::uuid,$2::text,$3::jsonb) as result',[key,op,JSON.stringify(payload)])).rows[0].result
 const count=async(table)=>Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n)
 const payload={client_name_text:'テスト',items:['袋','箱'],sales_user_id:uid}
 const created=await rpc(id(1),'deal',payload)
 assert.equal(await count('deals'),1); assert.equal(await count('deal_products'),2); assert.equal(await count('deal_status_history'),1)
 assert.deepEqual(await rpc(id(1),'deal',payload),created); assert.equal(await count('deals'),1)
 await assert.rejects(rpc(id(1),'deal',{...payload,client_name_text:'変更'}),/内容が変わ/)
 const product=(await db.query('select id from deal_products where deal_id=$1 order by product_no',[created.dealId])).rows[0].id
 const spec={deal_id:created.dealId,product_id:product,category_l1:'袋',width_mm:100,quantities:[1000,2000]}
 const registered=await rpc(id(2),'spec',spec)
 assert.equal(await count('deal_product_variants'),1);assert.equal(await count('deal_quotes'),2)
 assert.deepEqual(await rpc(id(2),'spec',spec),registered);assert.equal(await count('deal_quotes'),2)
 const quantity={deal_id:created.dealId,variant_id:registered.variantId,quantity:3000}
 await rpc(id(3),'quantity',quantity);await rpc(id(3),'quantity',quantity);assert.equal(await count('deal_quotes'),3)
 await assert.rejects(rpc(id(4),'quantity',quantity),/すでにあります/)
 for(const quantities of [[1.5],[0],[100,100],[]]) await assert.rejects(rpc(id(5),'spec',{...spec,quantities}),/数量/)
 const other=await rpc(id(6),'deal',{...payload,client_name_text:'別案件'})
 await assert.rejects(rpc(id(7),'spec',{...spec,deal_id:other.dealId}),/属していません/)
 await db.exec(`create function fail_history() returns trigger language plpgsql as $$begin raise exception 'forced history failure'; end$$;
 create trigger fail_history before insert on deal_status_history for each row execute function fail_history();`)
 const before=[await count('deals'),await count('deal_products'),await count('deal_product_variants'),await count('deal_quotes'),await count('wizard_requests')]
 await assert.rejects(rpc(id(8),'deal',payload),/forced history/)
 await assert.rejects(rpc(id(9),'spec',{...spec,quantities:[4000]}),/forced history/)
 await assert.rejects(rpc(id(10),'quantity',{...quantity,quantity:5000}),/forced history/)
 assert.deepEqual([await count('deals'),await count('deal_products'),await count('deal_product_variants'),await count('deal_quotes'),await count('wizard_requests')],before)
 await db.exec('drop trigger fail_history on deal_status_history')
 await rpc(id(8),'deal',payload); await rpc(id(9),'spec',{...spec,quantities:[4000]}); await rpc(id(10),'quantity',{...quantity,quantity:5000})
 assert.equal(await count('deals'),3); assert.equal(await count('deal_product_variants'),2);assert.equal(await count('deal_quotes'),5)
 await db.exec(`update deals set archived_at=now() where id='${created.dealId}'`)
 await assert.rejects(rpc(id(12),'quantity',{...quantity,quantity:6000}),/アーカイブ/)
 await db.exec(`update deals set archived_at=null; create or replace function auth.uid() returns uuid language sql as $$select '${id(99)}'::uuid$$`)
 await assert.rejects(rpc(id(1),'deal',payload),/所有者/)
 await db.exec(`create or replace function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$; create or replace function is_staff() returns boolean language sql as $$select null::boolean$$`)
 await assert.rejects(rpc(id(13),'deal',payload),/営業・管理者/)
 await db.exec(`create or replace function is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='true'$$`)
 const codes=(await db.query('select deal_code from deals')).rows.map(r=>r.deal_code)
 assert.equal(new Set(codes).size,codes.length)
 // UI stage 1 reuses this exact RPC for same-category products and multiple
 // specification/quantity choices. Verify the real SQL, not the browser mock.
 const multi=await rpc(id(20),'deal',{...payload,items:['袋','袋']})
 const productRows=(await db.query('select id from deal_products where deal_id=$1 order by product_no',[multi.dealId])).rows
 assert.equal(productRows.length,2)
 let key=21
 for(const p of productRows)for(let v=0;v<2;v++)await rpc(id(key++),'spec',{deal_id:multi.dealId,product_id:p.id,category_l1:'袋',category_l2:null,category_l3:null,width_mm:100+v*10,height_mm:150,depth_mm:null,material:'PET',print_color_count:null,print_method:null,processing:null,other_notes:null,quantities:[1000,2000,3000]})
 const variantRows=(await db.query('select v.id,v.product_id,v.variant_label from deal_product_variants v join deal_products p on p.id=v.product_id where p.deal_id=$1',[multi.dealId])).rows
 assert.equal(variantRows.length,4)
 for(const p of productRows)assert.deepEqual(variantRows.filter(v=>v.product_id===p.id).map(v=>v.variant_label).sort(),['A','B'])
 for(const v of variantRows)assert.deepEqual((await db.query('select quantity from deal_quotes where variant_id=$1 order by quantity',[v.id])).rows.map(q=>q.quantity),[1000,2000,3000])
 await db.exec(`set test.staff='false'`);await assert.rejects(rpc(id(11),'deal',payload),/営業・管理者/)
 console.log('PASS: wizard transaction rollback, stable retry, payload mismatch, quantity/ownership/role guards; 2 same-category products × 2 variants × 3 quantities')
}finally{await db.close()}
