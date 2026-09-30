import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireSalesAccess } from '../src/lib/actions/deal-access'

type Supabase = Parameters<typeof requireSalesAccess>[0]
function syntheticAccess(role: string | null, authenticated=true): Supabase {
  return {
    auth:{getUser:async()=>({data:{user:authenticated?{id:'synthetic-user'}:null},error:null})},
    from:()=>({select:()=>({eq:()=>({single:async()=>({data:role?{role}:null,error:null})})})}),
  } as unknown as Supabase
}
for(const role of ['admin','sales']){
  test(`${role} server action access allowed`,async()=>assert.equal(await requireSalesAccess(syntheticAccess(role)),null))
}
for(const role of ['client','factory','logistics','unknown',null]){
  test(`${role} server action access denied independently of routing`,async()=>assert.match((await requireSalesAccess(syntheticAccess(role)))!,/営業・管理者/))
}
test('anonymous action access denied',async()=>assert.match((await requireSalesAccess(syntheticAccess('sales',false)))!,/ログイン/))
