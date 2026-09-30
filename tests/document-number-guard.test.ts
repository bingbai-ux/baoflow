import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('historical duplicates are retained; inserts and renumbering cannot create new duplicate numbers',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`create role anon;create role authenticated;create table documents(id uuid primary key default gen_random_uuid(),document_number text,metadata jsonb);
    create function is_staff() returns boolean language sql as 'select true';
    insert into documents(document_number) values('QUO-HISTORIC-001'),('QUO-HISTORIC-001');`)
  await db.exec(await readFile(new URL('../supabase/migrations/041_document_number_counter.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/046_document_number_guard.sql',import.meta.url),'utf8'))
  await db.exec(`update documents set metadata='{"historical":true}',document_number=document_number where document_number='QUO-HISTORIC-001'`)
  assert.equal((await db.query<{n:number}>('select count(*)::int n from documents')).rows[0].n,2)
  await assert.rejects(db.query("insert into documents(document_number) values('QUO-HISTORIC-001')"),/already in use/)
  await db.exec("insert into documents(document_number) values('NEW-001')")
  await assert.rejects(db.query("update documents set document_number='QUO-HISTORIC-001' where document_number='NEW-001'"),/already in use/)
  await db.exec('insert into documents(document_number) values(null),(null)')
  // An old writer may use a reserved number first, but the new writer then fails
  // safely rather than issuing a second document with the same number.
  const reserved=(await db.query<{n:string}>("select reserve_document_number('invoice') n")).rows[0].n
  await db.query('insert into documents(document_number) values($1)',[reserved])
  await assert.rejects(db.query('insert into documents(document_number) values($1)',[reserved]),/already in use/)
  const next=(await db.query<{n:string}>("select reserve_document_number('invoice') n")).rows[0].n
  assert.notEqual(next,reserved)
  await db.query('insert into documents(document_number) values($1)',[next])
 }finally{await db.close()}
})
