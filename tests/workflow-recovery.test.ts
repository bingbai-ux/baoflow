import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { persistentRequestId, readPendingRequest, workflowRequestKey, type RequestStorage } from '../src/lib/utils/request-key'
class MemoryStorage implements RequestStorage {
 constructor(public values=new Map<string,string>()){}
 getItem(k:string){return this.values.get(k)??null}
 setItem(k:string,v:string){this.values.set(k,v)}
 removeItem(k:string){this.values.delete(k)}
}
test('reload keeps the same UUID without storing form data, tokens or recovered URLs',async()=>{
 const before=new MemoryStorage(),key=workflowRequestKey('actor','rfq/deal')
 const payload={message:'Private synthetic description',formToken:'synthetic-token',quantity:1000}
 const first=await persistentRequestId(before,key,payload)
 const after=new MemoryStorage(before.values)
 assert.equal(await persistentRequestId(after,key,payload),first)
 assert.deepEqual(Object.keys(JSON.parse(after.getItem(key)!)).sort(),['id','signature'])
 assert.doesNotMatch(after.getItem(key)!,/Private|synthetic-token|quantity|1000/)
 await assert.rejects(persistentRequestId(after,key,{...payload,quantity:2000}),/前回の保存結果/)
 after.removeItem(key)
 assert.notEqual(await persistentRequestId(after,key,payload),first)
})
test('actor and operation scopes isolate pending requests; corrupt or unavailable storage fails closed',async()=>{
 const storage=new MemoryStorage(),key=workflowRequestKey('a','deal/new')
 assert.notEqual(await persistentRequestId(storage,key,{a:1}),await persistentRequestId(storage,workflowRequestKey('b','deal/new'),{a:1}))
 storage.setItem(key,'{"id":"invalid","signature":"bad"}')
 assert.throws(()=>readPendingRequest(storage,key),/保存要求/)
 const blocked={getItem:()=>null,setItem:()=>{throw Error('storage blocked')},removeItem:()=>{}}
 await assert.rejects(persistentRequestId(blocked,key,{a:1}),/storage blocked/)
})
const request='10000000-0000-4000-8000-000000000001'
function actionHarness(role='sales'){
 const records:Record<string,Record<string,unknown>[]>={wizard_requests:[{request_id:request,user_id:'actor',operation:'spec',payload:{deal_id:'deal'},result:{success:true,productId:'saved-product'}}],rfq_creation_requests:[{request_id:request,created_by:'actor',payload:{deal:'deal'},result:{rfqId:'saved-rfq',invitations:[]}}],document_issue_requests:[{request_id:request,created_by:'actor',payload:{deal_id:'deal'},document_id:'document'}],documents:[{id:'document',document_number:'INV-TEST',document_type:'invoice'}]}
 let actor='actor',failure=false,queries=0
 const client={auth:{getUser:async()=>({data:{user:{id:actor}}})},from:(table:string)=>{
  queries++;const filters:Array<[string,unknown]>=[]
  const q:any={select:()=>q,eq:(k:string,v:unknown)=>{filters.push([k,v]);return q},maybeSingle:async()=>({data:failure?null:(records[table]||[]).find(r=>filters.every(([k,v])=>r[k]===v))||null,error:failure?{message:'mock failure'}:null})};return q
 }}
 const exports:any={}
 const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/actions/workflow-recovery.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 runInNewContext(compiled,{exports,require:(name:string)=>name.includes('supabase/server')?{createClient:async()=>client}:{requireSalesAccess:async()=>['sales','admin'].includes(role)?null:'営業・管理者のみ'},console})
 return {recover:exports.recoverWorkflowRequest,setActor:(v:string)=>actor=v,setFailure:()=>failure=true,queries:()=>queries}
}
test('saved specification, RFQ and document results restore only to the same actor and deal',async()=>{
 const h=actionHarness()
 assert.equal((await h.recover('spec',request,'deal')).result.productId,'saved-product')
 assert.equal((await h.recover('rfq',request,'deal')).result.rfqId,'saved-rfq')
 assert.equal((await h.recover('document',request,'deal')).result.document_number,'INV-TEST')
 assert.match((await h.recover('spec',request,'other-deal')).error,/一致/)
 h.setActor('other-actor')
 for(const op of ['spec','rfq','document'])assert.equal((await h.recover(op,request,'deal')).result,null)
})
test('role denial, operation mismatch and uncertain lookup do not silently start another save',async()=>{
 const denied=actionHarness('client');assert.ok((await denied.recover('deal',request)).error);assert.equal(denied.queries(),0)
 const h=actionHarness();assert.equal((await h.recover('quantity',request,'deal')).result,null)
 h.setFailure();assert.match((await h.recover('spec',request,'deal')).error,/確認できません/)
})
