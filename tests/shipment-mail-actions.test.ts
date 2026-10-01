import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {createHash} from 'node:crypto'
import ts from 'typescript'
function harness({finishFailure=false,provider='accepted',role='sales'}={}){
 let receipt:any=null,posts=0,claims=0,to='shipment@example.test',pdf='SYNTHETIC-PDF'
 const plan={id:'plan',client_id:'client',partner_id:'partner',order_id:'order',quantity:100,snapshot:{customer_name:'Synthetic customer',item_name:'Synthetic item'}}
 const doc={document_number:'SYNTH-DLV',snapshot:{received_on:'2026-10-01'}}
 const db={from:(table:string)=>{const row=()=>table==='shipment_plans'?plan:table==='shipment_delivery_documents'?doc:table==='clients'?{email:to}:receipt;const q:any={select:()=>q,eq:()=>q,single:async()=>({data:row(),error:null}),maybeSingle:async()=>({data:row(),error:null})};return q},rpc:async(name:string,input:any)=>{
 if(name==='claim_shipment_email'){claims++;if(receipt)return {data:{claimed:false,status:receipt.status},error:null};receipt={status:'reserved',payload:input.p_payload};return {data:{claimed:true,attempt_id:'attempt'},error:null}}
 if(name==='finish_shipment_email'){if(finishFailure)return {error:{message:'Synthetic DB failure'}};receipt.status=input.p_status;return {data:true,error:null}}
 throw Error('Unexpected RPC')
 }}
 const exports:any={},compiled=ts.transpileModule(readFileSync(new URL('../src/lib/actions/shipment-workflow.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 runInNewContext(compiled,{exports,Buffer,URL,process:{env:{RESEND_API_KEY:'local-dummy',RFQ_MAIL_FROM:'sender@example.test',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3200'}},require:(name:string)=>name==='node:crypto'?{createHash}:name.includes('workflow-recovery')?{canCorrectRejectedWorkflowRequest:async()=>false}:name==='next/cache'?{revalidatePath:()=>{}}:name.includes('supabase/server')?{createClient:async()=>db}:name.includes('deal-access')?{requireSalesAccess:async()=>role==='sales'?null:'Sales only'}:name.includes('pdf/delivery-note')?{deliveryNotePDF:async()=>Buffer.from(pdf)}:name.includes('shipping/types')?{milestoneNames:{}}:(()=>{throw Error('Unexpected module')})(),fetch:async(_url:string,options:any)=>{posts++;const body=JSON.parse(options.body);assert.equal(body.to[0],to);assert.match(body.text,/100個/);assert.match(body.text,/2026-10-01/);assert.match(body.text,/portal\/shipments\/order/);assert.equal(body.attachments[0].content,Buffer.from(pdf).toString('base64'));if(provider==='throw')throw Error('Synthetic lost response');return {ok:provider!=='rejected',json:async()=>provider==='invalid'?{}:{id:'synthetic-provider'}}}})
 return {preview:()=>exports.previewShipmentMail('plan','delivery'),send:(f:string)=>exports.sendShipmentMail('plan','delivery',f),posts:()=>posts,claims:()=>claims,receipt:()=>receipt,changePdf:()=>{pdf='REVISED'},changeTo:()=>{to='other@example.test'}}
}
test('delivery preview never sends; recipient/PDF changes require another preview',async()=>{for(const change of ['changePdf','changeTo'] as const){const h=harness(),p=await h.preview();assert.equal(h.posts(),0);assert.equal(h.claims(),0);h[change]();assert.match((await h.send(p.preview.fingerprint)).error,/変更/);assert.equal(h.posts(),0)}})
test('provider acceptance then DB finish failure and long retries never POST twice',async()=>{const h=harness({finishFailure:true}),p=await h.preview();assert.equal((await h.send(p.preview.fingerprint)).status,'unknown');h.receipt().created_at='2000-01-01';for(let i=0;i<3;i++)await h.send((await h.preview()).preview.fingerprint);assert.equal(h.posts(),1);assert.equal(h.claims(),1)})
test('rejection, lost response, malformed acceptance and accepted retry all retain permanent guard',async()=>{for(const provider of ['rejected','throw','invalid','accepted']){const h=harness({provider}),p=await h.preview();await h.send(p.preview.fingerprint);await h.send(p.preview.fingerprint);assert.equal(h.posts(),1);assert.equal(h.receipt().status,provider==='accepted'?'accepted':provider==='rejected'?'rejected':'unknown')}})
test('logistics/client/factory cannot preview or send shipment email',async()=>{for(const role of ['client','logistics','factory']){const h=harness({role});assert.ok((await h.preview()).error);assert.ok((await h.send('fake')).error);assert.equal(h.posts(),0);assert.equal(h.claims(),0)}})
