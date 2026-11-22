import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

// 再設計 工程9（検収とリピート）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 記録の正しさ（SQL）は tests/process-stage9-sql.test.ts で別に検証している。
// メールは実際には送らない（送信キーを空にしてあり、送れないときの表示を確認する）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000009', pA = 'aaaaaaaa-0000-4000-8000-0000000009b1', vA = 'aaaaaaaa-0000-4000-8000-0000000009c1'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const panel = (page: Page) => page.getByRole('region', { name: '検収' })
async function open(page: Page) { await page.goto(`/deals/${deal}?step=12`); await page.waitForLoadState('networkidle') }
const day = (offset: number) => new Date(Date.now() + 9 * 3600000 + offset * 86400000).toISOString().slice(0, 10) // 日本時間の日付
const localOnly = (context: import('@playwright/test').BrowserContext) => context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
async function customerPage(browser: Browser, width = 1280) { const context = await browser.newContext({ viewport: { width, height: 844 } }); await localOnly(context); return { context, page: await context.newPage() } }
async function ask(page: Page) {
  await panel(page).getByRole('button', { name: '到着を記録して確認を依頼' }).click()
  await page.getByRole('dialog', { name: '到着を記録して確認を依頼' }).getByRole('button', { name: '依頼する' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('メール送信の設定がありません') // テスト環境は送信設定なし → リンクを手渡しできる
  const link = await panel(page).getByRole('link', { name: /external\/receipt/ }).getAttribute('href')
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:3100\/external\/receipt\/[0-9a-f]{64}$/)
  return link!
}

test.beforeEach(async ({ context, request }) => {
  await localOnly(context)
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
  await post(request, 'client_contacts', { id: 'aaaaaaaa-0000-4000-8000-0000000009d1', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-009', deal_name: '春夏の新商品', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quote_confirmed', waiting_on: 'client', sales_user_id: userId, process_stage: 9, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { id: pA, deal_id: deal, product_no: 1, sort_order: 1, description: '平袋 / W100×H150mm', sample_required: true, production_days: 25, is_selected: false })
  await post(request, 'deal_product_variants', { id: vA, product_id: pA, variant_label: '標準', variant_order: 0, width_mm: 100, deal_products: { deal_id: deal } })
  const quote = (quantity: number, status: string) => post(request, 'deal_quotes', { deal_id: deal, variant_id: vA, quantity, status, version: 1, factory_unit_price_usd: 0.1, exchange_rate: 150, cost_ratio: 0.5, selling_price_jpy: 60, total_billing_jpy: 60 * quantity, total_billing_tax_jpy: 66 * quantity })
  await quote(1000, 'rejected'); await quote(5000, 'approved')
  await post(request, 'price_offers', { deal_id: deal, round: 1, token: 'seeded-offer-9', status: 'approved', snapshot: { round: 1, items: [] }, choices: [], created_at: '2026-11-20T00:00:00Z' })
  await post(request, 'deal_intakes', { deal_id: deal, pattern: 'customer', production_started_at: '2026-11-21T00:00:00Z' })
  await post(request, 'deal_productions', { deal_id: deal, started_on: day(-40), due_on: day(-12), transit_days: 7, finished_at: '2026-11-21T00:00:00Z' })
  await post(request, 'deal_shipments', { deal_id: deal, completion_received_at: '2026-11-21T00:00:00Z', ship_to_name: '検証用カフェ', ship_to_postal_code: '150-0001', ship_to_address: '東京都渋谷区1-2-3', carton_count: 3, requested_at: '2026-11-21T00:00:00Z', packed_at: '2026-11-21T00:00:00Z', carrier: 'ヤマト運輸', tracking_number: '1234-5678-9012', shipped_on: day(-10), notify_status: 'skipped' })
})

test('到着を記録 → 顧客が「受領しました」→ 案件完了。納品書（金額なし）を開け、同じ内容で次の案件をつくれる', async ({ page, request, browser }) => {
  await open(page)
  await expect(panel(page)).toContainText('到着の記録前')
  await expect(panel(page).getByRole('table', { name: '納品の内容' }).getByRole('row')).toHaveCount(2) // 見出し + 承認済みの数量だけ
  expect((await page.request.get(`/deals/${deal}/delivery-note`)).status()).toBe(409) // 受領の前は納品書を開けない
  const link = await ask(page)
  await expect(panel(page)).toContainText('顧客の確認待ち（メール未送信）'); await expect(panel(page)).toContainText('納品書 PF-TEST-009-D1')

  const customer = await customerPage(browser)
  await customer.page.goto(link); await customer.page.waitForLoadState('networkidle')
  await expect(customer.page.getByRole('heading', { name: 'お届け内容のご確認' })).toBeVisible()
  await expect(customer.page.getByRole('table', { name: 'お届けした商品' })).toContainText('5,000個')
  await expect(customer.page.getByText('追跡番号 1234-5678-9012 ・ 3箱')).toBeVisible()
  await expect(customer.page.locator('#external-content')).not.toContainText('¥')
  expect((await customer.page.request.get(link + '/delivery-note')).status()).toBe(409)
  await shot(customer.page, '90-receipt-customer-page')
  expect((await state(request)).deal_receipts[0].status).toBe('sent') // 開いただけでは受領にならない
  await customer.page.getByRole('button', { name: '受領しました' }).click()
  await expect(customer.page.getByRole('status')).toContainText('受領のご確認ありがとうございました')
  const note = await customer.page.request.get(link + '/delivery-note')
  expect(note.status()).toBe(200); expect(note.headers()['content-type']).toBe('application/pdf')
  expect((await PDFDocument.load(await note.body())).getPageCount()).toBe(1)
  await customer.page.reload()
  await expect(customer.page.getByRole('status')).toContainText('受領のご確認済みです')
  await expect(customer.page.getByRole('button', { name: '受領しました' })).toHaveCount(0)
  await customer.context.close()

  const s = await state(request)
  expect(s.deal_receipts[0]).toMatchObject({ status: 'received', received_via: 'link', delivery_note_number: 'PF-TEST-009-D1' })
  expect(s.deals.find((d: { id: string }) => d.id === deal)).toMatchObject({ process_stage: 9, waiting_on: 'none' })
  await open(page)
  await expect(panel(page)).toContainText('案件完了')
  await expect(panel(page).getByRole('link', { name: '納品書を開く' })).toHaveAttribute('href', `/deals/${deal}/delivery-note`)
  expect((await page.request.get(`/deals/${deal}/delivery-note`)).status()).toBe(200)
  await shot(page, '91-receipt-done')
  await page.getByRole('button', { name: '通知を開く' }).click()
  await expect(page.getByText('検証用カフェ が「春夏の新商品」の受領を確認しました。案件完了です。')).toBeVisible()
  await page.keyboard.press('Escape')

  // リピート: 仕様と数量だけを引き継いだ新しい案件ができ、商品登録の画面が開く
  await panel(page).getByRole('button', { name: '同じ内容で次の案件をつくる' }).click()
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}\?step=2/)
  await expect(page.getByRole('heading', { name: '春夏の新商品（リピート）' })).toBeVisible()
  const after = await state(request)
  const fresh = after.deals.find((d: { deal_name: string }) => d.deal_name === '春夏の新商品（リピート）')
  expect(fresh).toMatchObject({ client_id: clientId, process_stage: 2, simple_status: 'quoting' })
  expect(after.deal_products.filter((p: { deal_id: string }) => p.deal_id === fresh.id)).toMatchObject([{ description: '平袋 / W100×H150mm', sample_required: true, production_days: null }])
  const copied = after.deal_quotes.filter((q: { deal_id: string }) => q.deal_id === fresh.id)
  expect(copied.map((q: { quantity: number; status: string; selling_price_jpy?: number }) => [q.quantity, q.status, q.selling_price_jpy ?? null])).toEqual([[1000, 'drafting', null], [5000, 'drafting', null]]) // 価格は引き継がない
})

