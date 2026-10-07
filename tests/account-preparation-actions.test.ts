import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'
import { requireSalesAccess } from '../src/lib/actions/deal-access'
import * as helpers from '../src/lib/utils/account-invites'

const org='20000000-0000-4000-8000-000000000001'
const other='20000000-0000-4000-8000-000000000002'
const email='owner+client@example.test'
const version='2026-09-30T00:00:00Z'
const input={portal_role:'client',recipient_email:email,client_id:org}
const context=helpers.prepareAccountInvite(input as helpers.AccountInviteInput).context!
const valid={form_type:'account_invite',token:'nonsecret-synthetic-fixture',status:'pending',cancelled_at:null,expires_at:'2100-01-01T00:00:00Z',created_at:version,context}

// Execute action filters and conditional writes in local PostgreSQL. All bearer values are synthetic.
async function harness(role: string | null='sales') {
  const db=new PGlite()
  await db.exec(`create table external_forms(id int generated always as identity primary key,form_type text,token text,status text,cancelled_at timestamptz,expires_at timestamptz,created_at timestamptz,context jsonb);
    create table factories(id uuid primary key,factory_name text,basic_info_completed boolean default false,contact_email text,contact_name text,name_cn text,contact_phone text,wechat text,address text,specialties jsonb,payment_terms text,default_payment_terms text,incoterm text,lead_time_range text,quality_stars numeric,delivery_stars numeric,price_stars numeric,since text,notes text,bank_info jsonb,updated_at timestamptz);`)
  let reads=0,writes=0
  let beforeWrite: (()=>Promise<void>) | null=null
  const client={auth:{getUser:async()=>({data:{user:role?{id:'fixture-actor'}:null},error:null})},from:(table: string)=>{
    if(table==='profiles')return {select:()=>({eq:()=>({single:async()=>({data:{role},error:null})})})}
    reads++
    const values:unknown[]=[],where:string[]=[]
    let patch:Record<string,unknown>|null=null, sort='',limit=''
    const bind=(value:unknown)=>{values.push(value);return '$'+values.length}
    const builder:any={select:()=>builder,
      eq:(key:string,value:unknown)=>{where.push(`"${key}" = ${bind(value)}`);return builder},
      is:(key:string,value:unknown)=>{assert.equal(value,null);where.push(`"${key}" is null`);return builder},
      gt:(key:string,value:unknown)=>{where.push(`"${key}" > ${bind(value)}`);return builder},
      contains:(key:string,value:unknown)=>{where.push(`"${key}" @> ${bind(JSON.stringify(value))}::jsonb`);return builder},
      order:(key:string,options:{ascending:boolean})=>{sort=` order by "${key}" ${options.ascending?'asc':'desc'}`;return builder},
      limit:(n:number)=>{limit=` limit ${n}`;return builder},
      update:(value:Record<string,unknown>)=>{patch=value;return builder},
      maybeSingle:async()=>{
        const conditions=where.length?' where '+where.join(' and '):''
        try {
          let sql
          if(patch){
            if(beforeWrite){const task=beforeWrite;beforeWrite=null;await task()}
            const assignments=Object.entries(patch).map(([key,value])=>`"${key}"=${bind(Array.isArray(value)?JSON.stringify(value):value)}`).join(',')
            sql=`with row as (update ${table} set ${assignments}${conditions} returning *) select row_to_json(row) as data from row`
          }else sql=`select row_to_json(row) as data from (select * from ${table}${conditions}${sort}${limit}) row`
          const result=await db.query<{data:Record<string,unknown>}>(sql,values)
          if(patch)writes+=result.rows.length
          return {data:result.rows[0]?.data||null,error:null}
        }catch{return {data:null,error:{message:'synthetic failure'}}}
      }}
    return builder
  }}
  function load(file:string){
    const exports:Record<string,any>={}
    const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/actions/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
    runInNewContext(compiled,{exports,Date,FormData,require:(name:string)=>{
      if(name==='crypto')return {}
      if(name==='next/cache')return {revalidatePath:()=>{}}
      if(name.includes('supabase/server'))return {createClient:async()=>client}
      if(name.includes('deal-access'))return {requireSalesAccess}
      if(name.includes('utils/account-invites'))return helpers
      throw Error('Unexpected test import')
    }})
    return exports
  }
  const invites=load('account-invites.ts'),factories=load('factories.ts')
  return {db,invites,factories,counts:()=>({reads,writes}),beforeWrite:(fn:()=>Promise<void>)=>{beforeWrite=fn},
    seedInvite:async(row:Record<string,any>=valid)=>{await db.query(`insert into external_forms(form_type,token,status,cancelled_at,expires_at,created_at,context) values($1,$2,$3,$4,$5,$6,$7)`,[row.form_type,row.token,row.status,row.cancelled_at,row.expires_at,row.created_at,JSON.stringify(row.context)])},
    seedFactory:async()=>{await db.query('insert into factories(id,factory_name,contact_email,notes,updated_at) values($1,$2,$3,$4,$5)',[org,'Synthetic factory',email,'Synthetic only; business details unknown',version])}}
}
function factoryForm(changes:Record<string,string>={}){
  const fd=new FormData()
  for(const [key,value]of Object.entries({factory_name:'Synthetic factory',contact_email:email,basic_info_reviewed:'on',notes:'Synthetic only; business details unknown',...changes}))fd.set(key,value)
  return fd
}

