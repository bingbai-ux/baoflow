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
  await expect(panel(page)).toContainText('PF-TEST-005-I1 ・ 株式会社FOOD&COMPANY')

  const customer = await customerPage(browser)
  await customer.page.goto(link); await customer.page.waitForLoadState('networkidle')
  await expect(customer.page.getByRole('heading', { name: 'ご請求書' })).toBeVisible()
  await expect(customer.page.getByRole('table', { name: '明細' })).toContainText('¥185,493')
  await expect(customer.page.getByText('検証銀行 本店 普通 0000001')).toBeVisible()
  await expect(customer.page.getByText('株式会社FOOD&COMPANY ／ 〒150-0001 東京都検証区1-2-3 ／ 登録番号 T0000000000000')).toBeVisible()
  await expect(customer.page.getByRole('img', { name: '角印' })).toBeVisible()
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

test('発行元の会社を選べる。登録情報が足りない会社では発行できず、設定で登録すると発行できる（ロゴ・角印・登録番号つき）', async ({ page, request, browser }) => {
  await open(page)
  const issuer = panel(page).getByLabel('発行元')
  await expect(issuer).toHaveValue('00000000-0000-4000-8000-0000000000e1') // 既定の会社
  await issuer.selectOption({ label: '株式会社Springroll' })
  await expect(panel(page).getByRole('alert')).toContainText('「株式会社Springroll」の登録情報が足りません: 住所・銀行名・支店名・口座種別・口座番号・口座名義')
  await expect(panel(page).getByRole('button', { name: '請求書を発行して送る' })).toBeDisabled()
  await panel(page).getByRole('link', { name: '発行元の会社を開く' }).click()
  await expect(page).toHaveURL(/\/settings\/companies$/); await page.waitForLoadState('networkidle')

  const list = page.getByRole('list', { name: '会社' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByRole('listitem').filter({ hasText: '株式会社FOOD&COMPANY' })).toContainText('既定')
  await list.getByRole('listitem').filter({ hasText: '株式会社Springroll' }).getByRole('button', { name: '直す' }).click()
  const form = page.getByRole('form', { name: '会社を直す' })
  for (const [name, value] of [['住所', '神奈川県横浜市4-5-6'], ['銀行名', 'みずほ銀行'], ['支店名', '横浜支店'], ['口座種別', '普通'], ['口座番号', '7654321'], ['口座名義', 'カ）スプリングロール']]) await form.getByLabel(name, { exact: true }).fill(value)
  await form.getByLabel(/インボイス登録番号/).fill('T123') // 形式が違う番号は保存しない
  await form.getByRole('button', { name: 'この内容で保存する' }).click()
  await expect(page.getByRole('main').getByRole('alert').filter({ hasText: '登録番号' })).toContainText('「T」と数字13桁')
  await form.getByLabel(/インボイス登録番号/).fill('T9999999999999')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await form.getByLabel('ロゴの画像').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
  await form.getByLabel('角印（ハンコ）の画像').setInputFiles({ name: 'stamp.png', mimeType: 'image/png', buffer: png })
  await expect(form.getByRole('img', { name: 'ロゴの見本' })).toBeVisible()
  await form.getByLabel('ロゴの画像').setInputFiles({ name: 'logo.gif', mimeType: 'image/gif', buffer: png }) // 対応していない形式
  await expect(page.getByText('画像は PNG か JPEG を選んでください')).toBeVisible()
  // 大きな画像（10MBまで）は選べて、帳票用の大きさに自動で縮めて保存する。10MBを超える画像は断る
  const big = Buffer.from((await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const x = c.getContext('2d')!; x.fillStyle = '#351E28'; x.fillRect(200, 200, 2600, 1600); return c.toDataURL('image/png') })).split(',')[1], 'base64')
  await form.getByLabel('ロゴの画像').setInputFiles({ name: 'big-logo.png', mimeType: 'image/png', buffer: big })
  await expect(page.getByText('画像を帳票用の大きさに縮めました')).toBeVisible()
  const preview = await form.getByRole('img', { name: 'ロゴの見本' }).evaluate((el: HTMLImageElement) => el.decode().then(() => [el.naturalWidth, el.naturalHeight]))
  expect(preview).toEqual([1200, 800])
  await form.getByLabel('角印（ハンコ）の画像').setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(page.getByText('画像が大きすぎます（10MB まで）')).toBeVisible()
  await shot(page, '54-company-form')
  await form.getByRole('button', { name: 'この内容で保存する' }).click()
  const spring = list.getByRole('listitem').filter({ hasText: '株式会社Springroll' })
  await expect(spring).toContainText('登録番号 T9999999999999 ・ 角印あり')
  await expect(spring).not.toContainText('請求書に未登録')
  await spring.getByRole('button', { name: '既定にする' }).click()
  await expect(spring.getByText('既定', { exact: true })).toBeVisible() // 「既定」の印が付くまで待つ
  await expect(spring.getByRole('button', { name: '既定にする' })).toHaveCount(0)
  await shot(page, '55-company-list')
  const saved = (await state(request)).issuer_companies.find((c: { name: string }) => c.name === '株式会社Springroll')
  expect(saved).toMatchObject({ is_default: true, registration_number: 'T9999999999999', account_holder: 'カ）スプリングロール' })
  expect(saved.logo_data).toMatch(/^data:image\/png;base64,/)

  await open(page)
  await expect(panel(page).getByLabel('発行元')).toHaveValue(saved.id) // 既定が切り替わっている
  const link = await issue(page)
  await expect(panel(page)).toContainText('PF-TEST-005-I1 ・ 株式会社Springroll')
  const customer = await customerPage(browser)
  await customer.page.goto(link)
  await expect(customer.page.getByText('みずほ銀行 横浜支店 普通 7654321')).toBeVisible()
  await expect(customer.page.getByRole('img', { name: '株式会社Springroll' })).toBeVisible() // ロゴ
  await expect(customer.page.getByRole('img', { name: '角印' })).toBeVisible()
  await customer.context.close()
})
