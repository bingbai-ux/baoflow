import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('release preflight runs read only on missing optional schema and rolls back',async()=>{
 const sql=await readFile(new URL('../scripts/preflight-release-038-047.sql',import.meta.url),'utf8')
 const db=new PGlite()
 try{
  await db.exec(sql)
  assert.equal((await db.query<{n:number}>("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n,0)
  assert.match(sql,/begin transaction read only/i)
  assert.match(sql,/rollback;/i)
  assert.equal((await db.query<{transaction_read_only:string}>('show transaction_read_only')).rows[0].transaction_read_only,'off')
 }finally{await db.close()}
})
