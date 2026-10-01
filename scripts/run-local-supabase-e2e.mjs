// Loads keys in memory only. Refuses remote URLs and containers bound beyond loopback.
import {execFileSync,spawn} from 'node:child_process'
import {readFileSync,readdirSync} from 'node:fs'
// Refuse stale copies before creating any synthetic user or transaction.
for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!/^(011|015)/.test(f)))
 if(!readFileSync(`supabase/migrations/${file}`).equals(readFileSync(`local-supabase/supabase/migrations/${file}`)))throw Error(`Local migration differs from source: ${file}. Rebuild the dedicated synthetic database first.`)
const env={...process.env,DOCKER_CONTEXT:'colima'}
const inspected=JSON.parse(execFileSync('docker',['--context','colima','inspect','supabase_kong_baoflow-codex-20260930','supabase_db_baoflow-codex-20260930','supabase_inbucket_baoflow-codex-20260930'],{env,stdio:['ignore','pipe','pipe']}))
for(const c of inspected)for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const b of bindings||[])if(b.HostIp!=='127.0.0.1')throw Error('Local Supabase must bind only to loopback')
if(inspected.some(c=>c.Name.includes('inbucket')&&c.Config.Env.some(v=>/SMTP_RELAY|SMTP_FORWARD/.test(v))))throw Error('Mailpit must have no external relay')
const status=JSON.parse(execFileSync('supabase',['status','--workdir','local-supabase','-o','json'],{env,stdio:['ignore','pipe','pipe']}))
if(status.API_URL!=='http://127.0.0.1:55321')throw Error('Refusing any non-local Supabase')
const recoveryPolicies=execFileSync('docker',['--context','colima','exec','supabase_db_baoflow-codex-20260930','psql','-U','postgres','-d','postgres','-At','-c',"select count(*) from pg_policies where schemaname='public' and policyname in ('rfq_creation_request_owner_read','document_issue_request_owner_read')"],{env,stdio:['ignore','pipe','pipe']}).toString().trim()
if(recoveryPolicies!=='2')throw Error('Applied local recovery policies differ from source. Rebuild the dedicated synthetic database first.')
const child=spawn('node',['node_modules/@playwright/test/cli.js','test','--config','playwright.local.config.ts',...process.argv.slice(2)],{stdio:'inherit',env:{...env,LOCAL_SUPABASE_URL:status.API_URL,LOCAL_SUPABASE_SERVICE_KEY:status.SERVICE_ROLE_KEY,LOCAL_SUPABASE_ANON_KEY:status.ANON_KEY,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3200',RESEND_API_KEY:'local-capture-only-no-provider-key',RFQ_MAIL_FROM:'Synthetic BAO <sender@example.test>',NODE_OPTIONS:(env.NODE_OPTIONS||'')+' --require='+new URL('local-mailpit-fetch.cjs',import.meta.url).pathname}})
child.on('exit',code=>process.exit(code??1))
