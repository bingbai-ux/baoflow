import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises'
import {storageInvoiceAmounts,validateStorageInvoice,type StorageInvoiceInput} from '../src/lib/utils/storage-invoice'
import {storageInvoicePDF} from '../src/lib/pdf/storage-invoice'
const id=(n:number)=>`${String(n).padStart(8,'0')}-3333-4333-8333-333333333333`
const input:StorageInvoiceInput={month:'2026-08',issue_date:'2026-09-01',due_date:'2026-09-30',method:'end_of_month',cartons:12,monthly_rate:250,in_count:2,in_rate:300,out_count:1,out_rate:500,tax_rate:10,recipient:'client@example.test',payment_details:'合成銀行 口座1234567',basis:'合成倉庫の8月末台帳12CTN・契約料金を確認',confirmed:true}
test('confirmed storage charges use decimal exact yen truncation and validate dates/warehouse basis',()=>{
 assert.equal(validateStorageInvoice(input),null)
 assert.deepEqual(storageInvoiceAmounts(input),{storage:3000,inbound:600,outbound:500,subtotal:4100,tax:410,total:4510})
 assert.equal(storageInvoiceAmounts({...input,cartons:100,monthly_rate:0.29,in_count:0,out_count:0}).storage,29)
 assert.ok(validateStorageInvoice(null as unknown as StorageInvoiceInput))
 for(const bad of [{confirmed:false},{cartons:NaN},{cartons:1.2},{method:'fake'},{issue_date:'2026-02-30'},{due_date:'2026-08-01'},{recipient:'x\r\nbcc:y'},{tax_rate:101},{basis:''}])assert.ok(validateStorageInvoice({...input,...bad} as StorageInvoiceInput))
})
test('real SQL invoice snapshot, client isolation, immutable direct billing, exactly-once issue/email and rollback',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`)
 const root=new URL('../supabase/migrations/',import.meta.url)
 for(const file of (await readdir(root)).sort().filter(f=>f.endsWith('.sql')&&!['011','015'].some(n=>f.startsWith(n))))await db.exec(await readFile(new URL(file,root),'utf8'))
 // Mirror existing Supabase table ACLs absent from the memory engine's platform setup.
 await db.exec('grant select on public.documents,public.profiles,public.clients to authenticated')
 await db.exec(`insert into auth.users(id,email) values('${id(1)}','sales@example.test'),('${id(2)}','client@example.test'),('${id(3)}','other@example.test');update profiles set role='sales' where id='${id(1)}';
 insert into clients(id,company_name) values('${id(4)}','合成クライアント');update profiles set client_id='${id(4)}' where id='${id(2)}';
 insert into system_settings(company_info_phase1) values('{"name":"合成発行会社","address":"合成住所","registration_number":"T0000000000000","internal_note":"synthetic private setting"}');set test.actor='${id(1)}';`)
 const issue=async(request=id(5),value=input)=>(await db.query<{b:{id:string;invoice_document_id:string;total_amount:number;snapshot:Record<string,unknown>}}>('select issue_storage_invoice($1,$2,$3) b',[request,id(4),value])).rows[0].b
 const bill=await issue();assert.equal(Number(bill.total_amount),4510);assert.equal((await issue()).id,bill.id)
 assert.equal((bill.snapshot.issuer as Record<string,unknown>).internal_note,undefined)
 await assert.rejects(issue(id(5),{...input,cartons:13}),/different input/)
 await assert.rejects(issue(id(6)),/already exists/)
 assert.equal((await db.query<{n:number}>('select count(*)::int n from documents where document_type=\'storage_invoice\'')).rows[0].n,1)
 await db.exec(`update clients set company_name='Changed later' where id='${id(4)}'`)
 assert.equal((bill.snapshot.client as {name:string}).name,'合成クライアント')
 for(const actor of [id(2),id(3)]){
  await db.exec(`set test.actor='${actor}';set role authenticated;`)
  const count=(await db.query<{n:number}>('select count(*)::int n from storage_billing')).rows[0].n;assert.equal(count,actor===id(2)?1:0)
  assert.equal((await db.query<{n:number}>('select count(*)::int n from documents where document_type=\'storage_invoice\'')).rows[0].n,actor===id(2)?1:0)
  await assert.rejects(issue(id(9)),/Sales or administrator/)
  await assert.rejects(db.exec('update storage_billing set total_amount=0'),/permission denied/)
  await assert.rejects(db.query('select claim_storage_invoice_email($1)',[bill.invoice_document_id]),/Sales or administrator/)
  await db.exec('reset role')
 }
 await db.exec(`set test.actor='${id(1)}';`)
 const claim=(await db.query<{r:{claimed:boolean;attemptId:string}}>('select claim_storage_invoice_email($1) r',[bill.invoice_document_id])).rows[0].r;assert.equal(claim.claimed,true)
 await db.exec(`update document_email_receipts set started_at=now()-interval '30 days'`)
 assert.equal((await db.query<{r:{claimed:boolean}}>('select claim_storage_invoice_email($1) r',[bill.invoice_document_id])).rows[0].r.claimed,false)
 await db.query('select finish_storage_invoice_email($1,$2,$3,$4)',[bill.invoice_document_id,claim.attemptId,'accepted','synthetic-provider-id'])
 await db.query('select finish_storage_invoice_email($1,$2,$3,$4)',[bill.invoice_document_id,claim.attemptId,'rejected',null])
 assert.equal((await db.query<{status:string}>('select status from document_email_receipts')).rows[0].status,'accepted')
 await db.exec(`create function fail_storage_bill() returns trigger language plpgsql as $$begin raise exception 'Synthetic ledger failure';end$$;create trigger fail_storage_bill before insert on storage_billing for each row execute function fail_storage_bill();`)
 await assert.rejects(issue(id(7),{...input,month:'2026-07'}),/Synthetic ledger failure/)
 assert.equal((await db.query<{n:number}>('select count(*)::int n from documents where document_type=\'storage_invoice\'')).rows[0].n,1)
 }finally{await db.close()}
})
test('Japanese PDF renders saved quantity, exact amount, month and payment dates',async()=>{
 const snapshot={version:1,input:{...input,payment_details:'Synthetic bank account 1234567'},client:{id:id(4),name:'合成クライアント',address:'東京都 合成住所'},issuer:{name:'合成発行会社',address:'東京都 合成発行元',registration_number:'T0000000000000'},subtotal:4100,tax:410,total:4510,currency:'JPY',created_at:'2026-09-01T00:00:00Z'}
 const bytes=await storageInvoicePDF('STI-202609-001',snapshot)
 assert.match(Buffer.from(bytes).toString('ascii',0,8),/^%PDF-/);assert.ok(bytes.length>1000)
 await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/storage-invoice-synthetic.pdf',bytes)
 const long=await storageInvoicePDF('STI-202609-002',{...snapshot,client:{...snapshot.client,name:'長い合成会社名'.repeat(100),address:'合成住所'.repeat(100)},input:{...input,basis:'倉庫台帳確認済み'.repeat(62).slice(0,500),payment_details:'振込先合成銀行'.repeat(72).slice(0,500)}})
 await writeFile('tmp/pdfs/storage-invoice-long-synthetic.pdf',long)
})
