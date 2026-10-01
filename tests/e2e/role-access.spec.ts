import { test, expect } from '@playwright/test'

// These tests prove application routing/action guards using synthetic profiles.
// They deliberately do not emulate, and cannot prove, production Supabase RLS.
const fixture='http://127.0.0.1:55440'
const userId='11111111-1111-4111-8111-111111111111'
const deal='/deals/33333333-3333-4333-8333-333333333333'
const homes={sales:'/',client:'/portal',factory:'/factory',logistics:'/logistics'} as const
const jwt=[{alg:'HS256',typ:'JWT'},{sub:userId,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')

test.beforeEach(async({context,request})=>{
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  await request.post(fixture+'/__reset')
  const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:userId,role:'authenticated',email:'local@example.test'}}
  await context.addCookies(['127.0.0.1','localhost'].map(domain=>({name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain,path:'/'})))
})

for(const role of Object.keys(homes) as Array<keyof typeof homes>){
  test(`${role}: own home accessible, other roles and staff pages separated`,async({page,request})=>{
    await request.post(fixture+'/__role',{data:{role}})
    const response=await page.goto(homes[role])
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe(homes[role])
    await expect(page.locator('body')).not.toContainText('Application error')
    for(const other of Object.keys(homes) as Array<keyof typeof homes>){
      if(other===role) continue
      await page.goto(homes[other])
      expect(new URL(page.url()).pathname).toBe(homes[role])
    }
    if(role!=='sales'){
      for(const path of [deal,'/inventory','/settings','/docs']){
        await page.goto(path);expect(new URL(page.url()).pathname).toBe(homes[role])
      }
    }
    await page.goto(role==='sales'?'/portal/login':'/login')
    expect(new URL(page.url()).pathname).toBe(homes[role])
  })
}

test('unauthenticated users are sent to the matching role login',async({page,context})=>{
  await context.clearCookies()
  for(const [path,login] of [[deal,'/login'],['/portal','/portal/login'],['/factory','/factory/login'],['/logistics','/logistics/login']]){
    await page.goto(path);expect(new URL(page.url()).pathname).toBe(login)
  }
})

for(const role of ['client','factory','logistics'] as const){
  test(`${role}: cannot replay staff quote adoption from its own allowed route`,async({page,request})=>{
    await page.goto(deal+'/quote-builder')
    const actionPromise=page.waitForRequest(req=>req.method()==='POST'&&!!req.headers()['next-action'])
    await page.getByRole('button',{name:'この価格で採用',exact:true}).click()
    const action=await actionPromise
    await expect(page.getByRole('button',{name:'採用を解除',exact:true})).toBeVisible()
    await request.post(fixture+'/__reset')
    await request.post(fixture+'/__role',{data:{role}})
    const response=await page.request.post(homes[role],{headers:{'next-action':action.headers()['next-action'],'content-type':action.headers()['content-type'],'next-router-state-tree':action.headers()['next-router-state-tree'],origin:'http://127.0.0.1:3100',accept:'text/x-component'},data:action.postData()!})
    // Next's route action dispatcher may reject an unavailable action before the
    // action itself runs. Assert no mutation; independent guard is unit-tested.
    expect(await response.text()).not.toContain('\"success\":true')
    const state=await (await request.get(fixture+'/__state')).json()
    expect(state.deal_quotes[0].status).toBe('draft')
  })
}

test('deal decision summary and responsive workflow screenshots',async({page})=>{
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900})
    await page.goto(deal)
    const summary=page.getByLabel('案件の状況')
    const stage='after'
    await expect(summary).toBeVisible()
    {
      await expect(summary).toContainText('希望納期')
      await expect(summary).toContainText('2026/10/15')
      await expect(summary).toContainText('検証担当')
      await expect(summary).toContainText('営業対応')
    }
    await page.screenshot({path:`tmp/case-workspace/deal-summary-${stage}-${width}.png`,fullPage:true})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  }
})

test('waiting party is chosen directly and reflected in the decision summary',async({page,request})=>{
  await page.goto(deal)
  await page.getByText('変更',{exact:true}).click()
  await page.getByRole('combobox',{name:'案件の待ち先',exact:true}).selectOption('factory')
  await expect(page.getByLabel('案件の状況')).toContainText('工場の返答待ち')
  const state=await (await request.get(fixture+'/__state')).json()
  expect(state.deals[0].waiting_on).toBe('factory')
  await page.getByRole('combobox',{name:'案件の待ち先',exact:true}).selectOption('us')
  await expect(page.getByLabel('案件の状況')).toContainText('営業対応')
})
