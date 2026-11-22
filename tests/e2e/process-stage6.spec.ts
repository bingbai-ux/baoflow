import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

// 再設計 工程6（入稿の受け渡し記録と工場への前払い）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 手順の順番・必須条件の正しさ（SQL）は tests/process-stage6-sql.test.ts で別に検証している。
// ファイル保管は代役（アップロードの要求があったことだけ記録し、中身は保存しない）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000006', pA = 'aaaaaaaa-0000-4000-8000-0000000006b1', vA = 'aaaaaaaa-0000-4000-8000-0000000006c1'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const panel = (page: Page) => page.getByRole('region', { name: '入稿と前払い' })
const step = (page: Page, name: string) => panel(page).getByRole('list', { name: '入稿の手順' }).getByRole('listitem').filter({ hasText: name }).first()
async function open(page: Page) { await page.goto(`/deals/${deal}?step=9`); await page.waitForLoadState('networkidle') }
const record = async (page: Page, name: string) => { await step(page, name).getByRole('button', { name: '記録する' }).click(); await expect(step(page, name)).toContainText('記録済み') }
const attach = (page: Page, label: string, name: string) => panel(page).getByLabel(label).setInputFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })

test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-006', deal_name: '夏の新商品', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quote_confirmed', waiting_on: 'us', sales_user_id: userId, process_stage: 6, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { id: pA, deal_id: deal, product_no: 1, sort_order: 1, description: '平袋', is_selected: false })
  await post(request, 'deal_product_variants', { id: vA, product_id: pA, variant_label: '標準', variant_order: 0, deal_products: { deal_id: deal } })
  await post(request, 'deal_quotes', { deal_id: deal, variant_id: vA, quantity: 5000, status: 'approved', version: 1, factory_unit_price_usd: 0.2, total_cost_usd: 1025, exchange_rate: 150, cost_ratio: 0.5, selling_price_jpy: 60, total_billing_jpy: 300000, total_billing_tax_jpy: 330000 })
  await post(request, 'price_offers', { deal_id: deal, round: 1, token: 'seeded-offer-6', status: 'approved', snapshot: { round: 1, items: [] }, choices: [], created_at: '2026-11-20T00:00:00Z' })
})

test('顧客がデータを用意: ファイル登録 → 受領 → 工場へ → 工場確認、前払いを記録すると製作開始へ進める', async ({ page, request }) => {
  await post(request, 'order_agreements', { deal_id: deal, seq: 1, invoice_number: 'PF-TEST-006-I1', token: 'seeded-agreement-6', status: 'agreed', issue_date: '2026-11-20', due_date: '2026-12-20', snapshot: { lines: [], subtotal_jpy: 300000, total_jpy: 330000, issuer: { name: '株式会社FOOD&COMPANY' } }, created_at: '2026-11-20T00:00:00Z' })
  await open(page)
  await expect(panel(page)).toContainText('進め方を選ぶ'); await expect(panel(page)).toContainText('未払い')
  const start = panel(page).getByRole('button', { name: '製作開始へ進む' })
  await expect(start).toBeDisabled()
  await panel(page).getByRole('button', { name: '顧客がデータを用意' }).click()
  await expect(panel(page).getByRole('list', { name: '入稿の手順' }).getByRole('listitem').filter({ has: page.locator('p.font-bold') })).toHaveCount(3)
  await expect(step(page, '顧客から入稿データを受け取る').getByRole('button', { name: '記録する' })).toBeDisabled() // ファイルを登録するまで記録できない
  await attach(page, '入稿データのファイルを選ぶ', 'デザイン final.pdf')
  await expect(panel(page).getByRole('list', { name: '入稿データのファイル' })).toContainText('デザイン final.pdf')
  const s1 = await state(request)
  expect(s1.storage_objects).toHaveLength(1); expect(s1.storage_objects[0]).toMatch(new RegExp(`^deal-images/${deal}/[0-9a-f-]{36}_.*final\\.pdf$`))
  expect(s1.deal_design_files.find((f: { deal_id: string }) => f.deal_id === deal)).toMatchObject({ category: 'intake_artwork', file_name: 'デザイン final.pdf' })
  await record(page, '顧客から入稿データを受け取る')
  await expect(panel(page).getByRole('button', { name: /を削除$/ })).toHaveCount(0) // 受領を記録したファイルは消せない
  await record(page, '入稿データを工場へ渡す')
  await expect(panel(page).getByRole('button', { name: '工場の雛形を使う' })).toBeDisabled() // 記録を始めたら進め方は変えられない
  await record(page, '工場がデータを確認')
  await expect(panel(page)).toContainText('工場確認済み')
  await expect(start).toBeDisabled() // 前払いがまだ
  await shot(page, '60-intake-steps')

  await panel(page).getByRole('group', { name: '前払いの割合' }).getByRole('button', { name: '50%' }).click()
  await expect(panel(page)).toContainText('目安 $512.50'); await expect(panel(page)).toContainText('原価 $1,025.00 × 50%')
  await panel(page).getByLabel('メモ').fill('Wise 送金')
  await panel(page).getByRole('button', { name: '振込を記録する' }).click()
  await expect(panel(page)).toContainText('・ $512.50（50%）'); await expect(panel(page)).toContainText('支払い済み')
  await shot(page, '61-intake-paid')
  await start.click()
  await page.getByRole('dialog', { name: '製作開始へ進む' }).getByRole('button', { name: '進む' }).click()
  await expect(panel(page).getByRole('status')).toContainText('製作開始へ進みました')
  await expect(panel(page).getByRole('button', { name: /記録|取り消す|登録/ })).toHaveCount(0) // 進んだあとは変更できない
  const s = await state(request)
  expect(s.deal_intakes[0]).toMatchObject({ pattern: 'customer', prepay_rate: 50, prepay_amount_usd: 512.5, prepay_note: 'Wise 送金' })
  expect(s.deals.find((d: { id: string }) => d.id === deal)).toMatchObject({ process_stage: 7, waiting_on: 'factory' })
  await expect(page.getByText('7 / 9 製造')).toBeVisible()
})

