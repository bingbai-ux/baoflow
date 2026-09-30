// Only the existing, authorized synthetic local database; stream backup without a file.
import {spawn,spawnSync,execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const container='supabase_db_baoflow-codex-20260930',target='bao_restore_'+randomUUID().replaceAll('-','')
const prefix=['--context','colima','exec','-i',container]
const details=JSON.parse(execFileSync('docker',['--context','colima','inspect',container],{encoding:'utf8'}))[0]
for(const bs of Object.values(details.NetworkSettings.Ports||{}))for(const b of bs||[])assert.equal(b.HostIp,'127.0.0.1')
function sql(db,text){const r=spawnSync('docker',[...prefix,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{input:text,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
assert.equal(sql('postgres',"select count(*) from supabase_migrations.schema_migrations where name='050_storage_and_table_privileges'"),'1')
const sample=(db)=>sql(db,`select jsonb_build_object('quotes',(select count(*) from public.deal_quotes),'imports',(select count(*) from public.rfq_answer_imports),'receipts',(select count(*) from public.rfq_email_receipts),'history',(select count(*) from supabase_migrations.schema_migrations),'policies',(select count(*) from pg_policies where schemaname in ('public','storage')),'functions',(select count(*) from pg_proc where pronamespace='public'::regnamespace),'truncate',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and (has_table_privilege('anon',c.oid,'TRUNCATE') or has_table_privilege('authenticated',c.oid,'TRUNCATE'))))`)
let created=false
try{
 const before=sample('postgres');sql('postgres',`create database ${target}`);created=true
 const dump=spawn('docker',[...prefix,'pg_dump','-U','postgres','-d','postgres','--format=custom','--no-publications','--no-subscriptions'],{stdio:['ignore','pipe','pipe']})
 const restore=spawn('docker',[...prefix,'pg_restore','-U','supabase_admin','-d',target,'--exit-on-error','--no-publications','--no-subscriptions'],{stdio:['pipe','ignore','pipe']})
 let errors='';dump.stderr.on('data',b=>errors+=b);restore.stderr.on('data',b=>errors+=b);restore.stdin.on('error',()=>{})
 dump.stdout.pipe(restore.stdin)
 const result=await Promise.all([dump,restore].map(p=>new Promise((resolve,reject)=>{p.on('error',reject);p.on('exit',resolve)})))
 assert.deepEqual(result,[0,0],errors)
 assert.equal(sample(target),before,'Restore must preserve synthetic counts, history, policies/functions and grants')
 assert.equal(sql(target,"select to_regprocedure('public.import_pending_rfq_answer(uuid,uuid,uuid)') is not null and to_regprocedure('public.claim_rfq_email(uuid)') is not null"),'t')
 console.log('PASS localhost pg_dump → pg_restore streamed backup; data counts/history/RLS/functions/grants match')
}finally{
 if(created)sql('postgres',`drop database ${target} with (force)`)
 console.log('CLEANUP temporary restore database removed; no backup file or customer copy created')
}
