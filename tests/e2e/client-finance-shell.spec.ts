import {test,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
test.use({launchOptions:{args:['--disable-gpu']}})
const deal='33333333-3333-4333-8333-333333333333'
test.beforeEach(async({context,request})=>{
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 await request.post('http://127.0.0.1:55440/__reset')
 const user='11111111-1111-4111-8111-111111111111',jwt=[{alg:'HS256',typ:'JWT'},{sub:user,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
 const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:user,role:'authenticated',email:'local@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
})
test('staff empty-state, existing document exit, customer no-document state and unavailable link are usable on mobile',async({page,request})=>{
 await mkdir('artifacts/client-settlement-stage4',{recursive:true})
 await page.goto(`/deals/${deal}/settlement`);await expect(page.getByRole('heading',{name:'顧客承認・請求・実着金確認'})).toBeVisible()
 await expect(page.getByText('発行済み見積書・請求書がありません。案件の帳票画面で発行して戻ってください。')).toBeVisible()
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.locator('#main-content').screenshot({path:'artifacts/client-settlement-stage4/staff-empty-390.png'})
 await page.getByRole('link',{name:'帳票を発行・確認する',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/deals/${deal}/documents`))
 await request.post('http://127.0.0.1:55440/__role',{data:{role:'client'}})
 await page.goto('/portal/documents');await expect(page.getByText('共有された帳票はありません。見積・請求の予定は営業担当へお問い合わせください。')).toBeVisible()
 await page.screenshot({path:'artifacts/client-settlement-stage4/client-empty-390.png'})
 await page.goto('/portal/documents/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?token=synthetic-invalid');await expect(page.getByRole('alert').filter({hasText:'この帳票は確認できません'})).toBeVisible()
 await page.getByRole('link',{name:'自社の帳票一覧へ戻る'}).click();await expect(page).toHaveURL(/\/portal\/documents$/)
})
