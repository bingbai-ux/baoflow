// Loads keys in memory only. Refuses remote URLs and containers bound beyond loopback.
import {execFileSync,spawn} from 'node:child_process'
const env={...process.env,DOCKER_CONTEXT:'colima'}
const inspected=JSON.parse(execFileSync('docker',['--context','colima','inspect','supabase_kong_baoflow-codex-20260930','supabase_db_baoflow-codex-20260930'],{env,stdio:['ignore','pipe','pipe']}))
for(const c of inspected)for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const b of bindings||[])if(b.HostIp!=='127.0.0.1')throw Error('Local Supabase must bind only to loopback')
const status=JSON.parse(execFileSync('supabase',['status','--workdir','local-supabase','-o','json'],{env,stdio:['ignore','pipe','pipe']}))
if(status.API_URL!=='http://127.0.0.1:55321')throw Error('Refusing any non-local Supabase')
const child=spawn('node',['node_modules/@playwright/test/cli.js','test','--config','playwright.local.config.ts'],{stdio:'inherit',env:{...env,LOCAL_SUPABASE_URL:status.API_URL,LOCAL_SUPABASE_SERVICE_KEY:status.SERVICE_ROLE_KEY,LOCAL_SUPABASE_ANON_KEY:status.ANON_KEY,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3200',RESEND_API_KEY:''}})
child.on('exit',code=>process.exit(code??1))
