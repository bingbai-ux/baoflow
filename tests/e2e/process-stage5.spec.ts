import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test'

// 再設計 工程5（請求書の発行 → 顧客の承認 = 契約成立）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 明細・税計算・成立の記録の正しさ（SQL）は tests/process-stage5-sql.test.ts で別に検証している。
// このテストはメールを実際には送らない（送信キーを空にしてあり、送信できないときの表示を確認する）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000005', pA = 'aaaaaaaa-0000-4000-8000-0000000005b1', pB = 'aaaaaaaa-0000-4000-8000-0000000005b2'
const vA = 'aaaaaaaa-0000-4000-8000-0000000005c1', vB = 'aaaaaaaa-0000-4000-8000-0000000005c2'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const panel = (page: Page) => page.getByRole('region', { name: '請求書と契約' })
const localOnly = (context: import('@playwright/test').BrowserContext) => context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
async function customerPage(browser: Browser, width = 1280) { // ログインしていない顧客のブラウザ
  const context = await browser.newContext({ viewport: { width, height: 844 } }); await localOnly(context)
  return { context, page: await context.newPage() }
}
async function open(page: Page) { await page.goto(`/deals/${deal}?step=8`); await page.waitForLoadState('networkidle') }
async function issue(page: Page) {
  await panel(page).getByRole('button', { name: '請求書を発行して送る' }).click()
  await page.getByRole('dialog', { name: '請求書を発行して送る' }).getByRole('button', { name: '発行して送る' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('メール送信の設定がありません') // テスト環境は送信設定なし → リンクを手渡しできる
  const link = await panel(page).getByRole('link', { name: /external\/invoice/ }).getAttribute('href')
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:3100\/external\/invoice\/[0-9a-f]{64}$/)
  return link!
}

test.beforeEach(async ({ context, request }) => {
  await localOnly(context)
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
  await post(request, 'client_contacts', { id: 'aaaaaaaa-0000-4000-8000-0000000005d1', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-005', deal_name: '春の新商品', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quote_confirmed', waiting_on: 'us', sales_user_id: userId, process_stage: 5, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { id: pA, deal_id: deal, product_no: 1, sort_order: 1, description: '平袋', is_selected: false })
  await post(request, 'deal_products', { id: pB, deal_id: deal, product_no: 2, sort_order: 2, description: 'スタンド袋', is_selected: false })
  await post(request, 'deal_product_variants', { id: vA, product_id: pA, variant_label: '標準', variant_order: 0, deal_products: { deal_id: deal } })
  await post(request, 'deal_product_variants', { id: vB, product_id: pB, variant_label: '標準', variant_order: 0, deal_products: { deal_id: deal } })
  const quote = (variant_id: string, quantity: number, unit: number, status: string) => post(request, 'deal_quotes', { deal_id: deal, variant_id, quantity, status, version: 1, factory_unit_price_usd: 0.05, exchange_rate: 150, cost_ratio: 0.5, selling_price_jpy: unit, total_billing_jpy: Math.ceil(unit * quantity), total_billing_tax_jpy: Math.ceil(Math.ceil(unit * quantity) * 1.1) })
  await quote(vA, 1000, 60, 'rejected'); await quote(vA, 5000, 25.5, 'approved'); await quote(vB, 3333, 12.34, 'approved')
  // 新しい流れ（お見積の承認）を通った案件として用意する
  await post(request, 'price_offers', { deal_id: deal, round: 1, token: 'seeded-offer', status: 'approved', snapshot: { round: 1, items: [] }, choices: [], created_at: '2026-11-20T00:00:00Z' })
})

test('承認済みの見積から請求書を発行 → 顧客がボタンを押すと契約成立になり、入稿に進める', async ({ page, request, browser }) => {
  await open(page)
  await expect(panel(page)).toContainText('未発行')
  const table = panel(page).getByRole('table', { name: '請求の明細' })
  await expect(table.getByRole('row')).toHaveCount(4) // 見出し + 承認済み2行 + 合計（不採用の数量は載らない）
  await expect(table).toContainText('¥168,630'); await expect(table).toContainText('¥185,493')
  await expect(page.getByRole('button', { name: '請求書をつくる', exact: true })).toHaveCount(0) // 従来の帳票操作は出さない
  await shot(page, '50-invoice-before')
  const link = await issue(page)
  await expect(panel(page)).toContainText('承認待ち（メール未送信）')
  await expect(panel(page)).toContainText('PF-TEST-005-I1')

  const customer = await customerPage(browser)
  await customer.page.goto(link); await customer.page.waitForLoadState('networkidle')
  await expect(customer.page.getByRole('heading', { name: 'ご請求書' })).toBeVisible()
  await expect(customer.page.getByRole('table', { name: '明細' })).toContainText('¥185,493')
  await expect(customer.page.getByText('検証銀行 本店 普通 0000001')).toBeVisible()
  await shot(customer.page, '51-invoice-customer-page')
  expect((await state(request)).order_agreements[0].status).toBe('sent') // 開いただけでは成立しない
  await customer.page.getByRole('button', { name: 'この内容で発注する' }).click()
  await expect(customer.page.getByRole('status')).toContainText('ご契約成立です')
  await customer.page.reload()
  await expect(customer.page.getByRole('status')).toContainText('ご契約成立済みです')
  await expect(customer.page.getByRole('button', { name: 'この内容で発注する' })).toHaveCount(0)
  await customer.context.close()

  const s = await state(request)
  expect(s.order_agreements[0]).toMatchObject({ status: 'agreed', agreed_via: 'link', invoice_number: 'PF-TEST-005-I1' })
  expect(s.deals.find((d: { id: string }) => d.id === deal)).toMatchObject({ process_stage: 6, waiting_on: 'us' })
  await open(page)
  await expect(panel(page)).toContainText('契約成立')
  await expect(panel(page).getByRole('button', { name: '請求書を発行して送る' })).toHaveCount(0)
  await shot(page, '52-invoice-agreed')
  await page.getByRole('button', { name: '通知を開く' }).click()
  await expect(page.getByText('検証用カフェ が「春の新商品」の請求書を承認しました（契約成立）')).toBeVisible()
  await page.keyboard.press('Escape')
  await panel(page).getByRole('link', { name: '入稿に進む' }).click()
  await expect(page).toHaveURL(/step=9/)
})

test('取り消して発行し直せる。電話での承認は営業が記録。取り消したリンクとスマホ幅も確認', async ({ page, request, browser }) => {
  await open(page)
  const first = await issue(page)
  await panel(page).getByRole('button', { name: '請求書を取り消す' }).click()
  await page.getByRole('dialog', { name: '請求書を取り消す' }).getByRole('button', { name: '取り消す' }).click()
  await expect(panel(page)).toContainText('未発行')
  const gone = await customerPage(browser, 390)
  await gone.page.goto(first)
  await expect(gone.page.getByRole('status')).toContainText('取り消されました')
  await expect(gone.page.getByRole('button', { name: 'この内容で発注する' })).toHaveCount(0)
  await gone.page.goto(`/external/invoice/${'0'.repeat(64)}`)
  await expect(gone.page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()

  await panel(page).getByLabel('振込期限').fill('2027-01-15')
  const second = await issue(page)
  await expect(panel(page)).toContainText('PF-TEST-005-I2')
  await expect(panel(page)).toContainText('振込期限 2027/01/15')
  await gone.page.goto(second)
  await expect(gone.page.getByRole('button', { name: 'この内容で発注する' })).toBeVisible()
  expect(await gone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await shot(gone.page, '53-mobile-invoice')
  await gone.context.close()

  await panel(page).getByRole('button', { name: '承認済みとして記録' }).click()
  await page.getByRole('dialog', { name: '承認済みとして記録' }).getByRole('button', { name: '記録する' }).click()
  await expect(panel(page)).toContainText('契約成立')
  await expect(panel(page)).toContainText('（営業が記録）')
  await expect(panel(page).getByRole('list', { name: '請求書の履歴' }).getByRole('listitem')).toHaveCount(2)
  const s = await state(request)
  expect(s.order_agreements.map((a: { seq: number; status: string; agreed_via: string | null }) => [a.seq, a.status, a.agreed_via])).toEqual([[1, 'cancelled', null], [2, 'agreed', 'staff']])
  expect((s.notifications || []).filter((n: { deal_id: string }) => n.deal_id === deal)).toHaveLength(0) // 営業自身の記録ではお知らせを出さない
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

test('設定に発行者情報が足りないときは発行できず、足りない項目が分かる', async ({ page, request }) => {
  await request.patch(`${fixture}/rest/v1/system_settings`, { data: { invoice_issuer_missing: ['住所', '口座名義'] } })
  await open(page)
  await expect(panel(page).getByRole('alert')).toContainText('請求書に載せる情報が設定にありません: 住所・口座名義')
  await expect(panel(page).getByRole('link', { name: '設定を開く' })).toHaveAttribute('href', '/settings')
  await expect(panel(page).getByRole('button', { name: '請求書を発行して送る' })).toBeDisabled()
  expect((await state(request)).order_agreements || []).toHaveLength(0)
})
