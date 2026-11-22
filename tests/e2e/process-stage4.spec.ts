import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test'

// 再設計 工程4（価格 → お見積の提示 → 承認 / 差し戻し）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 計算・承認・差し戻しの正しさ（SQL）は tests/process-stage4-sql.test.ts で別に検証している。
// このテストはメールを実際には送らない（送信キーを空にしてあり、送信できないときの表示を確認する）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000004', pA = 'aaaaaaaa-0000-4000-8000-0000000004b1', pB = 'aaaaaaaa-0000-4000-8000-0000000004b2'
const vA = 'aaaaaaaa-0000-4000-8000-0000000004c1', vB = 'aaaaaaaa-0000-4000-8000-0000000004c2'
const q = (n: number) => `aaaaaaaa-0000-4000-8000-0000000004e${n}`
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const panel = (page: Page) => page.getByRole('region', { name: '価格の提示' })
const field = (page: Page, name: string) => panel(page).getByRole('textbox', { name, exact: true })
const localOnly = (context: import('@playwright/test').BrowserContext) => context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
async function customerPage(browser: Browser) { // ログインしていない顧客のブラウザ
  const context = await browser.newContext(); await localOnly(context)
  return { context, page: await context.newPage() }
}
async function open(page: Page) { await page.goto(`/deals/${deal}?step=6`); await page.waitForLoadState('networkidle') }
async function fillPrices(page: Page) {
  await field(page, '平袋 1,000個 工場単価').fill('0.1')
  await field(page, '平袋 1,000個 諸費用').fill('50')
  await field(page, '平袋 1,000個 送料').fill('30')
  await field(page, '平袋 5,000個 工場単価').fill('0.08')
  await field(page, '平袋 5,000個 提示単価').fill('25.5')
  await field(page, 'スタンド袋 3,000個 工場単価').fill('0.2')
  await field(page, 'スタンド袋 3,000個 提示単価').fill('80')
  await field(page, '平袋 の製造日数').fill('25')
}
async function sendOffer(page: Page, round: number) {
  await panel(page).getByRole('button', { name: `第${round}回お見積を送る` }).click()
  await page.getByRole('dialog', { name: 'お見積を送る' }).getByRole('button', { name: '送る', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toContainText('メール送信の設定がありません') // テスト環境は送信設定なし → リンクを手渡しできる
  const link = await panel(page).getByRole('link').getAttribute('href')
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:3100\/external\/offer\/[0-9a-f]{64}$/)
  return link!
}

test.beforeEach(async ({ context, request }) => {
  await localOnly(context)
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
  await post(request, 'client_contacts', { id: 'aaaaaaaa-0000-4000-8000-0000000004d1', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-004', deal_name: '冬の新商品', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'us', sales_user_id: userId, process_stage: 3, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { id: pA, deal_id: deal, product_no: 1, sort_order: 1, description: '平袋', shipping_mode: 'sea', is_selected: false })
  await post(request, 'deal_products', { id: pB, deal_id: deal, product_no: 2, sort_order: 2, description: 'スタンド袋', shipping_mode: 'air', is_selected: false })
  await post(request, 'deal_product_variants', { id: vA, product_id: pA, variant_label: '標準', variant_order: 0, deal_products: { deal_id: deal } })
  await post(request, 'deal_product_variants', { id: vB, product_id: pB, variant_label: '標準', variant_order: 0, deal_products: { deal_id: deal } })
  for (const [n, variant_id, quantity] of [[1, vA, 1000], [2, vA, 5000], [3, vB, 3000]] as const) await post(request, 'deal_quotes', { id: q(n), deal_id: deal, variant_id, quantity, status: 'drafting', version: 1 })
})

test('原価率と提示単価が相互に計算され、保存 → 提示 → 顧客が数量を選んで承認すると請求へ進む', async ({ page, request, browser }) => {
  await open(page)
  await expect(panel(page)).toContainText('未提示')
  await fillPrices(page)
  const row = panel(page).getByRole('row', { name: /1,000個/ })
  await expect(row).toContainText('¥27') // (1000×$0.1 + $50 + $30) ÷ 1000 × ¥150
  await panel(page).getByRole('spinbutton', { name: '平袋 1,000個 原価率' }).fill('45') // 原価率 → 提示単価
  await expect(field(page, '平袋 1,000個 提示単価')).toHaveValue('60')
  await expect(row).toContainText('¥60,000'); await expect(row).toContainText('（¥66,000）'); await expect(row).toContainText('¥33,000')
  await field(page, '平袋 1,000個 提示単価').fill('54') // 提示単価 → 原価率
  await expect(panel(page).getByRole('spinbutton', { name: '平袋 1,000個 原価率' })).toHaveValue('50')
  await field(page, '平袋 1,000個 提示単価').fill('60')
  await expect(panel(page).getByRole('button', { name: '第1回お見積を送る' })).toBeDisabled() // 保存するまで送れない
  await shot(page, '40-price-input')
  await panel(page).getByRole('button', { name: '価格を保存する' }).click()
  await expect(panel(page).getByRole('button', { name: '第1回お見積を送る' })).toBeEnabled()
  expect((await state(request)).deal_quotes.find((x: { id: string }) => x.id === q(1))).toMatchObject({ selling_price_jpy: 60, total_billing_jpy: 60000, total_billing_tax_jpy: 66000, exchange_rate: 150 })

  const link = await sendOffer(page, 1)
  await expect(panel(page)).toContainText('第1回 返事待ち（メール未送信）')
  await expect(field(page, '平袋 1,000個 提示単価')).toBeDisabled() // 返事待ちの間は価格を変えられない
  await shot(page, '41-price-waiting')

  const customer = await customerPage(browser)
  await customer.page.goto(link)
  await expect(customer.page.getByRole('heading', { name: 'お見積書（第1回）' })).toBeVisible()
  await expect(customer.page.getByText('製造日数 約25日 ・ 船便')).toBeVisible()
  await expect(customer.page.locator('#external-content')).not.toContainText('工場単価')
  await customer.page.waitForLoadState('networkidle')
  const approve = customer.page.getByRole('button', { name: 'この内容で承認する' })
  await expect(approve).toBeDisabled() // 数量を選ぶまで承認できない
  await customer.page.getByRole('radio', { name: /5,000個/ }).check()
  await expect(customer.page.getByText('合計（税込）')).toContainText('¥404,250') // 140,250 + 264,000
  await shot(customer.page, '42-offer-customer-page')
  expect((await state(request)).price_offers[0].status).toBe('sent') // 開いて選んだだけでは承認にならない
  await approve.click()
  await expect(customer.page.getByRole('status')).toContainText('ご承認を受け付けました')
  await customer.page.reload()
  await expect(customer.page.getByRole('status')).toContainText('承認済みです')
  await customer.context.close()

  const s = await state(request)
  expect(s.price_offers[0]).toMatchObject({ status: 'approved', decided_via: 'link', choices: [q(2), q(3)] })
  expect(s.deal_quotes.filter((x: { deal_id: string }) => x.deal_id === deal).map((x: { status: string }) => x.status)).toEqual(['rejected', 'approved', 'approved'])
  expect(s.deals.find((d: { id: string }) => d.id === deal)).toMatchObject({ process_stage: 5, simple_status: 'quote_confirmed', waiting_on: 'us' })
  await open(page)
  await expect(panel(page)).toContainText('第1回 承認済み')
  await expect(panel(page).getByRole('button', { name: /お見積を送る/ })).toHaveCount(0)
  await shot(page, '43-price-approved')
  await page.getByRole('button', { name: '通知を開く' }).click()
  await expect(page.getByText('検証用カフェ が「冬の新商品」の第1回お見積を承認しました')).toBeVisible()
})

test('顧客が差し戻すと要望が表示され、価格を直して第2回を送れる。全ての回が履歴に残る', async ({ page, request, browser }) => {
  await open(page)
  await fillPrices(page)
  await field(page, '平袋 1,000個 提示単価').fill('60')
  await panel(page).getByRole('button', { name: '価格を保存する' }).click()
  await expect(panel(page).getByRole('button', { name: '第1回お見積を送る' })).toBeEnabled()
  const link = await sendOffer(page, 1)

  const customer = await customerPage(browser)
  await customer.page.goto(link); await customer.page.waitForLoadState('networkidle')
  await customer.page.getByRole('button', { name: '変更を依頼する' }).click()
  const submit = customer.page.getByRole('button', { name: 'この内容で変更を依頼する' })
  await expect(submit).toBeDisabled()
  await customer.page.getByRole('textbox', { name: /変更したい内容/ }).fill('平袋を10,000個にしたい')
  await submit.click()
  await expect(customer.page.getByRole('status')).toContainText('変更のご依頼を受け付けました')
  await customer.context.close()

  await open(page)
  await expect(panel(page)).toContainText('第1回 差し戻し')
  await expect(panel(page)).toContainText('顧客の要望: 平袋を10,000個にしたい')
  await field(page, '平袋 1,000個 提示単価').fill('55')
  await panel(page).getByRole('button', { name: '価格を保存する' }).click()
  await expect(panel(page).getByRole('button', { name: '第2回お見積を送る' })).toBeEnabled()
  await sendOffer(page, 2)
  // 電話で承認をもらった → 営業が数量を選んで記録
  await panel(page).getByRole('button', { name: '承認として記録' }).click()
  const dialog = page.getByRole('dialog', { name: '承認として記録' })
  await expect(dialog.getByRole('button', { name: '記録する' })).toBeDisabled()
  await dialog.getByRole('radio', { name: /1,000個/ }).check()
  await dialog.getByRole('button', { name: '記録する' }).click()
  await expect(panel(page)).toContainText('第2回 承認済み')
  await expect(panel(page)).toContainText('（営業が記録）')
  const history = panel(page).getByRole('list', { name: 'お見積の履歴' })
  await expect(history.getByRole('listitem')).toHaveCount(2)
  await history.getByText('第1回').click()
  await expect(history).toContainText('要望: 平袋を10,000個にしたい')
  await shot(page, '44-price-history')
  const s = await state(request)
  expect(s.price_offers.map((o: { round: number; status: string; decided_via: string }) => [o.round, o.status, o.decided_via])).toEqual([[1, 'returned', 'link'], [2, 'approved', 'staff']])
  expect(s.deal_quotes.find((x: { id: string }) => x.id === q(1))).toMatchObject({ status: 'approved', selling_price_jpy: 55 })
  expect(s.notifications.filter((n: { deal_id: string }) => n.deal_id === deal)).toHaveLength(1) // 営業自身の記録ではお知らせを出さない
})

test('原価割れは保存できず、提示の取り消しで価格を直せる状態に戻る。取り消したリンクとスマホ幅も確認', async ({ page, request, browser }) => {
  await open(page)
  await fillPrices(page)
  await field(page, '平袋 1,000個 提示単価').fill('20') // 原価 ¥27 より安い
  await panel(page).getByRole('button', { name: '価格を保存する' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('提示単価が原価を下回っています')
  expect((await state(request)).deal_quotes.find((x: { id: string }) => x.id === q(1)).selling_price_jpy ?? null).toBeNull()
  await field(page, '平袋 1,000個 提示単価').fill('60')
  await panel(page).getByRole('button', { name: '価格を保存する' }).click()
  await expect(panel(page).getByRole('button', { name: '第1回お見積を送る' })).toBeEnabled()
  const link = await sendOffer(page, 1)
  await panel(page).getByRole('button', { name: '提示を取り消す' }).click()
  await page.getByRole('dialog', { name: '提示を取り消す' }).getByRole('button', { name: '取り消す' }).click()
  await expect(panel(page)).toContainText('未提示')
  await expect(field(page, '平袋 1,000個 提示単価')).toBeEnabled()
  await expect(panel(page).getByRole('button', { name: '第2回お見積を送る' })).toBeEnabled()

  const customer = await customerPage(browser)
  await customer.page.setViewportSize({ width: 390, height: 844 })
  await customer.page.goto(link)
  await expect(customer.page.getByRole('status')).toContainText('取り消されました')
  await expect(customer.page.getByRole('button', { name: 'この内容で承認する' })).toHaveCount(0)
  await customer.page.goto(`/external/offer/${'0'.repeat(64)}`)
  await expect(customer.page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()
  await customer.context.close()
  const second = await sendOffer(page, 2)
  const phone = await customerPage(browser)
  await phone.page.setViewportSize({ width: 390, height: 844 })
  await phone.page.goto(second)
  await expect(phone.page.getByRole('button', { name: 'この内容で承認する' })).toBeVisible()
  expect(await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await shot(phone.page, '45-mobile-offer')
  await phone.context.close()
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await expect(panel(page)).toContainText('第2回 返事待ち')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
