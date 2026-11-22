import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

// 再設計 工程8（発送）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 順番・必須条件の正しさ（SQL）は tests/process-stage8-sql.test.ts で別に検証している。
// ファイル保管は代役。メールは実際には送らない（送信キーを空にしてあり、送れないときの表示を確認する）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000008', pA = 'aaaaaaaa-0000-4000-8000-0000000008b1'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const panel = (page: Page) => page.getByRole('region', { name: '発送' })
async function open(page: Page) { await page.goto(`/deals/${deal}?step=11`); await page.waitForLoadState('networkidle') }
const day = (offset: number) => new Date(Date.now() + 9 * 3600000 + offset * 86400000).toISOString().slice(0, 10) // 日本時間の日付
const photo = (name: string) => ({ name, mimeType: 'image/jpeg', buffer: Buffer.from('jpg') })
async function seed(request: APIRequestContext, opts: { food?: boolean; finished?: boolean } = {}) {
  await post(request, 'client_contacts', { id: 'aaaaaaaa-0000-4000-8000-0000000008d1', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-008', deal_name: '新春の新商品', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quote_confirmed', waiting_on: 'us', sales_user_id: userId, process_stage: 8, tags: [], desired_delivery_date: day(60), last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { id: pA, deal_id: deal, product_no: 1, sort_order: 1, description: '平袋 / W100×H150mm', food_inspection_required: !!opts.food, is_selected: false })
  await post(request, 'price_offers', { deal_id: deal, round: 1, token: 'seeded-offer-8', status: 'approved', snapshot: { round: 1, items: [] }, choices: [], created_at: '2026-11-20T00:00:00Z' })
  await post(request, 'deal_intakes', { deal_id: deal, pattern: 'customer', production_started_at: '2026-11-21T00:00:00Z' })
  await post(request, 'deal_productions', { deal_id: deal, started_on: day(-30), due_on: day(-1), transit_days: 30, finished_at: opts.finished === false ? null : '2026-11-21T00:00:00Z' })
}

test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
})

