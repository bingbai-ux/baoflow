import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {createHash} from 'node:crypto'
import ts from 'typescript'
function harness({finishFailure=false,provider='accepted',role='sales'}={}){
 let receipt:any=null,posts=0,claims=0,reads=0,to='synthetic@example.test',pdf='SYNTHETIC-PDF'
 const bill={id:'invoice',deal_id:'deal',status:'issued',document_number:'SMP-SYNTHETIC',snapshot:{deal_code:'SYN',customer_name:'Synthetic customer',total:'1650',due_date:'2026-10-31'}}
 const db={from:(table:string)=>{reads++;const row=()=>table==='sample_invoices'?bill:table==='deals'?{client_id:'client'}:table==='clients'?{email:to}:receipt;const q:any={select:()=>q,eq:()=>q,single:async()=>({data:row(),error:null}),maybeSingle:async()=>({data:row(),error:null})};return q},rpc:async(name:string,input:any)=>{
  if(name==='claim_sample_email'){claims++;if(receipt)return {data:{claimed:false,status:receipt.status},error:null};receipt={status:'attempting',payload:input.p_payload};return {data:{claimed:true,attempt_id:'attempt'},error:null}}
  if(name==='finish_sample_email'){if(finishFailure)return {error:{message:'Synthetic DB finish failure'}};receipt.status=input.p_status;return {error:null}}
  throw Error('Unexpected synthetic RPC')
 }}
 const exports:any={},compiled=ts.transpileModule(readFileSync(new URL('../src/lib/actions/sample-ledger.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 runInNewContext(compiled,{exports,Buffer,process:{env:{RESEND_API_KEY:'local-dummy',RFQ_MAIL_FROM:'Synthetic <sender@example.test>'}},require:(name:string)=>name==='node:crypto'?{createHash}:name==='next/cache'?{revalidatePath:()=>{}}:name.includes('supabase/server')?{createClient:async()=>db}:name.includes('deal-access')?{requireSalesAccess:async()=>role==='sales'?null:'Sales only'}:name.includes('pdf/sample-invoice')?{sampleInvoicePDF:async()=>Buffer.from(pdf)}:(()=>{throw Error('Unexpected module')})(),fetch:async(_url:string,options:any)=>{posts++;const body=JSON.parse(options.body);assert.equal(body.to[0],to);assert.equal(body.attachments[0].content,Buffer.from(pdf).toString('base64'));if(provider==='throw')throw Error('Synthetic response lost');return {ok:provider!=='rejected',json:async()=>provider==='invalid'?{}:{id:'mailpit-synthetic'}}},console})
 return {preview:()=>exports.previewSampleMail('invoice'),send:(fingerprint:string)=>exports.sendSampleMail('invoice',fingerprint),posts:()=>posts,claims:()=>claims,reads:()=>reads,receipt:()=>receipt,changePdf:()=>{pdf='REVISED-PDF'},changeTo:()=>{to='other@example.test'}}
}
test('sample mail preview is read-only; changed PDF/recipient requires another preview before claim',async()=>{
 for(const change of ['changePdf','changeTo'] as const){const h=harness(),p=await h.preview();assert.equal(h.posts(),0);assert.equal(h.claims(),0);h[change]();const r=await h.send(p.preview.fingerprint);assert.match(r.error,/変わりました/);assert.equal(h.posts(),0);assert.equal(h.claims(),0)}
})
test('accepted provider response followed by DB failure permanently blocks long retry',async()=>{
 const h=harness({finishFailure:true}),p=await h.preview(),r=await h.send(p.preview.fingerprint);assert.equal(r.status,'unknown');assert.equal(h.receipt().status,'attempting')
 h.receipt().created_at='2000-01-01T00:00:00Z';for(let n=0;n<3;n++){const next=await h.preview();await h.send(next.preview.fingerprint)}assert.equal(h.posts(),1);assert.equal(h.claims(),1)
})
test('provider rejection, uncertain response and missing provider ID all preserve no-resend receipt',async()=>{
 for(const provider of ['rejected','throw','invalid']){const h=harness({provider}),p=await h.preview();await h.send(p.preview.fingerprint);assert.equal(h.receipt().status,provider==='rejected'?'rejected':'unknown');await h.send(p.preview.fingerprint);assert.equal(h.posts(),1);assert.equal(h.claims(),1)}
})
test('accepted mail is not posted twice; client cannot invoke staff mail preview or provider',async()=>{
 const h=harness(),p=await h.preview();assert.equal((await h.send(p.preview.fingerprint)).status,'accepted');assert.equal((await h.send(p.preview.fingerprint)).status,'accepted');assert.equal(h.posts(),1)
 const denied=harness({role:'client'});assert.ok((await denied.preview()).error);assert.ok((await denied.send('fake')).error);assert.equal(denied.reads(),0);assert.equal(denied.posts(),0)
})