test('staff lookup is exact across recipient, organization and role; invalid lifecycle rows never return a token',async()=>{
  const h=await harness()
  try{
    for(const row of [
      {...valid,context:{...context,recipient_email:'owner@example.test'}},
      {...valid,context:{...context,client_id:other}},
      {...valid,context:{...context,portal_role:'factory',factory_id:org,client_id:null}},
      {...valid,context:{...context,factory_id:other}},
      {...valid,form_type:'rfq_response'}, {...valid,status:'submitted'}, {...valid,status:'cancelled'},
      {...valid,cancelled_at:version}, {...valid,expires_at:version}, {...valid,expires_at:null},
    ])await h.seedInvite(row)
    assert.equal((await h.invites.findAccountInvitation(input)).token,null)
    await h.seedInvite()
    for(const role of ['client','factory','logistics']){
      if(role!=='client')await h.seedInvite({...valid,context:helpers.prepareAccountInvite({portal_role:role,recipient_email:email,factory_id:org,partner_id:org} as helpers.AccountInviteInput).context})
      const result=await h.invites.findAccountInvitation({portal_role:role,recipient_email:' OWNER+CLIENT@EXAMPLE.TEST ',client_id:org,factory_id:org,partner_id:org})
      assert.equal(result.token,valid.token)
    }
    assert.equal((await h.invites.findAccountInvitation({...input,client_id:'20000000-0000-4000-8000-000000000003'})).token,null)
    assert.equal(h.counts().writes,0)
  }finally{await h.db.close()}
})

test('external roles and anonymous cannot read invites or complete any factory, even when IDs are known',async()=>{
  for(const role of ['client','factory','logistics',null]){
    const h=await harness(role)
    try{
      await h.seedInvite();await h.seedFactory()
      assert.ok((await h.invites.findAccountInvitation(input)).error)
      assert.ok((await h.factories.completeFactoryBasicInfo(org,factoryForm(),version)).error)
      assert.deepEqual(h.counts(),{reads:0,writes:0})
    }finally{await h.db.close()}
  }
})

test('parallel invite redisplay is read-only; cancelling or claiming before a later lookup removes access',async()=>{
  const h=await harness('admin')
  try{
    await h.seedInvite()
    const results=await Promise.all(Array.from({length:8},()=>h.invites.findAccountInvitation(input)))
    assert.ok(results.every(r=>r.token===valid.token));assert.equal(h.counts().writes,0)
    await h.db.exec("update external_forms set status='submitted'")
    assert.equal((await h.invites.findAccountInvitation(input)).token,null)
    await h.db.exec("update external_forms set status='pending',cancelled_at=now()")
    assert.equal((await h.invites.findAccountInvitation(input)).token,null)
  }finally{await h.db.close()}
})

test('factory completion requires explicit review, name and valid email; foreign/missing IDs and injected fields cannot complete',async()=>{
  const h=await harness()
  try{
    await h.seedFactory()
    for(const fd of [factoryForm({basic_info_reviewed:''}),factoryForm({factory_name:''}),factoryForm({contact_email:''}),factoryForm({contact_email:'bad'}),factoryForm({contact_email:'owner\n@example.test'})]){
      assert.ok((await h.factories.completeFactoryBasicInfo(org,fd,version)).error)
    }
    assert.ok((await h.factories.completeFactoryBasicInfo(other,factoryForm(),version)).error)
    assert.ok((await h.factories.completeFactoryBasicInfo(org,factoryForm(),'bad')).error)
    assert.equal(h.counts().writes,0)
    const r=await h.factories.completeFactoryBasicInfo(org,factoryForm({bank_info:'fabricated',id:other,contact_email:' OWNER+CLIENT@EXAMPLE.TEST '}),version)
    assert.equal(r.error,null);assert.equal(r.data.id,org);assert.equal(r.data.basic_info_completed,true)
    assert.equal(r.data.contact_email,email);assert.equal(r.data.bank_info,null)
    assert.equal(r.data.address,null);assert.equal(r.data.contact_phone,null)
    assert.equal(r.data.notes,'Synthetic only; business details unknown')
    assert.equal((await h.db.query<{count:number}>('select count(*)::int as count from factories')).rows[0].count,1)
    assert.ok((await h.factories.updateFactoryRecord(org,factoryForm({contact_email:''}),r.data.updated_at)).error)
  }finally{await h.db.close()}
})

