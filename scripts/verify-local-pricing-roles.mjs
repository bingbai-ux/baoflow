// Synthetic localhost-only role checks. Keys/passwords stay in memory and are never logged.
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const env={...process.env,DOCKER_CONTEXT:'colima'}
const status=JSON.parse(execFileSync('supabase',['status','--workdir','local-supabase','-o','json'],{env,stdio:['ignore','pipe','pipe']}))
if(status.API_URL!=='http://127.0.0.1:55321')throw Error('Localhost only')
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,options)
const source=await admin.from('deal_quotes').select('id').not('variant_id','is',null).gt('factory_unit_price_usd',0).limit(1).single()
if(source.error)throw Error('Synthetic source quote required')
const input={mode:'ratio',value:.5,tax_rate:10,fx:{rate:150,reference:'Synthetic role test',as_of:'2026-09-30T00:00:00Z',confirmed:true},cost_lines:['plate','color','domestic_freight','international_freight','other'].map(kind=>({key:kind,kind,name:kind,amount:0,currency:'USD',confirmed:true}))}
const created=[]
try{
 for(const role of ['sales','admin','client','factory','logistics']){
  const email=`pricing-${randomUUID()}@example.test`,password=randomUUID()+randomUUID(),user=await admin.auth.admin.createUser({email,password,email_confirm:true})
  if(user.error||!user.data.user)throw Error('Local user setup failed');created.push(user.data.user.id)
  const profile=await admin.from('profiles').update({role}).eq('id',user.data.user.id);if(profile.error)throw Error('Local role setup failed')
  const client=createClient(status.API_URL,status.ANON_KEY,options),login=await client.auth.signInWithPassword({email,password});if(login.error)throw Error('Local login failed')
  const preview=await client.rpc('preview_quote_pricing_v2',{p_quote_id:source.data.id,p_input:input})
  if(['sales','admin'].includes(role)){if(preview.error||!preview.data)throw Error('Staff preview denied')}
  else {
   if(!preview.error)throw Error('External role preview permitted')
   const save=await client.rpc('save_quote_pricing_v2',{p_request_id:randomUUID(),p_quote_id:source.data.id,p_input:input,p_expected:{}});if(!save.error)throw Error('External role save permitted')
   const lines=await client.from('quote_cost_lines').select('id').limit(1);if(!lines.error&&lines.data.length)throw Error('External role read leaked costs')
  }
  const write=await client.from('quote_cost_lines').insert({quote_id:source.data.id,line_key:'attack',kind:'custom',name:'Synthetic attack',amount:1,currency:'USD',amount_usd:1});if(write.error?.code!=='42501')throw Error('Direct cost write not denied by permission')
 }
 const anon=createClient(status.API_URL,status.ANON_KEY,options),preview=await anon.rpc('preview_quote_pricing_v2',{p_quote_id:source.data.id,p_input:input});if(preview.error?.code!=='42501')throw Error('Anon RPC execute not denied')
 console.log('PASS actual localhost roles: sales/admin preview; client/factory/logistics preview/save/cost read denied; every authenticated direct cost write denied; anon execute denied')
}finally{for(const id of created){const deleted=await admin.auth.admin.deleteUser(id);if(deleted.error)throw Error('Synthetic role cleanup failed')}}
