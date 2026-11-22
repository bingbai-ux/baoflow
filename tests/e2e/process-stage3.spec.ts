import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test'

// 再設計 工程3（顧客の確認 → 工場への見積依頼）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 確認の記録・取り消し・期限・権限の正しさ（SQL）は tests/process-stage3-sql.test.ts で別に検証している。
// このテストはメールを実際には送らない（送信キーを空にしてあり、送信できないときの表示を確認する）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000003', product = 'aaaaaaaa-0000-4000-8000-0000000000b1', variant = 'aaaaaaaa-0000-4000-8000-0000000000c1'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const rfqButton = (page: Page) => page.getByRole('button', { name: '工場に見積を依頼する', exact: true })
const panel = (page: Page) => page.getByRole('region', { name: '顧客の確認' })
const localOnly = (context: import('@playwright/test').BrowserContext) => context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
async function customerPage(browser: Browser) { // ログインしていない顧客のブラウザ
  const context = await browser.newContext(); await localOnly(context)
  return { context, page: await context.newPage() }
}

test.beforeEach(async ({ context, request }) => {
  await localOnly(context)
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
  await post(request, 'client_contacts', { id: 'aaaaaaaa-0000-4000-8000-0000000000d1', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-003', deal_name: '秋の新商品', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'us', sales_user_id: userId, process_stage: 2, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { id: product, deal_id: deal, product_no: 1, sort_order: 1, description: '平袋 / W100×H150mm / クラフト紙', shipping_mode: 'sea', sample_required: true, is_selected: false })
  await post(request, 'deal_product_variants', { id: variant, product_id: product, variant_label: '標準', variant_order: 0, size_mode: 'box', width_mm: 100, height_mm: 150, deal_products: { deal_id: deal } })
  for (const quantity of [1000, 5000]) await post(request, 'deal_quotes', { deal_id: deal, variant_id: variant, quantity, status: 'drafting', version: 1 })
})

test('顧客が確認するまで工場へ依頼できず、確認ページのボタンで確認すると依頼できるようになる', async ({ page, request, browser }) => {
  await page.goto(`/deals/${deal}?step=3`)
  await expect(panel(page)).toContainText('未依頼')
  await expect(rfqButton(page)).toBeDisabled()
  await expect(page.getByText('顧客の確認後に依頼できます')).toBeVisible()
  await shot(page, '30-confirm-before')
  await panel(page).getByRole('button', { name: '確認メールを送る' }).click()
  await page.getByRole('dialog', { name: '確認メールを送る' }).getByRole('button', { name: '送る', exact: true }).click()
  // テスト環境はメール送信の設定が無い → 送ったことにせず、リンクを直接渡せるようにする
  await expect(panel(page).getByRole('alert')).toContainText('メール送信の設定がありません')
  await expect(panel(page)).toContainText('返事待ち（メール未送信）')
  await expect(panel(page)).toContainText('佐藤 <sato@example.test>')
  const link = await panel(page).getByRole('link').getAttribute('href')
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:3100\/external\/confirm\/[0-9a-f]{64}$/)
  await expect(rfqButton(page)).toBeDisabled()

  const customer = await customerPage(browser)
  await customer.page.goto(link!)
  await expect(customer.page.getByRole('heading', { name: '商品内容のご確認' })).toBeVisible()
  await expect(customer.page.getByRole('list', { name: '商品' })).toContainText('平袋 / W100×H150mm / クラフト紙')
  await expect(customer.page.getByRole('list', { name: '商品' })).toContainText('数量: 1,000 / 5,000')
  await expect(customer.page.getByRole('list', { name: '商品' })).toContainText('船便 ・ サンプルあり')
  await shot(customer.page, '31-confirm-customer-page')
  expect((await state(request)).customer_confirmations.find((c: { deal_id: string }) => c.deal_id === deal).status).toBe('pending') // 開いただけでは確認にならない
  await customer.page.getByRole('button', { name: 'この内容で進める' }).click()
  await expect(customer.page.getByRole('status')).toContainText('確認を受け付けました')
  await customer.page.reload()
  await expect(customer.page.getByRole('status')).toContainText('確認済みです')
  await expect(customer.page.getByRole('button', { name: 'この内容で進める' })).toHaveCount(0)
  await customer.context.close()

  const s = await state(request)
  expect(s.customer_confirmations.find((c: { deal_id: string }) => c.deal_id === deal)).toMatchObject({ status: 'confirmed', confirmed_via: 'link' })
  expect(s.deals.find((d: { id: string }) => d.id === deal)).toMatchObject({ process_stage: 3, waiting_on: 'us' })
  await page.reload()
  await expect(panel(page)).toContainText('確認済み')
  await expect(rfqButton(page)).toBeEnabled()
  await expect(page.getByText('3 / 9 工場見積')).toBeVisible()
  await shot(page, '32-confirm-after')
  // アプリ内のお知らせ
  await page.getByRole('button', { name: '通知を開く' }).click()
  await expect(page.getByText('検証用カフェ が「秋の新商品」の商品内容を確認しました')).toBeVisible()
})

test('電話などで確認できたときは「確認済みとして記録」で進められ、履歴に残る', async ({ page, request }) => {
  await page.goto(`/deals/${deal}?step=3`)
  await panel(page).getByRole('button', { name: '確認済みとして記録' }).click()
  await page.getByRole('dialog', { name: '確認済みとして記録' }).getByRole('button', { name: '記録する' }).click()
  await expect(panel(page)).toContainText('（営業が記録）')
  await expect(rfqButton(page)).toBeEnabled()
  const s = await state(request)
  expect(s.customer_confirmations.find((c: { deal_id: string }) => c.deal_id === deal)).toMatchObject({ status: 'confirmed', confirmed_via: 'staff' })
  expect(s.deal_status_history.filter((h: { deal_id: string; note?: string }) => h.deal_id === deal && h.note?.includes('営業が記録'))).toHaveLength(1)
  expect(s.notifications || []).toHaveLength(0)
})

test('取り消された確認ページ・存在しないページは確認できない。スマホ幅で横にはみ出さない', async ({ page, request, browser }) => {
  await page.goto(`/deals/${deal}?step=3`)
  for (const label of ['確認メールを送る', '送り直す']) { // 送り直すと前のリンクは取り消される
    await panel(page).getByRole('button', { name: label }).click()
    await page.getByRole('dialog', { name: '確認メールを送る' }).getByRole('button', { name: '送る', exact: true }).click()
    await expect(panel(page).getByRole('link')).toBeVisible()
    await page.reload()
  }
  const rows = (await state(request)).customer_confirmations.filter((c: { deal_id: string }) => c.deal_id === deal)
  expect(rows.map((c: { status: string }) => c.status)).toEqual(['cancelled', 'pending'])
  const customer = await customerPage(browser)
  await customer.page.setViewportSize({ width: 390, height: 844 })
  await customer.page.goto(`/external/confirm/${rows[0].token}`)
  await expect(customer.page.getByRole('status')).toContainText('取り消されました')
  await expect(customer.page.getByRole('button', { name: 'この内容で進める' })).toHaveCount(0)
  await customer.page.goto(`/external/confirm/${'0'.repeat(64)}`)
  await expect(customer.page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()
  await customer.page.goto(`/external/confirm/${rows[1].token}`)
  await expect(customer.page.getByRole('button', { name: 'この内容で進める' })).toBeVisible()
  expect(await customer.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await customer.context.close()
})
