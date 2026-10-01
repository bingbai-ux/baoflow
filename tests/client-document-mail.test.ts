import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {createHash} from 'node:crypto'
import ts from 'typescript'
function harness({finishFailure=false,provider='accepted',role='sales',configured=true}={}){
 const attempts=new Map<string,any>();let receipt:any=null,posts=0,claims=0,to='synthetic@example.test',pdf='SYNTHETIC-PDF'
 const packet={client_id:'client',status:'active',snapshot:{type:'invoice',number:'SYNTH-INV',customer_name:'Synthetic customer',total:'1100',due_date:'2026-10-31'}}
 const db={from:(table:string)=>{const row=()=>table==='client_document_packets'?packet:table==='clients'?{email:to}:table==='client_document_links'?[{token:'synthetic-token',expires_at:'2099-01-01T00:00:00Z'}]:receipt;const q:any={select:()=>q,eq:()=>q,is:()=>q,gt:()=>q,order:()=>q,limit:async()=>({data:row(),error:null}),single:async()=>({data:row(),error:null}),maybeSingle:async()=>({data:row(),error:null})};return q},rpc:async(name:string,input:any)=>{
 if(name==='claim_client_document_email'){claims++;if(receipt)return {data:{claimed:false,status:receipt.status},error:null};receipt={status:'attempting',payload:input.p_payload};return {data:{claimed:true,attempt_id:'attempt'},error:null}}
 if(name==='finish_client_document_email'){if(finishFailure)return {error:{message:'Synthetic DB failure'}};receipt.status=input.p_status;return {error:null}}
 if(name==='client_document_send_state')return {data:{status:receipt?.status||null,can_resend:receipt?.status==='accepted'&&!Array.from(attempts.values()).some(a=>a.status!=='accepted')},error:null}
 if(name==='client_finance_command'){
  assert.equal(input.p_operation,'reserve_document_resend');const prior=attempts.get(input.p_request_id);if(prior)return {data:{...prior,claimed:false},error:null}
  if(receipt?.status!=='accepted'||!input.p_input.recipient_requested||Array.from(attempts.values()).some(a=>a.status!=='accepted'))return {error:{message:'No accepted predecessor'}}
  const a={attempt_id:input.p_request_id,status:'reserved',claimed:true};attempts.set(input.p_request_id,a);return {data:a,error:null}
 }
 if(name==='finish_client_document_resend'){if(finishFailure)return {error:{message:'Synthetic DB failure'}};attempts.get(input.p_attempt_id).status=input.p_status;return {error:null}}
 throw Error('Unexpected RPC')
 }}
 const exports:any={},compiled=ts.transpileModule(readFileSync(new URL('../src/lib/actions/client-finance.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 runInNewContext(compiled,{exports,Buffer,URL,process:{env:{RESEND_API_KEY:configured?'local-dummy':'',RFQ_MAIL_FROM:configured?'sender@example.test':'',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3200'}},require:(name:string)=>name==='node:crypto'?{createHash}:name.includes('workflow-recovery')?{canCorrectRejectedWorkflowRequest:async()=>false}:name==='next/cache'?{revalidatePath:()=>{}}:name.includes('supabase/server')?{createClient:async()=>db}:name.includes('deal-access')?{requireSalesAccess:async()=>role==='sales'?null:'Sales only'}:name.includes('pdf/client-document')?{clientDocumentPDF:async()=>Buffer.from(pdf)}:(()=>{throw Error('Unexpected module')})(),fetch:async(_url:string,options:any)=>{posts++;const body=JSON.parse(options.body);assert.equal(body.to[0],to);assert.match(body.text,/1100|1,100/);assert.match(body.text,/2026-10-31/);assert.match(body.text,/portal\/documents\/packet\?token=synthetic-token/);assert.equal(body.attachments[0].content,Buffer.from(pdf).toString('base64'));if(provider==='throw')throw Error('Synthetic lost response');return {ok:provider!=='rejected',json:async()=>provider==='invalid'?{}:{id:'synthetic-provider'}}}})
 return {resendPreview:()=>exports.previewClientDocumentResend('packet'),resend:(id:string,f:string,confirmed=true)=>exports.sendClientDocumentAgain(id,'packet',f,'Customer requested another copy',confirmed),acceptOriginal:()=>{receipt={status:'accepted'}},preview:()=>exports.previewClientDocumentMail('packet'),send:(f:string)=>exports.sendClientDocumentMail('packet',f),posts:()=>posts,claims:()=>claims,receipt:()=>receipt,changePdf:()=>{pdf='REVISED'},changeTo:()=>{to='other@example.test'}}
}
test('preview never sends; recipient/PDF changes require another preview',async()=>{for(const change of ['changePdf','changeTo'] as const){const h=harness(),p=await h.preview();assert.equal(h.posts(),0);assert.equal(h.claims(),0);h[change]();assert.match((await h.send(p.preview.fingerprint)).error,/変わりました/);assert.equal(h.posts(),0)}})
test('provider acceptance followed by DB finish failure and long retries never POST twice',async()=>{const h=harness({finishFailure:true}),p=await h.preview();assert.equal((await h.send(p.preview.fingerprint)).status,'unknown');h.receipt().created_at='2000-01-01';for(let i=0;i<3;i++)await h.send((await h.preview()).preview.fingerprint);assert.equal(h.posts(),1);assert.equal(h.claims(),1)})
test('provider rejection, lost response, invalid acceptance and accepted retry retain permanent guard',async()=>{for(const provider of ['rejected','throw','invalid','accepted']){const h=harness({provider}),p=await h.preview();await h.send(p.preview.fingerprint);await h.send(p.preview.fingerprint);assert.equal(h.posts(),1);assert.equal(h.receipt().status,provider==='accepted'?'accepted':provider==='rejected'?'rejected':'unknown')}})
test('client cannot preview or send a staff document email',async()=>{const h=harness({role:'client'});assert.ok((await h.preview()).error);assert.ok((await h.send('fake')).error);assert.equal(h.posts(),0);assert.equal(h.claims(),0)})

