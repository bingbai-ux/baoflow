// Local Auth protocol simulation + the repository's actual claim RPC and PostgreSQL RLS.
// No production keys, mail transport, real passwords or external connections.
import http from 'node:http'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite()
const actor='11111111-1111-4111-8111-111111111111'
const otherActor='11111111-1111-4111-8111-111111111112'
const staffActor='11111111-1111-4111-8111-111111111113'
const ids={client:'22222222-2222-4222-8222-222222222222',factory:'33333333-3333-4333-8333-333333333333',logistics:'44444444-4444-4444-8444-444444444444',foreignClient:'22222222-2222-4222-8222-222222222223',foreignFactory:'33333333-3333-4333-8333-333333333334'}
const fixtureKey='synthetic-company-invitation-only'
const schema=`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
create type user_role as enum ('sales','admin','client','factory','logistics');
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table clients(id uuid primary key,company_name text,short_name text);
create table factories(id uuid primary key,factory_name text,name_cn text);
create table logistics_partners(id uuid primary key,name text);
create table profiles(id uuid primary key,role user_role,email text,display_name text,client_id uuid references clients(id),factory_id uuid references factories(id),logistics_partner_id uuid references logistics_partners(id));
create table external_forms(id uuid primary key,form_type text,token text unique,status text,cancelled_at timestamptz,expires_at timestamptz,context jsonb,submitted_at timestamptz,submitted_by_email text,related_id uuid,submission_data jsonb);
create table inventory_items(id uuid primary key,client_id uuid references clients(id),item_name text,item_code text,unit text,quantity_on_hand int,cartons_on_hand int,updated_at timestamptz);
create table factory_purchase_orders(id uuid primary key,factory_id uuid);
create table inventory_transactions(id uuid,item_id uuid,tx_type text,occurred_on date,created_at timestamptz);
create table inbound_shipments(id uuid,client_id uuid,created_at timestamptz);
create table shipment_requests(id uuid,client_id uuid,created_at timestamptz);
grant usage on schema public,auth to anon,authenticated;
grant update on profiles,external_forms to authenticated;
grant select on profiles,clients,factories,logistics_partners,inventory_items,factory_purchase_orders,inventory_transactions,inbound_shipments,shipment_requests,external_forms to authenticated;
alter table profiles enable row level security;create policy read_own_profile on profiles for select to authenticated using(id=auth.uid());`
await db.exec(schema)
function extractFunction(file,name){const source=readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8');const start=source.indexOf('create or replace function public.'+name+'(');if(start<0)throw Error('Missing local fixture function');return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3)}
for(const fn of ['is_staff','is_logistics','my_client_id'])await db.exec(extractFunction('034_role_based_rls.sql',fn))
await db.exec(extractFunction('036_portal_extensions.sql','my_factory_id'))
await db.exec(extractFunction('032_external_forms_anon_rpc.sql','ext_form_by_token'))
await db.exec('revoke all on function ext_form_by_token(text) from public;grant execute on function ext_form_by_token(text) to anon,authenticated;')
await db.exec(readFileSync(new URL('../../supabase/migrations/20261003070321_account_invite_recipient_binding.sql',import.meta.url),'utf8'))
for(const table of ['clients','factories','logistics_partners','external_forms','inventory_items','factory_purchase_orders','inventory_transactions','inbound_shipments','shipment_requests'])await db.exec(`alter table ${table} enable row level security;create policy staff_full_access on ${table} for all to authenticated using(public.is_staff()) with check(public.is_staff());`)
// Copy the existing client/warehouse policies verbatim where these minimal tables support them.
const source=readFileSync(new URL('../../supabase/migrations/034_role_based_rls.sql',import.meta.url),'utf8')
for(const table of ['clients','inventory_items','inbound_shipments','shipment_requests']){
 for(const match of source.matchAll(new RegExp('create policy[^;]+on public\\.'+table+'\\s[^;]+;','g')))await db.exec(match[0])
}
const factorySource=readFileSync(new URL('../../supabase/migrations/036_portal_extensions.sql',import.meta.url),'utf8')
const factoryPolicyStart=factorySource.indexOf('create policy "factory_read_own"')
await db.exec(factorySource.slice(factoryPolicyStart,factorySource.indexOf(';',factoryPolicyStart)+1))
await db.exec('create policy factory_read_own_order on factory_purchase_orders for select to authenticated using(factory_id=public.my_factory_id());')

let counters, sessions, passwordSet, authUsed, flags, targetRole, email, releasePassword, sessionSequence=0
function jwt(id){return [{alg:'HS256',typ:'JWT'},{sub:id,exp:4102444800,iat:1700000000,role:'authenticated',session_id:'synthetic-session-'+(++sessionSequence)},'synthetic'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')}
async function user(id){return (await db.query('select id,email,email_confirmed_at from auth.users where id=$1',[id])).rows[0]}
async function session(id){const u=await user(id);const access=jwt(id);sessions.set(access,id);return {access_token:access,refresh_token:'synthetic-refresh-'+id,expires_in:3600,expires_at:4102444800,token_type:'bearer',user:{...u,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}}}
async function reset(options={}){
 targetRole=options.role||'client';email='local+'+targetRole+'@example.test'
 counters={verified:0,passwordAttempts:0,updates:0,claims:0,claimed:0,signups:0,logins:0,mailSent:0}
 sessions=new Map();passwordSet=new Set([otherActor,staffActor]);authUsed=false;flags={};releasePassword=null
 await db.exec('delete from inventory_items;delete from external_forms;delete from profiles;delete from auth.users;delete from clients;delete from factories;delete from logistics_partners;')
 await db.query('insert into clients values($1,$2,$3),($4,$5,$6)',[ids.client,'Synthetic own company','Synthetic own company',ids.foreignClient,'Synthetic other company','Synthetic other company'])
 await db.query('insert into factories values($1,$2,null),($3,$4,null)',[ids.factory,'Synthetic own factory',ids.foreignFactory,'Synthetic other factory'])
 await db.query('insert into logistics_partners values($1,$2)',[ids.logistics,'Synthetic shared warehouse'])
 await db.query('insert into auth.users values($1,$2,null),($3,$4,now()),($5,$6,now())',[actor,email,otherActor,'local+other@example.test',staffActor,'local+staff@example.test'])
 await db.query('insert into profiles(id,role,email,display_name) values($1,$2,$3,$4),($5,$2,$6,$7),($8,$9,$10,$11)',[actor,'client',email,'Synthetic invite user',otherActor,'local+other@example.test','Synthetic other user',staffActor,'admin','local+staff@example.test','Synthetic staff'])
 await db.query('insert into external_forms(id,form_type,token,status,expires_at,context) values($1,$2,$3,$4,$5,$6)',[
 '55555555-5555-4555-8555-555555555555','account_invite',fixtureKey,'pending','2100-01-01T00:00:00Z',JSON.stringify({portal_role:targetRole,recipient_email:email,label:'Synthetic target company',client_id:targetRole==='client'?ids.client:null,factory_id:targetRole==='factory'?ids.factory:null,partner_id:targetRole==='logistics'?ids.logistics:null})])
 await db.query('insert into inventory_items values($1,$2,$3,$4,$5,1,1,now()),($6,$7,$8,$9,$5,1,1,now())',['66666666-6666-4666-8666-666666666661',ids.client,'Synthetic own stock','OWN','個','66666666-6666-4666-8666-666666666662',ids.foreignClient,'Synthetic other stock','OTHER'])
}
await reset()
async function runAs(id,work){return db.transaction(async tx=>{await tx.query("select set_config('fixture.actor',$1,true)",[id||'']);await tx.exec('set local role '+(id?'authenticated':'anon'));return work(tx)})}
const tables=new Set(['profiles','clients','factories','inventory_items','inventory_transactions','inbound_shipments','shipment_requests','factory_purchase_orders','external_forms'])
const columns=new Set(['id','client_id','factory_id','item_id','tx_type','status','token','role'])
http.createServer(async(req,res)=>{
 res.setHeader('content-type','application/json');res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*');res.setHeader('access-control-allow-methods','GET,POST,PUT,PATCH,OPTIONS')
 if(req.method==='OPTIONS'){res.end();return}
 let raw='';for await(const chunk of req)raw+=chunk
 const input=raw?JSON.parse(raw):{},url=new URL(req.url,'http://127.0.0.1:55443'),path=url.pathname
 const bearer=req.headers.authorization?.replace(/^Bearer /,'');const id=sessions.get(bearer)
 const send=(data,status=200)=>{res.statusCode=status;res.end(status===204?'':JSON.stringify(data))}
 try{
  if(path==='/__reset'){await reset(input);send({ok:true});return}
  if(path==='/__configure'){flags={...flags,...input};send({ok:true});return}
  if(path==='/__release'){releasePassword?.();releasePassword=null;send({ok:true});return}
  if(path==='/__session'){if(!['other','staff','unconfirmed'].includes(input.actor))throw Error('Invalid local actor');send(await session(input.actor==='other'?otherActor:input.actor==='staff'?staffActor:actor));return}
  if(path==='/__form'){const changes={status:input.status,cancelled_at:input.cancelled?'2020-01-01T00:00:00Z':null,expires_at:input.expired?'2020-01-01T00:00:00Z':'2100-01-01T00:00:00Z'};await db.query('update external_forms set status=$1,cancelled_at=$2,expires_at=$3',[changes.status||'pending',changes.cancelled_at,changes.expires_at]);send({ok:true});return}
  if(path==='/__state'){send({...counters,authUsed,passwordSet:passwordSet.has(actor),profiles:(await db.query('select * from profiles order by id')).rows,forms:(await db.query('select status,cancelled_at,submitted_at,related_id,context from external_forms')).rows});return}
  if(path==='/auth/v1/verify'){
   counters.verified++
   if(input.type!=='invite'||input.token_hash!=='a'.repeat(64)||authUsed||flags.authExpired){send({msg:'Synthetic confirmation link expired',error_code:'otp_expired'},403);return}
   authUsed=true;await db.query('update auth.users set email_confirmed_at=now() where id=$1',[actor]);send(await session(actor));return
  }
  if(path==='/auth/v1/signup'){counters.signups++;send({msg:'User already registered; use the synthetic Auth invitation',error_code:'user_already_exists'},422);return}
  if(path==='/auth/v1/token'){
   counters.logins++
   if(url.searchParams.get('grant_type')!=='password'){send({msg:'Unsupported synthetic Auth flow'},400);return}
   const record=(await db.query('select id,email_confirmed_at from auth.users where lower(email)=lower($1)',[input.email])).rows[0]
   if(!record?.email_confirmed_at||!passwordSet.has(record.id)||input.password!=='synthetic-password-only'){send({msg:'Synthetic invalid login credentials'},400);return}
   send(await session(record.id));return
  }
  if(path==='/auth/v1/logout'){sessions.delete(bearer);send(null,204);return}
  if(path==='/auth/v1/user'){
   if(!id){send({msg:'Synthetic session missing'},401);return}
   if(req.method==='PUT'){
    counters.passwordAttempts++
    if(flags.holdPassword){await new Promise(resolve=>{releasePassword=resolve});flags.holdPassword=false}
    if(flags.failPasswordOnce){flags.failPasswordOnce=false;send({msg:'Synthetic temporary Auth failure'},503);return}
    if(!sessions.has(bearer)){send({msg:'Synthetic session missing'},401);return}
    if(input.password!=='synthetic-password-only'){send({msg:'Unexpected synthetic password'},400);return}
    counters.updates++;passwordSet.add(id)
   }
   const u=await user(id);send({...u,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});return
  }
  if(path==='/rest/v1/rpc/claim_account_invite'){
   counters.claims++
   if(flags.failClaimOnce){flags.failClaimOnce=false;send({code:'P0001',message:'Synthetic temporary claim failure'},503);return}
   const result=await runAs(id,async tx=>(await tx.query('select claim_account_invite($1) as result',[input.p_token])).rows[0].result)
   if(result.success)counters.claimed++;send(result);return
  }
  if(path==='/rest/v1/rpc/ext_form_by_token'){const rows=await runAs(id,async tx=>(await tx.query('select * from ext_form_by_token($1)',[input.p_token])).rows);send(req.headers.accept?.includes('object')?(rows[0]||null):rows);return}
  if(['portal_my_deals','portal_factory_rfqs'].includes(path.split('/').pop())){send([]);return}
  if(req.method==='PATCH'&&['/rest/v1/profiles','/rest/v1/external_forms'].includes(path)){
   const table=path.split('/').pop(),allowed=table==='profiles'?['role','client_id']:['context']
   const entries=Object.entries(input);if(!entries.length||entries.some(([key])=>!allowed.includes(key)))throw Error('Unsupported synthetic update')
   const values=entries.map(([key,value])=>key==='context'?JSON.stringify(value):value)
   const assignments=entries.map(([key],index)=>'"'+key+'"=$'+(index+1)).join(',')
   const rows=await runAs(id,async tx=>(await tx.query('update '+table+' set '+assignments+' returning *',values)).rows)
   send(rows);return
  }
  if(path.startsWith('/rest/v1/')){
   const table=path.split('/').pop();if(!tables.has(table)||req.method!=='GET'){send({message:'Unsupported synthetic REST request'},400);return}
   const values=[],where=[]
   for(const [key,value]of url.searchParams){if(['select','order','limit'].includes(key))continue;if(!columns.has(key)||!value.startsWith('eq.'))throw Error('Unsupported synthetic REST filter');values.push(value.slice(3));where.push('"'+key+'"=$'+values.length)}
   let rows=await runAs(id,async tx=>(await tx.query('select * from '+table+(where.length?' where '+where.join(' and '):''),values)).rows)
   if(table==='inventory_items')rows=await Promise.all(rows.map(async row=>({...row,client:await runAs(id,async tx=>(await tx.query('select company_name,short_name from clients where id=$1',[row.client_id])).rows[0]||null),deal:null})))
   const single=req.headers.accept?.includes('object');if(single&&rows.length!==1){send({code:'PGRST116',message:'Synthetic no rows'},406);return}
   send(single?rows[0]:rows);return
  }
  send({message:'Unsupported synthetic endpoint'},404)
 }catch{send({code:'42501',message:'Synthetic authorization or query rejection'},403)}
}).listen(55443,'127.0.0.1',()=>console.log('Local synthetic invitation journey on 127.0.0.1:55443'))