test('工場の雛形を使う: 5つの手順を順に記録。直前の記録だけ取り消せ、ファイルの削除・振込の取り消しもできる。スマホ幅も確認', async ({ page, request }) => {
  await post(request, 'order_agreements', { deal_id: deal, seq: 1, invoice_number: 'PF-TEST-006-I1', token: 'seeded-agreement-6', status: 'agreed', issue_date: '2026-11-20', due_date: '2026-12-20', snapshot: { lines: [], subtotal_jpy: 300000, total_jpy: 330000, issuer: { name: '株式会社FOOD&COMPANY' } }, created_at: '2026-11-20T00:00:00Z' })
  await open(page)
  await panel(page).getByRole('button', { name: '工場の雛形を使う' }).click()
  await expect(panel(page)).toContainText('次: 工場から雛形を受け取る')
  await attach(page, '雛形のファイルを選ぶ', 'template.ai'); await attach(page, '雛形のファイルを選ぶ', 'wrong.ai')
  const templates = panel(page).getByRole('list', { name: '雛形のファイル' })
  await expect(templates.getByRole('listitem')).toHaveCount(2)
  await panel(page).getByRole('button', { name: 'wrong.ai を削除' }).click()
  await expect(templates.getByRole('listitem')).toHaveCount(1)
  expect((await state(request)).storage_objects).toHaveLength(1) // 保管場所からも消える
  await record(page, '工場から雛形を受け取る'); await record(page, '雛形を顧客へ渡す')
  expect((await state(request)).deals.find((d: { id: string }) => d.id === deal).waiting_on).toBe('client')
  // 取り消せるのは直前の記録だけ
  await expect(step(page, '工場から雛形を受け取る').getByRole('button', { name: '取り消す' })).toHaveCount(0)
  await step(page, '雛形を顧客へ渡す').getByRole('button', { name: '取り消す' }).click()
  await expect(step(page, '雛形を顧客へ渡す').getByRole('button', { name: '記録する' })).toBeVisible()
  await record(page, '雛形を顧客へ渡す')
  await attach(page, '入稿データのファイルを選ぶ', 'artwork.pdf')
  await expect(panel(page).getByRole('list', { name: '入稿データのファイル' })).toContainText('artwork.pdf')
  await record(page, '顧客から入稿データを受け取る'); await record(page, '入稿データを工場へ渡す'); await record(page, '工場がデータを確認')
  await panel(page).getByRole('group', { name: '前払いの割合' }).getByRole('button', { name: '30%' }).click()
  await panel(page).getByLabel('振り込んだ金額 $').fill('300')
  await panel(page).getByRole('button', { name: '振込を記録する' }).click()
  await expect(panel(page)).toContainText('$300.00（30%）')
  await panel(page).getByRole('button', { name: '振込の記録を取り消す' }).click()
  await expect(panel(page)).toContainText('未払い')
  await expect(panel(page).getByRole('button', { name: '製作開始へ進む' })).toBeDisabled()
  const s = await state(request)
  expect(Object.entries(s.deal_intakes[0]).filter(([k, v]) => k.endsWith('_at') && k !== 'production_started_at' && v).length).toBe(5)
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await shot(page, '62-mobile-intake')
})

test('契約成立の前は入稿を始められない', async ({ page, request }) => {
  await open(page)
  await expect(panel(page)).toContainText('請求書の承認（契約成立）のあとに始められます')
  await expect(panel(page).getByRole('button', { name: '顧客がデータを用意' })).toBeDisabled()
  await expect(panel(page).getByRole('button', { name: '製作開始へ進む' })).toHaveCount(0)
  await panel(page).getByRole('link', { name: '請求・契約を開く' }).click()
  await expect(page).toHaveURL(/step=8/)
  expect((await state(request)).deal_intakes || []).toHaveLength(0)
})