test('取り消して依頼し直せる。電話での受領は営業が記録。取り消したリンクとスマホ幅も確認', async ({ page, request, browser }) => {
  await open(page)
  const first = await ask(page)
  await panel(page).getByRole('button', { name: '確認依頼を取り消す' }).click()
  await page.getByRole('dialog', { name: '確認依頼を取り消す' }).getByRole('button', { name: '取り消す' }).click()
  await expect(panel(page)).toContainText('到着の記録前')
  const gone = await customerPage(browser, 390)
  await gone.page.goto(first)
  await expect(gone.page.getByRole('status')).toContainText('取り消されました')
  await expect(gone.page.getByRole('button', { name: '受領しました' })).toHaveCount(0)
  await gone.page.goto(`/external/receipt/${'0'.repeat(64)}`)
  await expect(gone.page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()
  await panel(page).getByLabel('到着日').fill(day(-2))
  const second = await ask(page)
  await expect(panel(page)).toContainText(`到着日 ${day(-2).replace(/-/g, '/')}`)
  await gone.page.goto(second)
  await expect(gone.page.getByRole('button', { name: '受領しました' })).toBeVisible()
  expect(await gone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await shot(gone.page, '92-mobile-receipt')
  await gone.context.close()
  await panel(page).getByRole('button', { name: '受領済みとして記録' }).click()
  await page.getByRole('dialog', { name: '受領済みとして記録' }).getByRole('button', { name: '記録する' }).click()
  await expect(panel(page)).toContainText('（営業が記録）'); await expect(panel(page)).toContainText('案件完了')
  await expect(panel(page).getByRole('alert')).toContainText('メール送信の設定が無いため、納品書はメールで送っていません')
  const s = await state(request)
  expect(s.deal_receipts.map((r: { seq: number; status: string; received_via: string | null }) => [r.seq, r.status, r.received_via])).toEqual([[1, 'cancelled', null], [2, 'received', 'staff']])
  expect((s.notifications || []).filter((n: { deal_id: string }) => n.deal_id === deal)).toHaveLength(0) // 営業自身の記録ではお知らせを出さない
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

test('発送完了の前は検収を始められない', async ({ page, request }) => {
  await request.patch(`${fixture}/rest/v1/deal_shipments?deal_id=eq.${deal}`, { data: { shipped_on: null } })
  await open(page)
  await expect(panel(page)).toContainText('発送完了を記録すると始められます')
  await expect(panel(page).getByRole('button')).toHaveCount(0)
  await panel(page).getByRole('link', { name: '発送を開く' }).click()
  await expect(page).toHaveURL(/step=11/)
})