test('完了報告 → 届け先とラベルPDF → 発送依頼 → 梱包写真 → 追跡番号で発送完了すると検収へ進み、到着目安が出る', async ({ page, request }) => {
  await seed(request, { food: true })
  await open(page)
  await expect(panel(page)).toContainText('食品検査あり')
  const confirm = panel(page).getByRole('button', { name: '完了報告を確認した' }), ask = panel(page).getByRole('button', { name: '工場へ発送を依頼した' })
  await expect(confirm).toBeDisabled(); await expect(ask).toBeDisabled()
  await panel(page).getByLabel('完成品の写真・動画を選ぶ').setInputFiles([photo('done-1.jpg'), photo('done.mp4')])
  await expect(panel(page).getByRole('list', { name: '完成品の写真・動画' }).getByRole('listitem')).toHaveCount(2)
  await panel(page).getByLabel('備考').fill('検品済み・不良なし')
  await confirm.click()
  await expect(panel(page)).toContainText('検品済み・不良なし')

  await expect(panel(page).getByLabel('届け先の名前')).toHaveValue('検証用カフェ') // 取引先名が最初から入っている
  await panel(page).getByLabel('郵便番号').fill('150-0001'); await panel(page).getByLabel('住所').fill('東京都渋谷区神宮前1-2-3 物流センター')
  await panel(page).getByLabel('電話').fill('03-0000-0000'); await panel(page).getByLabel('箱数').fill('3')
  const saveTo = panel(page).getByRole('button', { name: '届け先を保存する' })
  await expect(saveTo).toBeDisabled() // 食品検査の日数が未入力
  await panel(page).getByLabel('食品検査の日数').fill('10')
  await saveTo.click()
  const labels = panel(page).getByRole('link', { name: 'ラベルPDFを開く' })
  await expect(labels).toHaveAttribute('href', `/deals/${deal}/carton-labels`)
  const pdf = await page.request.get(`/deals/${deal}/carton-labels`)
  expect(pdf.status()).toBe(200); expect(pdf.headers()['content-type']).toBe('application/pdf')
  const bytes = await pdf.body()
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3) // 箱数ぶんのページ
  await shot(page, '80-shipping-destination')

  await ask.click()
  await expect(panel(page)).toContainText('梱包写真待ち')
  const packed = panel(page).getByRole('button', { name: '梱包とラベルを確認した' })
  await panel(page).getByLabel('梱包の写真を選ぶ').setInputFiles(photo('pack.jpg'))
  await expect(panel(page).getByRole('list', { name: '梱包の写真' })).toContainText('pack.jpg')
  await expect(packed).toBeDisabled() // ラベルを貼った写真も必要
  await panel(page).getByLabel('ラベルを貼った写真を選ぶ').setInputFiles(photo('label.jpg'))
  await expect(panel(page).getByRole('list', { name: 'ラベルを貼った写真' })).toContainText('label.jpg')
  await packed.click()

  const finish = panel(page).getByRole('button', { name: '発送完了を記録する' })
  await expect(finish).toBeDisabled() // 追跡番号が未入力
  await panel(page).getByLabel('配送業者').fill('ヤマト運輸'); await panel(page).getByLabel('追跡番号').fill('1234-5678-9012')
  await panel(page).getByLabel('追跡URL').fill('example.test/track'); await expect(finish).toBeDisabled() // http(s) で始まらないURLは受け付けない
  await panel(page).getByLabel('追跡URL').fill('https://example.test/track/1234')
  await finish.click()
  await page.getByRole('dialog', { name: '発送完了を記録する' }).getByRole('button', { name: '記録する' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('メール送信の設定が無いため、顧客へのお知らせメールは送っていません') // テスト環境は送信設定なし
  const result = panel(page).getByLabel('発送の内容')
  await expect(result).toContainText('1234-5678-9012'); await expect(result).toContainText('（ヤマト運輸）')
  await expect(result.getByRole('link', { name: '追跡ページを開く' })).toHaveAttribute('href', 'https://example.test/track/1234')
  await expect(result).toContainText(day(40).replace(/-/g, '/')) // 到着目安 = 発送日 + 輸送30日 + 検査10日
  await expect(panel(page)).toContainText('顧客へ未通知')
  await expect(panel(page).getByRole('button')).toHaveCount(4) // 残るのは「リンクをコピー」だけ（写真4件ぶん）
  await shot(page, '81-shipping-done')
  const s = await state(request)
  expect(s.deal_shipments[0]).toMatchObject({ ship_to_name: '検証用カフェ', carton_count: 3, inspection_days: 10, tracking_number: '1234-5678-9012', shipped_on: day(0), notify_status: 'skipped' })
  expect(s.deals.find((d: { id: string }) => d.id === deal)).toMatchObject({ process_stage: 9, waiting_on: 'client' })
  await expect(page.getByText('9 / 9 検収')).toBeVisible()
})

test('製造完了の前は発送を始められない。届け先を直すと保存するまでラベルと依頼は使えない。スマホ幅も確認', async ({ page, request }) => {
  await seed(request, { finished: false })
  await open(page)
  await expect(panel(page)).toContainText('製造完了を記録すると始められます')
  await expect(panel(page).getByRole('button')).toHaveCount(0)
  expect((await page.request.get(`/deals/${deal}/carton-labels`)).status()).toBe(409) // 届け先が無いとラベルは作れない
  await request.patch(`${fixture}/rest/v1/deal_productions?deal_id=eq.${deal}`, { data: { finished_at: '2026-11-21T00:00:00Z' } })
  await open(page)
  await panel(page).getByLabel('完成品の写真・動画を選ぶ').setInputFiles(photo('done.jpg'))
  await expect(panel(page).getByRole('list', { name: '完成品の写真・動画' })).toContainText('done.jpg')
  await panel(page).getByRole('button', { name: '完了報告を確認した' }).click()
  await expect(panel(page).getByLabel('食品検査の日数')).toHaveCount(0) // 検査のない案件では出さない
  await panel(page).getByLabel('住所').fill('東京都渋谷区1-2-3'); await panel(page).getByLabel('箱数').fill('2')
  await panel(page).getByRole('button', { name: '届け先を保存する' }).click()
  await expect(panel(page).getByRole('link', { name: 'ラベルPDFを開く' })).toBeVisible()
  await panel(page).getByLabel('箱数').fill('5') // 直している途中は、古い内容のラベル・依頼を使わせない
  await expect(panel(page).getByRole('link', { name: 'ラベルPDFを開く' })).toHaveCount(0)
  await expect(panel(page).getByRole('button', { name: '工場へ発送を依頼した' })).toBeDisabled()
  await panel(page).getByRole('button', { name: '届け先を保存する' }).click()
  await expect(panel(page).getByRole('button', { name: '工場へ発送を依頼した' })).toBeEnabled()
  expect((await state(request)).deal_shipments[0].carton_count).toBe(5)
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await shot(page, '82-mobile-shipping')
})
