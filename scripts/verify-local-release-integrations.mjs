// Explicitly authorized localhost-only integration acceptance. No production configuration is loaded.
import {execFileSync,spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {runInNewContext} from 'node:vm'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {createClient} from '@supabase/supabase-js'
const env={...process.env,DOCKER_CONTEXT:'colima'},project='baoflow-codex-20260930',container=`supabase_db_${project}`
const docker=args=>execFileSync('docker',['--context','colima',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
const containers=docker(['ps','--format','{{.Names}}']).trim().split('\n').filter(n=>n.endsWith('_'+project))
assert.ok(containers.includes(container),'Authorized isolated project must be running')
for(const c of JSON.parse(docker(['inspect',...containers]))){
 for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const b of bindings||[])assert.equal(b.HostIp,'127.0.0.1','Refusing non-loopback services')
 if(c.Name.includes('inbucket'))assert.ok(!c.Config.Env.some(x=>/SMTP_RELAY|SMTP_FORWARD/.test(x)),'External mail relay must be disabled')
}
const status=JSON.parse(execFileSync('supabase',['status','--workdir','local-supabase','-o','json'],{env,stdio:['ignore','pipe','ignore']}))
assert.equal(status.API_URL,'http://127.0.0.1:55321');assert.equal(status.MAILPIT_URL,'http://127.0.0.1:55324')
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,options),anonymous=createClient(status.API_URL,status.ANON_KEY,options)
const uuid=Object.fromEntries(['client','factory','deal','product','variant','quantity','claimRequest'].map(k=>[k,randomUUID()]))
const users=[],clients=new Map(),messageIds=[],blobPaths=[];let providerCalls=0,mailMode='accepted'
const localSQL=text=>{const r=spawnSync('docker',['--context','colima','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:text,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data}
const rpc=async(client,name,args)=>ok(await client.rpc(name,args))
const require=createRequire(import.meta.url)
function actions(client){
 const modules=new Map()
 function load(path){if(modules.has(path))return modules.get(path);const exports={};modules.set(path,exports)
 const code=ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 const dependencies=name=>{
  if(name==='@/lib/supabase/server')return {createClient:async()=>client}
  if(name==='next/cache')return {revalidatePath:()=>{}}
  if(name==='./deal-access')return load('lib/actions/deal-access.ts')
  if(name==='@/lib/utils/file-classify')return load('lib/utils/file-classify.ts')
  if(name==='node:crypto')return require('node:crypto')
  throw Error('Unexpected dependency '+name)
 }
 const capture=async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails','Only the RFQ provider call may be intercepted');providerCalls++
  const mail=JSON.parse(options.body);assert.ok(mail.to.every(a=>a.endsWith('@example.test')));assert.match(mail.html,/http:\/\/127\.0\.0\.1:3200\/external\//)
  const result=await fetch(status.MAILPIT_URL+'/api/v1/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({From:{Email:'sender@example.test',Name:'Synthetic BAO'},To:mail.to.map(Email=>({Email})),Subject:mail.subject,HTML:mail.html,Tags:['baoflow-local-acceptance']})})
  assert.ok(result.ok,'Local Mailpit must capture the message');const body=await result.json();assert.ok(body.ID);messageIds.push(body.ID)
  if(mailMode==='lost-response')throw Error('Synthetic accepted mail response lost')
  return {ok:true,json:async()=>({id:body.ID})}
 }
 runInNewContext(code,{exports,module:{exports},require:dependencies,process:{env:{RESEND_API_KEY:'local-capture-only-no-provider-key',RFQ_MAIL_FROM:'Synthetic BAO <sender@example.test>',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3200'}},fetch:capture,Date,File,Promise,setTimeout,console})
 return exports}
 return {rfq:load('lib/actions/rfq.ts'),designs:load('lib/actions/designs.ts'),thumbnails:load('lib/actions/product-thumbnail.ts')}
}
const log=message=>console.log('PASS '+message)
try{
 assert.equal(localSQL("select count(*) from supabase_migrations.schema_migrations where name in ('048_pending_rfq_import','049_rfq_email_receipts','050_storage_and_table_privileges')"),'3')
 ok(await admin.from('clients').insert({id:uuid.client,company_name:'Synthetic local acceptance'}))
 ok(await admin.from('factories').insert({id:uuid.factory,factory_name:'Synthetic <factory>',basic_info_completed:true,contact_email:'factory@example.test'}))
 for(const role of ['admin','sales','client','factory','logistics']){
  const email=`${role}-${randomUUID()}@example.test`,password=randomUUID()+randomUUID()
  const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;assert.ok(user);users.push(user.id)
  ok(await admin.from('profiles').update({role,client_id:role==='client'?uuid.client:null,factory_id:role==='factory'?uuid.factory:null}).eq('id',user.id))
  const client=createClient(status.API_URL,status.ANON_KEY,options);ok(await client.auth.signInWithPassword({email,password}));clients.set(role,client)
 }
 const sales=clients.get('sales'),app=actions(sales)
 ok(await admin.from('deals').insert({id:uuid.deal,deal_code:'LOCAL-'+uuid.deal,deal_name:'Synthetic release acceptance',client_id:uuid.client}))
 ok(await admin.from('deal_products').insert({id:uuid.product,deal_id:uuid.deal,product_no:1,description:'Synthetic pouch'}))
 ok(await admin.from('deal_product_variants').insert({id:uuid.variant,product_id:uuid.product,variant_label:'A'}))
 ok(await admin.from('deal_quotes').insert({id:uuid.quantity,deal_id:uuid.deal,variant_id:uuid.variant,quantity:1234,status:'drafting'}))
 const create=async(pending)=>rpc(sales,'create_rfq_atomic',{p_request_id:randomUUID(),p_deal_id:uuid.deal,p_product_ids:[uuid.product],p_factory_ids:pending?[]:[uuid.factory],p_pending_factories:pending?[{name:'Synthetic pending',email:'pending@example.test'}]:[]})
 const pending=await create(true),inv=pending.invitations[0]
 const answer={products:[{product_id:uuid.product,variant_id:uuid.variant,unit_price_usd:0.2,moq:100,pcs_per_carton:200,carton_w_cm:10,carton_h_cm:20,carton_d_cm:30,gross_weight_kg:12,production_lead_days:15}]}
 await rpc(anonymous,'ext_submit_rfq',{p_token:inv.formToken,p_payload:answer})
 assert.equal(ok(await admin.from('deal_quotes').select('id').eq('source_type','rfq_response').eq('deal_id',uuid.deal)).length,0)
 const args={p_deal_id:uuid.deal,p_invitation_id:inv.invitationId,p_factory_id:uuid.factory}
 const imported=await rpc(sales,'import_pending_rfq_answer',args),replay=await rpc(sales,'import_pending_rfq_answer',args);assert.deepEqual(imported.quoteIds,replay.quoteIds)
 const q=ok(await admin.from('deal_quotes').select('quantity,factory_id,factory_response').eq('source_type','rfq_response').eq('deal_id',uuid.deal));assert.equal(q.length,1);assert.equal(q[0].quantity,1234);assert.equal(q[0].factory_id,uuid.factory);assert.deepEqual(q[0].factory_response.line,answer.products[0])
 for(const role of ['client','factory','logistics']){assert.ok((await clients.get(role).rpc('import_pending_rfq_answer',args)).error);assert.equal(ok(await clients.get(role).from('rfq_answer_imports').select('invitation_id')).length,0);assert.ok((await clients.get(role).from('rfq_answer_imports').delete().eq('invitation_id',inv.invitationId)).error)}
 assert.ok((await anonymous.rpc('import_pending_rfq_answer',args)).error);log('actual Auth/PostgREST pending reply import, replay and external-role rejection')
 const path=uuid.deal+'/local-acceptance.pdf',content=new Uint8Array(Buffer.from('Synthetic local PDF data'));blobPaths.push(path)
 ok(await sales.storage.from('deal-images').upload(path,content,{contentType:'application/pdf',upsert:false}))
 const publicURL=sales.storage.from('deal-images').getPublicUrl(path).data.publicUrl;assert.ok(publicURL.startsWith(status.API_URL));assert.equal((await fetch(publicURL)).status,200)
 for(const [role,client]of [...clients].filter(([r])=>!['sales','admin'].includes(r)).concat([['anonymous',anonymous]])){
  const attack=uuid.deal+'/attack-'+role+'.pdf';blobPaths.push(attack);assert.ok((await client.storage.from('deal-images').upload(attack,content,{contentType:'application/pdf'})).error)
  await client.storage.from('deal-images').remove([path]);assert.equal((await fetch(publicURL)).status,200,'Forbidden delete must preserve the blob')
 }
 assert.ok((await sales.storage.from('deal-images').upload(randomUUID()+'/missing.pdf',content,{contentType:'application/pdf'})).error)
 assert.ok((await sales.storage.from('deal-images').update(path,content,{contentType:'application/pdf'})).error)
 ok(await clients.get('admin').storage.from('deal-images').remove([path]));assert.notEqual((await fetch(publicURL)).status,200)
 const uploaded=await app.designs.uploadDesignImage(uuid.deal,new File(['Synthetic PDF'],'acceptance.pdf',{type:'application/pdf'}));assert.equal(uploaded.error,null);assert.ok(uploaded.data?.id)
 assert.equal((await app.designs.deleteDesignImage(uploaded.data.id)).success,true)
 const thumb=await app.thumbnails.uploadProductThumbnail(uuid.product,new File(['Synthetic PNG'],'acceptance.png',{type:'image/png'}));assert.equal(thumb.error,null);assert.equal((await app.thumbnails.clearProductThumbnail(uuid.product)).success,true)
 log('actual Storage upload/read/cleanup; admin/sales positive and client/factory/logistics/anon direct attacks rejected')
 assert.equal(localSQL("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and (has_table_privilege('anon',c.oid,'TRUNCATE') or has_table_privilege('authenticated',c.oid,'TRUNCATE'))"),'0');log('actual PostgreSQL public TRUNCATE grants removed')
 for(const mode of ['accepted','receipt-failure','lost-response']){
  const r=await create(false),invitationId=r.invitations[0].invitationId;mailMode=mode==='lost-response'?mode:'accepted'
  if(mode==='receipt-failure')localSQL(`create function local_fail_receipt() returns trigger language plpgsql as $$begin if new.invitation_id='${invitationId}' then raise exception 'Synthetic receipt failure';end if;return new;end$$;create trigger local_fail_receipt before update on rfq_email_receipts for each row execute function local_fail_receipt();`)
  const before=providerCalls,first=await app.rfq.emailRfqInvitation(invitationId)
  if(mode==='accepted')assert.equal(first.error,null);else assert.ok(first.error)
  if(mode==='receipt-failure')localSQL('drop trigger local_fail_receipt on rfq_email_receipts;drop function local_fail_receipt()')
  localSQL(`update rfq_email_receipts set started_at=now()-interval '30 days' where invitation_id='${invitationId}'`)
  const second=await app.rfq.emailRfqInvitation(invitationId);if(mode==='accepted')assert.equal(second.error,null);else assert.match(second.error,/再送を停止/)
  assert.equal(providerCalls-before,1)
  const receipt=ok(await admin.from('rfq_email_receipts').select('status,provider_message_id').eq('invitation_id',invitationId).single())
  assert.equal(receipt.status,mode==='accepted'?'accepted':mode==='lost-response'?'unknown':'attempting')
  if(mode==='accepted')assert.equal(receipt.provider_message_id,messageIds.at(-1))
  const message=await(await fetch(status.MAILPIT_URL+'/api/v1/message/'+messageIds.at(-1))).json();assert.match(message.HTML,/&lt;factory&gt;/);assert.match(message.Subject,/Quotation Request/)
  log('actual Mailpit capture '+mode+'; 30-day retry emits no second message')
 }
 const r=await create(false),claimArgs={p_invitation_id:r.invitations[0].invitationId}
 const claims=await Promise.all([sales.rpc('claim_rfq_email',claimArgs),sales.rpc('claim_rfq_email',claimArgs)]);assert.equal(claims.map(ok).filter(c=>c.claimed).length,1);log('concurrent actual PostgREST mail claims allow one sender')
 log('local integration acceptance complete: no remote provider or customer data')
}finally{
 localSQL('drop trigger if exists local_fail_receipt on public.rfq_email_receipts;drop function if exists local_fail_receipt()')
 const leftovers=ok(await admin.storage.from('deal-images').list(uuid.deal));if(leftovers.length)ok(await admin.storage.from('deal-images').remove(leftovers.map(f=>uuid.deal+'/'+f.name)))
 if(messageIds.length){const deleted=await fetch(status.MAILPIT_URL+'/api/v1/messages',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:messageIds})});assert.ok(deleted.ok)}
 localSQL(`begin;delete from rfq_email_receipts where invitation_id in (select i.id from rfq_factory_invitations i join rfq_requests r on r.id=i.rfq_id where r.deal_id='${uuid.deal}');delete from rfq_answer_imports where invitation_id in (select i.id from rfq_factory_invitations i join rfq_requests r on r.id=i.rfq_id where r.deal_id='${uuid.deal}');delete from rfq_creation_requests where payload->>'deal'='${uuid.deal}';update rfq_factory_invitations set external_form_id=null where rfq_id in (select id from rfq_requests where deal_id='${uuid.deal}');delete from external_forms where related_id in (select i.id from rfq_factory_invitations i join rfq_requests r on r.id=i.rfq_id where r.deal_id='${uuid.deal}');delete from rfq_requests where deal_id='${uuid.deal}';delete from deals where id='${uuid.deal}';delete from clients where id='${uuid.client}';delete from factories where id='${uuid.factory}';commit;`)
 for(const id of users)ok(await admin.auth.admin.deleteUser(id))
 console.log('CLEANUP own synthetic users/rows/blobs/messages removed')
}