test('explicit resend requires accepted predecessor and customer request; UUID replay does not POST',async()=>{
 const h=harness();let p=await h.resendPreview();await h.resend('resend-1',p.preview.fingerprint);assert.equal(h.posts(),0)
 h.acceptOriginal();p=await h.resendPreview();await h.resend('resend-1',p.preview.fingerprint,false);assert.equal(h.posts(),0)
 assert.equal((await h.resend('resend-1',p.preview.fingerprint)).status,'accepted');await h.resend('resend-1',p.preview.fingerprint);assert.equal(h.posts(),1)
 assert.equal((await h.resend('resend-2',p.preview.fingerprint)).status,'accepted');assert.equal(h.posts(),2)
})
test('explicit resend result loss or uncertain provider blocks same and new reservation POST',async()=>{
 for(const options of [{finishFailure:true},{provider:'throw'},{provider:'rejected'}]){
  const h=harness(options);h.acceptOriginal();const p=await h.resendPreview();await h.resend('resend-1',p.preview.fingerprint)
  await h.resend('resend-1',p.preview.fingerprint);await h.resend('resend-2',p.preview.fingerprint);assert.equal(h.posts(),1)
 }
})
test('resend rechecks frozen PDF and registered recipient before reserving',async()=>{
 for(const change of ['changePdf','changeTo'] as const){const h=harness();h.acceptOriginal();const p=await h.resendPreview();h[change]();assert.match((await h.resend('resend-1',p.preview.fingerprint)).error,/変わりました/);assert.equal(h.posts(),0)}
})

test('missing mail settings cannot report accepted or reserve/send',async()=>{const h=harness({configured:false}),p=await h.preview();const r=await h.send(p.preview?.fingerprint||'fake');assert.ok(r.error);assert.notEqual(r.status,'accepted');assert.equal(h.posts(),0);assert.equal(h.claims(),0);h.acceptOriginal();const again=await h.resend('missing-key','fake');assert.ok(again.error);assert.notEqual(again.status,'accepted');assert.equal(h.posts(),0)})
