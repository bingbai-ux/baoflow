// Manual regression runner: cached official image, disposable local PostgreSQL only.
// No image pulls, network, published ports, host data mounts, real users or credentials.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const container = 'bao-invite-native-' + randomUUID().replaceAll('-', '')
const image = 'public.ecr.aws/supabase/postgres:17.6.1.167'
const docker = '/opt/homebrew/bin/docker'
const schema = 'bao_invite_fixture_' + randomUUID().replaceAll('-', '')
const actor = '10000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const form = '20000000-0000-4000-8000-000000000001'
const org = '30000000-0000-4000-8000-000000000001'
const fixtureKey = 'nonsecret-synthetic-fixture-not-an-invitation'
function run(args, input = '') {
  return new Promise(resolve => {
    const p = spawn(docker, ['--context', 'colima', ...args], {stdio:['pipe','pipe','pipe']})
    let stdout = '', stderr = ''
    p.stdout.on('data', b => stdout += b); p.stderr.on('data', b => stderr += b)
    p.on('error', e => resolve({code:-1, stdout, stderr:e.message}))
    p.on('close', code => resolve({code, stdout, stderr}))
    p.stdin.end(input)
  })
}
const raw = sql => run(['exec','-i','--user','postgres',container,'psql','-h','/tmp','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],sql)
async function sql(q) {const r=await raw(q);assert.equal(r.code,0,r.stderr);return r.stdout.trim()}
const claim = `select ${schema}.claim_account_invite('${fixtureKey}')`
function tx(user, q, hold, name, privileged=false) {
  return raw(`begin;set local application_name='${name}';set local statement_timeout='8s';${privileged?'':'set local role authenticated;'}select set_config('request.jwt.claim.sub','${user}',true);${q};${hold?'select pg_sleep(1.5);':''}commit;`)
}
async function reset() {
  await sql(`truncate ${schema}.external_forms,${schema}.profiles,${schema}.auth_users;
    insert into ${schema}.auth_users values('${actor}','owner+client@example.test',now()),('${other}','different@example.test',now());
    insert into ${schema}.profiles(id,role,email) values('${actor}','client','owner+client@example.test'),('${other}','client','different@example.test');
    insert into ${schema}.external_forms(id,token,form_type,status,context,expires_at) values('${form}','${fixtureKey}','account_invite','pending','{"portal_role":"client","recipient_email":"owner+client@example.test","client_id":"${org}"}',now()+interval '1 day');`)
}
async function race(label, firstUser, firstQ, secondUser, {privileged=false}={}) {
  const name = `${schema.slice(0,45)}_${label}`
  const a = tx(firstUser,firstQ,true,name,privileged)
  let holding=false
  for(let i=0;i<30;i++) {
    if(Number(await sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep'`))) {holding=true;break}
    await new Promise(r=>setTimeout(r,40))
  }
  assert.ok(holding,'First connection did not reach lock-holding barrier')
  const b = tx(secondUser,claim,false,name)
  let waited=false
  for(let i=0;i<15;i++) {
    if(Number(await sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event_type='Lock'`))) {waited=true;break}
    await new Promise(r=>setTimeout(r,40))
  }
  const result=await Promise.all([a,b]);assert.ok(waited,'Independent connections did not exhibit a database lock wait')
  for(const r of result) assert.equal(r.code,0,r.stderr)
  return result.map(r=>JSON.parse(r.stdout.split('\n').find(line=>line.startsWith('{'))))
}

let created=false
let containerStarted=false
try {
  const cached = await run(['image','inspect','--format','{{.Id}}',image])
  if(cached.code!==0) {
    console.log('BLOCKED: cached official Postgres image unavailable; no pull, database or container created.')
    process.exitCode=2
  } else {
    assert.match(cached.stdout.trim(),/^sha256:[a-f0-9]{64}$/)
    console.log('Cached image: '+image+' '+cached.stdout.trim())
    const launched=await run(['run','--detach','--rm','--pull','never','--name',container,
      '--network','none','--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=256m',
      '--cap-drop','ALL','--security-opt','no-new-privileges','--memory','512m','--pids-limit','128',
      '--user','postgres','--entrypoint','/bin/sh',cached.stdout.trim(),'-c',
      "initdb -D /tmp/bao-pgdata --auth-local=peer --auth-host=scram-sha-256 --encoding=UTF8 --no-locale >/tmp/initdb.log 2>&1 && exec postgres -D /tmp/bao-pgdata -c listen_addresses='' -c unix_socket_directories=/tmp -c shared_preload_libraries='' -c max_connections=20"])
    assert.equal(launched.code,0,launched.stderr)
    containerStarted=true
    const isolation=await run(['inspect','--format','{{json .HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}} {{json .Mounts}} {{json .HostConfig.ReadonlyRootfs}}',container])
    assert.equal(isolation.code,0,isolation.stderr)
    assert.equal(isolation.stdout.trim(),'"none" {} [] true','Container isolation guard failed')
    let ready=false
    for(let i=0;i<50;i++) {
      const probe=await raw('select 1;')
      if(probe.code===0 && probe.stdout.trim()==='1') {ready=true;break}
      await new Promise(r=>setTimeout(r,100))
    }
    assert.ok(ready,'Disposable Postgres did not become ready')
    console.log('Temporary database: '+await sql('select version();')+'; peer Unix socket; network none; no volumes.')
    await sql('create role anon nologin; create role authenticated nologin;')
    await sql(`create schema ${schema};`);created=true
    await sql(`create type ${schema}.user_role as enum('admin','sales','client','factory','logistics');
      create function ${schema}.actor_id() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table ${schema}.auth_users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create table ${schema}.profiles(id uuid primary key,role ${schema}.user_role,email text,client_id uuid,factory_id uuid,logistics_partner_id uuid);
      create table ${schema}.external_forms(id uuid primary key,token text unique,form_type text,status text,cancelled_at timestamptz,expires_at timestamptz,context jsonb,submitted_at timestamptz,submitted_by_email text,related_id uuid,submission_data jsonb);
      grant usage on schema ${schema} to authenticated;`)
    const migration=await readFile(new URL('../supabase/migrations/20261003070321_account_invite_recipient_binding.sql',import.meta.url),'utf8')
    const fixtureSql=migration.replaceAll('public.',schema+'.').replaceAll('auth.users',schema+'.auth_users').replaceAll('auth.uid()',schema+'.actor_id()').replace('set search_path = public',`set search_path = ${schema}`).replace('::user_role',`::${schema}.user_role`)
    await sql(fixtureSql)
    await reset()
    const same=await race('same',actor,claim,actor)
    assert.equal(same.filter(r=>r.success).length,1);assert.equal(same.filter(r=>!r.success).length,1)
    console.log('PASS independent same-invitation connections: observed lock wait; exactly one grant.')
    await reset()
    const different=await race('wrong_first',other,claim,actor)
    assert.equal(different[0].success,false);assert.equal(different[1].success,true)
    assert.equal(await sql(`select role='client' and client_id is null from ${schema}.profiles where id='${other}'`),'t')
    console.log('PASS wrong account races recipient: no wrong-account grant or premature consumption.')
    await reset()
    const promoted=await race('promote',actor,`update ${schema}.profiles set role='admin' where id='${actor}';select '{}'::json`,actor,{privileged:true})
    assert.equal(promoted[1].success,false)
    assert.equal(await sql(`select role='admin' from ${schema}.profiles where id='${actor}'`),'t')
    assert.equal(await sql(`select status='pending' from ${schema}.external_forms where id='${form}'`),'t')
    console.log('PASS concurrent staff promotion: admin remains protected and invitation remains unused.')
    await reset()
    const changed=await race('email_change',actor,`update ${schema}.auth_users set email='changed@example.test' where id='${actor}';select '{}'::json`,actor,{privileged:true})
    assert.equal(changed[1].success,false)
    assert.equal(await sql(`select status='pending' from ${schema}.external_forms where id='${form}'`),'t')
    console.log('PASS concurrent canonical-email change: stale recipient identity is rejected.')
  }
} finally {
  try {
    if(created) await sql(`drop schema ${schema} cascade;`)
  } finally {
    if(containerStarted) {
      const removed=await run(['rm','--force',container])
      const absent=await run(['inspect','--format','{{.Name}}',container])
      assert.ok(removed.code===0 || absent.code!==0,'Temporary container cleanup failed')
      assert.notEqual(absent.code,0,'Temporary container still exists')
      console.log('Temporary container and tmpfs database removed; existing databases untouched.')
    }
  }
}
