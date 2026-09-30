import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Evaluate the real action modules with completely substituted dependencies.
// No host process.env, real fetch, Supabase client, Storage or Next runtime is loaded.
const nodeRequire=createRequire(import.meta.url)
const compiled=new Map<string,string>()
function harness(role='sales'){
 const calls:{kind:string;value?:unknown}[]=[]
 const state={role,authenticated:true,uploadFailure:false,cleanupFailure:false,mailResponses:[true],mailThrow:false,dbFailures:new Set<string>(),rows:{
  deals:[{id:'deal'}],deal_products:[{id:'product',deal_id:'deal',thumbnail_url:'https://storage.example.test/storage/v1/object/public/deal-images/deal/old.png'}],
  deal_design_files:[{id:'file',deal_id:'deal',storage_path:'deal/old.pdf',version_number:1}],
  rfq_factory_invitations:[{id:'invitation',rfq_id:'rfq',factory_id:'factory',external_form_id:'form',invitation_sent_at:null}],
  rfq_requests:[{id:'rfq',rfq_number:'RFQ-TEST',status:'open',request_message:'<b>Customer message</b>',response_deadline:null}],
  external_forms:[{id:'form',form_type:'rfq_response',related_id:'invitation',token:'synthetic-only-token',status:'pending',cancelled_at:null,expires_at:'2100-01-01T00:00:00Z'}],
  factories:[{id:'factory',factory_name:'<script>Factory</script>',contact_email:'factory@example.test'}],
 } as Record<string,Array<Record<string,unknown>>>}
 const storage={
  upload:async(path:string)=>{calls.push({kind:'upload',value:path});return {error:state.uploadFailure?{message:'synthetic upload failure'}:null}},
  getPublicUrl:(path:string)=>({data:{publicUrl:`https://storage.example.test/storage/v1/object/public/deal-images/${path}`}}),
  remove:async(paths:string[])=>{calls.push({kind:'remove',value:structuredClone(paths)});return {error:state.cleanupFailure?{message:'synthetic cleanup failure'}:null}},
 }
 const client={auth:{getUser:async()=>({data:{user:state.authenticated?{id:'staff'}:null},error:null})},storage:{from:()=>storage},from:(table:string)=>{
  let operation='read';let payload:Record<string,unknown>={};const filters:Array<[string,unknown]>=[];let limit=Infinity
  const resolve=(single=false)=>{
   calls.push({kind:`${operation}:${table}`})
   if(state.dbFailures.has(`${operation}:${table}`))return {data:null,error:{message:'synthetic DB failure'}}
   if(table==='profiles')return {data:{role:state.role},error:null}
   let rows=(state.rows[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value)).slice(0,limit)
   if(operation==='update')rows.forEach(row=>Object.assign(row,payload))
   if(operation==='delete')state.rows[table]=(state.rows[table]||[]).filter(row=>!rows.includes(row))
   if(operation==='insert'){const row={id:'new-file',...payload};(state.rows[table]||=[]).push(row);rows=[row]}
   return {data:structuredClone(single?(rows[0]||null):rows),error:null}
  }
  const query: any={select:(_fields?:string)=>query,eq:(key:string,value:unknown)=>{filters.push([key,value]);return query},order:()=>query,limit:(n:number)=>{limit=n;return query},insert:(data:Record<string,unknown>)=>{operation='insert';payload=data;return query},update:(data:Record<string,unknown>)=>{operation='update';payload=data;return query},delete:()=>{operation='delete';return query},single:async()=>resolve(true),then:(fulfilled:(value:unknown)=>unknown,rejected?:(error:unknown)=>unknown)=>Promise.resolve(resolve()).then(fulfilled,rejected)}
  return query
 }}
 const modules=new Map<string,Record<string,any>>()
 function load(relative:string):Record<string,any>{
  if(modules.has(relative))return modules.get(relative)!
  const exports:Record<string,any>={};modules.set(relative,exports)
  if(!compiled.has(relative))compiled.set(relative,ts.transpileModule(readFileSync(new URL('../src/'+relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)
  const require=(id:string):unknown=>{
   if(id==='@/lib/supabase/server')return {createClient:async()=>client}
   if(id==='next/cache')return {revalidatePath:(path:string)=>calls.push({kind:'revalidate',value:path})}
   if(id==='./deal-access')return load('lib/actions/deal-access.ts')
   if(id==='@/lib/utils/file-classify')return load('lib/utils/file-classify.ts')
   if(id==='node:crypto')return nodeRequire('node:crypto')
   throw new Error('Unexpected real dependency: '+id)
  }
  const fakeFetch=async(_url:string,options:{headers:Record<string,string>;body:string})=>{
   calls.push({kind:'email',value:structuredClone(options)})
   if(state.mailThrow)throw new Error('synthetic network timeout')
   return {ok:state.mailResponses.shift()??true}
  }
  runInNewContext(compiled.get(relative)!,{exports,module:{exports},require,process:{env:{RESEND_API_KEY:'synthetic-no-secret',NEXT_PUBLIC_APP_URL:'https://app.example.test'}},fetch:fakeFetch,Date,File,Promise,setTimeout,console})
  return exports
 }
 return {state,calls,designs:load('lib/actions/designs.ts'),thumbnails:load('lib/actions/product-thumbnail.ts'),rfq:load('lib/actions/rfq.ts')}
}
const image=()=>new File(['synthetic image'],'photo.png',{type:'image/png'})
const attachment=()=>new File(['synthetic PDF'],'design.pdf',{type:'application/pdf'})

test('explicit RFQ email failure and retry use the same provider idempotency key; successful send is recorded once',async()=>{
 const h=harness();h.state.mailResponses=[false,true]
 assert.ok((await h.rfq.emailRfqInvitation('invitation')).error)
 assert.equal(h.state.rows.rfq_factory_invitations[0].invitation_sent_at,null)
 assert.equal((await h.rfq.emailRfqInvitation('invitation')).error,null)
 assert.equal((await h.rfq.emailRfqInvitation('invitation')).error,null)
 const sends=h.calls.filter(c=>c.kind==='email').map(c=>c.value as {headers:Record<string,string>;body:string})
 assert.equal(sends.length,2);assert.equal(sends[0].headers['Idempotency-Key'],'rfq-invitation/invitation');assert.equal(sends[0].headers['Idempotency-Key'],sends[1].headers['Idempotency-Key'])
 assert.equal(sends[0].body,sends[1].body);assert.match(sends[0].body,/&lt;script&gt;/);assert.doesNotMatch(sends[0].body,/<script>/)
 assert.equal(h.calls.filter(c=>c.kind==='update:rfq_factory_invitations').length,1)
})
test('unknown RFQ send outcome retries with stable provider key; DB receipt failure is clearly reported',async()=>{
 const h=harness();h.state.mailThrow=true
 assert.ok((await h.rfq.emailRfqInvitation('invitation')).error)
 h.state.mailThrow=false;h.state.dbFailures.add('update:rfq_factory_invitations')
 assert.match((await h.rfq.emailRfqInvitation('invitation')).error,/送信済み.*保存に失敗/)
 const sends=h.calls.filter(c=>c.kind==='email').map(c=>(c.value as {headers:Record<string,string>}).headers['Idempotency-Key'])
 assert.deepEqual(sends,['rfq-invitation/invitation','rfq-invitation/invitation'])
})
for(const condition of ['closed','expired','mismatch','cancelled'])test(`RFQ ${condition} prevents provider send`,async()=>{
 const h=harness()
 if(condition==='closed')h.state.rows.rfq_requests[0].status='closed'
 if(condition==='expired')h.state.rows.external_forms[0].expires_at='2000-01-01'
 if(condition==='mismatch')h.state.rows.external_forms[0].related_id='other'
 if(condition==='cancelled')h.state.rows.external_forms[0].cancelled_at='2026-01-01'
 assert.ok((await h.rfq.emailRfqInvitation('invitation')).error);assert.equal(h.calls.filter(c=>c.kind==='email').length,0)
})
for(const action of ['design','thumbnail'])test(`${action} upload failure makes no DB record and preserves old file`,async()=>{
 const h=harness();h.state.uploadFailure=true
 const result=action==='design'?await h.designs.uploadDesignImage('deal',attachment()):await h.thumbnails.uploadProductThumbnail('product',image())
 assert.match(result.error,/Storage/);assert.equal(h.calls.filter(c=>c.kind.startsWith('insert:')||c.kind.startsWith('update:')).length,0);assert.equal(h.calls.filter(c=>c.kind==='remove').length,0)
})
for(const action of ['design','thumbnail'])test(`${action} DB registration failure removes only the newly uploaded blob`,async()=>{
 const h=harness();h.state.dbFailures.add(action==='design'?'insert:deal_design_files':'update:deal_products')
 const result=action==='design'?await h.designs.uploadDesignImage('deal',attachment()):await h.thumbnails.uploadProductThumbnail('product',image())
 assert.match(result.error,/synthetic DB failure/)
 const path=h.calls.find(c=>c.kind==='upload')!.value
 assert.deepEqual(h.calls.filter(c=>c.kind==='remove').map(c=>c.value),[[path]])
 assert.match(String(h.state.rows.deal_products[0].thumbnail_url),/old\.png$/)
})
test('failed upload cleanup is surfaced and failed DB deletion never removes the referenced blob',async()=>{
 const h=harness();h.state.dbFailures.add('insert:deal_design_files');h.state.cleanupFailure=true
 assert.match((await h.designs.uploadDesignImage('deal',attachment())).error,/取り消し.*失敗/)
 for(const action of ['design','thumbnail']){
  const x=harness();x.state.dbFailures.add(action==='design'?'delete:deal_design_files':'update:deal_products')
  const result=action==='design'?await x.designs.deleteDesignImage('file'):await x.thumbnails.clearProductThumbnail('product')
  assert.equal(result.success,false);assert.equal(x.calls.filter(c=>c.kind==='remove').length,0)
 }
})
test('thumbnail clear writes DB before removing its owned bucket blob; foreign bucket URLs are not deleted',async()=>{
 const h=harness();assert.equal((await h.thumbnails.clearProductThumbnail('product')).success,true)
 assert.ok(h.calls.findIndex(c=>c.kind==='update:deal_products')<h.calls.findIndex(c=>c.kind==='remove'))
 const foreign=harness();foreign.state.rows.deal_products[0].thumbnail_url='https://storage.example.test/storage/v1/object/public/other-bucket/deal/old.png'
 assert.equal((await foreign.thumbnails.clearProductThumbnail('product')).success,true);assert.equal(foreign.calls.filter(c=>c.kind==='remove').length,0)
})
for(const role of ['client','factory','logistics'])test(`${role} cannot call mail or mutate attachments/thumbnails`,async()=>{
 const h=harness(role)
 for(const call of [()=>h.rfq.emailRfqInvitation('invitation'),()=>h.designs.uploadDesignImage('deal',attachment()),()=>h.designs.deleteDesignImage('file'),()=>h.designs.updateDesignComment('file','x'),()=>h.designs.updateDesignCategory('file','photo'),()=>h.thumbnails.uploadProductThumbnail('product',image()),()=>h.thumbnails.clearProductThumbnail('product')])assert.match((await call()).error,/営業・管理者/)
 assert.equal(h.calls.filter(c=>['upload','remove','email'].includes(c.kind)||c.kind.startsWith('update:')||c.kind.startsWith('delete:')||c.kind.startsWith('insert:')).length,0)
})


test('attachment version lookup failure rolls back upload instead of silently issuing duplicate version',async()=>{
 const h=harness();h.state.dbFailures.add('read:deal_design_files')
 assert.match((await h.designs.uploadDesignImage('deal',attachment())).error,/添付履歴を取得/)
 assert.deepEqual(h.calls.filter(c=>c.kind==='remove').map(c=>c.value),[[h.calls.find(c=>c.kind==='upload')!.value]])
 assert.equal(h.calls.filter(c=>c.kind==='insert:deal_design_files').length,0)
})