test('simultaneous factory completion/edit uses conditional PostgreSQL update and cannot overwrite a newer save',async()=>{
  const h=await harness()
  try{
    await h.seedFactory()
    const results=await Promise.all([
      h.factories.completeFactoryBasicInfo(org,factoryForm(),version),
      h.factories.updateFactoryRecord(org,factoryForm({factory_name:'Concurrent saved name'}),version),
    ])
    assert.equal(results.filter(r=>!r.error).length,1);assert.equal(h.counts().writes,1)
    const winner=results.find(r=>!r.error)!
    assert.ok((await h.factories.completeFactoryBasicInfo(org,factoryForm(),version)).error)
    const retry=await h.factories.completeFactoryBasicInfo(org,factoryForm({factory_name:String(winner.data.factory_name)}),winner.data.updated_at)
    assert.equal(retry.error,null);assert.equal(retry.data.basic_info_completed,true)
    // Update after validation, before write: the second version check must still reject it.
    h.beforeWrite(async()=>{await h.db.query("update factories set factory_name='Newer editor',updated_at='2100-01-01T00:00:00Z' where id=$1",[org])})
    assert.ok((await h.factories.completeFactoryBasicInfo(org,factoryForm(),retry.data.updated_at)).error)
    assert.equal((await h.db.query<{factory_name:string}>('select factory_name from factories')).rows[0].factory_name,'Newer editor')
  }finally{await h.db.close()}
})

test('existing PostgreSQL staff RLS hides invitation tokens and forbids external factory writes, including own factory',async()=>{
  const db=new PGlite()
  try{
    const policySource=readFileSync(new URL('../supabase/migrations/034_role_based_rls.sql',import.meta.url),'utf8')
    const factorySource=readFileSync(new URL('../supabase/migrations/036_portal_extensions.sql',import.meta.url),'utf8')
    const extract=(source:string,name:string)=>{
      const start=source.indexOf('create or replace function public.'+name+'(')
      assert.ok(start>=0)
      return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3)
    }
    await db.exec(`create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
      create table profiles(id uuid,role text,factory_id uuid);
      create table factories(id uuid,basic_info_completed boolean);
      create table external_forms(token text);
      alter table factories enable row level security;alter table external_forms enable row level security;
      grant usage on schema public,auth to authenticated;
      grant select,update on factories to authenticated;grant select on external_forms to authenticated;`)
    await db.exec(extract(policySource,'is_staff'))
    await db.exec(extract(factorySource,'my_factory_id'))
    for(const table of ['factories','external_forms'])await db.exec(`create policy staff_full_access on ${table} for all to authenticated using(public.is_staff()) with check(public.is_staff());`)
    const start=factorySource.indexOf('create policy "factory_read_own"')
    await db.exec(factorySource.slice(start,factorySource.indexOf(';',start)+1))
    await db.query('insert into profiles values($1,$2,$3)',[org,'sales',org])
    await db.query('insert into factories values($1,false),($2,false)',[org,other])
    await db.query('insert into external_forms values($1)',[valid.token])
    await db.query("select set_config('fixture.actor',$1,false)",[org])
    for(const role of ['client','factory','logistics','unknown','sales','admin']){
      await db.exec('reset role')
      await db.query('update profiles set role=$1,factory_id=$2',[role,role==='factory'?org:null])
      await db.exec('set role authenticated')
      const invites=await db.query('select token from external_forms')
      assert.equal(invites.rows.length,['sales','admin'].includes(role)?1:0)
      const visible=await db.query('select id from factories')
      assert.equal(visible.rows.length,['sales','admin'].includes(role)?2:role==='factory'?1:0)
      const updates=await db.query('update factories set basic_info_completed=true returning id')
      assert.equal(updates.rows.length,['sales','admin'].includes(role)?2:0)
    }
    await db.exec('reset role')
    await db.query("select set_config('fixture.actor','',false)")
    await db.exec('set role authenticated')
    assert.equal((await db.query('select token from external_forms')).rows.length,0)
  }finally{await db.close()}
})
