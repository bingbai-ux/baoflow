import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('atomic counter survives historic duplicates, four digit numbers, failed issuance and unauthorized calls', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create table documents(document_number text);
      create function is_staff() returns boolean language sql as 'select current_setting(''test.staff'', true) = ''yes''';
      set test.staff = 'yes';`)
    await db.exec(await readFile(new URL('../supabase/migrations/041_document_number_counter.sql', import.meta.url), 'utf8'))
    const base = `QUO-${new Date().toISOString().slice(0,7).replace('-', '')}-`
    await db.query('insert into documents values ($1), ($1), ($2)', [base + '999', base + '1000'])
    const numbers = await Promise.all(Array.from({length: 5}, () => db.query<{n: string}>("select reserve_document_number('quotation') as n")))
    assert.deepEqual(numbers.map(r => r.rows[0].n), [1001,1002,1003,1004,1005].map(n => base+n))
    await db.exec("set test.staff = 'no'")
    await assert.rejects(db.query("select reserve_document_number('invoice')"), /access required/)
    await db.exec("set test.staff = 'yes'")
    await assert.rejects(db.query("select reserve_document_number('bad')"), /Unsupported/)
  } finally { await db.close() }
})
