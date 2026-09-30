import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

test('status and history commit together; archive guards and retries are safe',async()=>{
 const db=new PGlite();const id='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
 create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
 set test.staff='yes';
 create type public.simple_status as enum ('quoting','quote_confirmed','paid','data_confirmed','in_production','shipped','delivered');
 create table deals(id uuid primary key,master_status text not null,simple_status public.simple_status not null,last_activity_at timestamptz,archived_at timestamptz,archived_by uuid,archive_reason text,archive_note text);
 create table deal_status_history(id int generated always as identity,deal_id uuid,from_status text,to_status text not null,from_simple_status public.simple_status,to_simple_status public.simple_status,changed_by uuid,note text,kind text);
 insert into deals(id,master_status,simple_status) values('${id}','M01','quoting');`)
 await db.exec(await readFile(new URL('../supabase/migrations/039_deal_status_atomic.sql',import.meta.url),'utf8'))
 await db.query('select set_deal_simple_status($1,$2)',[id,'quote_confirmed'])
 assert.equal((await db.query<{n:number}>('select count(*)::int as n from deal_status_history')).rows[0].n,1)
 assert.equal((await db.query<{to_status:string}>('select to_status from deal_status_history')).rows[0].to_status,'M01')
 await db.query('select set_deal_simple_status($1,$2)',[id,'quote_confirmed'])
 assert.equal((await db.query<{n:number}>('select count(*)::int as n from deal_status_history')).rows[0].n,1)
 await assert.rejects(db.query('select set_deal_simple_status($1,$2,null,$3)',[id,'paid','quoting']),/状態が変わり/)
 await assert.rejects(db.query('select archive_deal_safely($1,true,$2)',[id,'completed']),/納品完了/)
 await db.exec(`create function fail_history() returns trigger language plpgsql as $$begin raise exception 'forced history failure';end$$;
 create trigger fail_history before insert on deal_status_history for each row execute function fail_history();`)
 await assert.rejects(db.query('select set_deal_simple_status($1,$2)',[id,'paid']),/forced history failure/)
 assert.equal((await db.query<{simple_status:string}>('select simple_status from deals')).rows[0].simple_status,'quote_confirmed')
 await db.exec('drop trigger fail_history on deal_status_history')
 await db.query('select archive_deal_safely($1,true,$2)',[id,'cancelled'])
 await assert.rejects(db.query('select set_deal_simple_status($1,$2)',[id,'paid']),/アーカイブ/)
 await db.query('select archive_deal_safely($1,false)',[id])
 await db.exec("set test.staff='no'")
 await assert.rejects(db.query('select set_deal_simple_status($1,$2)',[id,'paid']),/営業・管理者/)
 }finally{await db.close()}
})
