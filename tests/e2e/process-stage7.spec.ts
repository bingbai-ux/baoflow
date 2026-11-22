import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

// 再設計 工程7（サンプル製造 → 本製造）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 順番・必須条件の正しさ（SQL）は tests/process-stage7-sql.test.ts で別に検証している。
// ファイル保管は代役（アップロードの要求があったことだけ記録し、中身は保存しない）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000007', pA = 'aaaaaaaa-0000-4000-8000-0000000007b1'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const panel = (page: Page) => page.getByRole('region', { name: 'サンプルと本製造' })
const round = (page: Page, n: number) => panel(page).getByRole('list', { name: 'サンプルの回' }).getByRole('listitem').filter({ hasText: `第${n}回` }).first()
async function open(page: Page) { await page.goto(`/deals/${deal}?step=10`); await page.waitForLoadState('networkidle') }
const day = (offset: number) => new Date(Date.now() + 9 * 3600000 + offset * 86400000).toISOString().slice(0, 10) // 日本時間の日付
const slash = (d: string) => d.replace(/-/g, '/')
async function seed(request: APIRequestContext, opts: { sample: boolean; started?: boolean }) {
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-007', deal_name: '秋冬の新商品', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quote_confirmed', waiting_on: 'factory', sales_user_id: userId, process_stage: 7, tags: [], desired_delivery_date: day(60), last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { id: pA, deal_id: deal, product_no: 1, sort_order: 1, description: '平袋', sample_required: opts.sample, is_selected: false })
  await post(request, 'price_offers', { deal_id: deal, round: 1, token: 'seeded-offer-7', status: 'approved', snapshot: { round: 1, items: [] }, choices: [], created_at: '2026-11-20T00:00:00Z' })
  if (opts.started !== false) await post(request, 'deal_intakes', { deal_id: deal, pattern: 'customer', production_started_at: '2026-11-21T00:00:00Z', prepay_paid_on: '2026-11-21', prepay_rate: 50, prepay_amount_usd: 500 })
}

test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
})

test('サンプルが必要な案件: 写真を登録 → 顧客へ → 修正なら第2回 → 承認されると本製造を開始でき、あと何日・到着目安が出る', async ({ page, request }) => {
  await seed(request, { sample: true })
  await open(page)
  await expect(panel(page)).toContainText('必要'); await expect(panel(page)).toContainText('サンプルの承認後')
  const startProduction = panel(page).getByRole('button', { name: '本製造を開始' })
  await expect(startProduction).toBeDisabled()
  await panel(page).getByLabel('サンプルの完成予定日').fill(day(7))
  await panel(page).getByRole('button', { name: '第1回サンプルを依頼' }).click()
  await expect(round(page, 1)).toContainText(`工場で製作中（完成予定 ${slash(day(7))}）`)
  await expect(round(page, 1).getByRole('button', { name: '工場から受け取った' })).toBeDisabled() // 写真・動画を登録するまで記録できない
  await panel(page).getByLabel('第1回の写真・動画を選ぶ').setInputFiles([{ name: 'sample-front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('jpg') }, { name: 'sample.mp4', mimeType: 'video/mp4', buffer: Buffer.from('mp4') }])
  await expect(round(page, 1).getByRole('list', { name: '第1回の写真・動画' }).getByRole('listitem')).toHaveCount(2)
  await round(page, 1).getByRole('button', { name: '工場から受け取った' }).click()
  await round(page, 1).getByRole('button', { name: '顧客へ渡した' }).click()
  await expect(round(page, 1)).toContainText('顧客の返事待ち')
  await round(page, 1).getByRole('button', { name: '修正の指示があった' }).click()
  const dialog = page.getByRole('dialog', { name: '修正の指示があった' })
  await expect(dialog.getByRole('button', { name: '記録する' })).toBeDisabled()
  await dialog.getByLabel('顧客からの指示').fill('ロゴをもう少し濃く')
  await dialog.getByRole('button', { name: '記録する' }).click()
  await expect(round(page, 1)).toContainText('修正の内容: ロゴをもう少し濃く')
  await panel(page).getByLabel('第1回の修正データを選ぶ').setInputFiles({ name: 'fix.ai', mimeType: 'application/postscript', buffer: Buffer.from('ai') })
  await expect(round(page, 1).getByRole('list', { name: '第1回の修正データ' })).toContainText('fix.ai')
  await expect(startProduction).toBeDisabled()
  await shot(page, '70-sample-revise')

  await panel(page).getByLabel('サンプルの完成予定日').fill(day(14))
  await panel(page).getByRole('button', { name: '第2回サンプルを依頼' }).click()
  await panel(page).getByLabel('第2回の写真・動画を選ぶ').setInputFiles({ name: 'sample2.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('jpg') })
  await expect(round(page, 2).getByRole('list', { name: '第2回の写真・動画' })).toContainText('sample2.jpg')
  await round(page, 2).getByRole('button', { name: '工場から受け取った' }).click()
  await round(page, 2).getByRole('button', { name: '顧客へ渡した' }).click()
  await round(page, 2).getByRole('button', { name: '顧客が承認した' }).click()
  await page.getByRole('dialog', { name: '顧客が承認した' }).getByRole('button', { name: '記録する' }).click()
  await expect(round(page, 2)).toContainText('承認')
  await expect(panel(page).getByRole('button', { name: /サンプルを依頼/ })).toHaveCount(0)

  await panel(page).getByLabel('完成予定日', { exact: true }).fill(day(20))
  await panel(page).getByLabel('完成から到着までの日数').fill('30')
  await startProduction.click()
  await expect(panel(page).getByLabel('製造の予定')).toContainText('あと 20日')
  await expect(panel(page).getByLabel('製造の予定')).toContainText(slash(day(50))) // 到着目安 = 完成 + 30日
  await expect(panel(page).getByLabel('製造の予定')).toContainText('10日前に着') // 希望納期は60日後
  await shot(page, '71-production-running')
  const s = await state(request)
  expect(s.sample_rounds.map((r: { round: number; result: string }) => [r.round, r.result])).toEqual([[1, 'revise'], [2, 'approved']])
  expect(s.deal_design_files.filter((f: { deal_id: string }) => f.deal_id === deal).map((f: { category: string }) => f.category).sort()).toEqual(['sample_fix_r1', 'sample_r1', 'sample_r1', 'sample_r2'])
  expect(s.deal_productions[0]).toMatchObject({ due_on: day(20), transit_days: 30 })
})

test('サンプルが不要な案件: そのまま本製造へ。予定を直すと遅れが見え、製造完了で発送へ進む。スマホ幅も確認', async ({ page, request }) => {
  await seed(request, { sample: false })
  await open(page)
  await expect(panel(page).getByRole('heading', { name: /サンプル/ })).toContainText('なし')
  await panel(page).getByLabel('完成予定日', { exact: true }).fill(day(10))
  await panel(page).getByLabel('完成から到着までの日数').fill('7')
  await panel(page).getByRole('button', { name: '本製造を開始' }).click()
  await expect(panel(page).getByLabel('製造の予定')).toContainText('あと 10日'); await expect(panel(page).getByLabel('製造の予定')).toContainText('43日前に着')
  await panel(page).getByRole('button', { name: '予定を直す' }).click()
  await panel(page).getByLabel('完成予定日', { exact: true }).fill(day(40))
  await panel(page).getByLabel('完成から到着までの日数').fill('30')
  await panel(page).getByRole('button', { name: '予定を変更する' }).click()
  await expect(panel(page).getByLabel('製造の予定')).toContainText('あと 40日'); await expect(panel(page).getByLabel('製造の予定')).toContainText('10日 遅れ') // 希望納期（60日後）に間に合わない
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await shot(page, '72-mobile-production')
  await page.setViewportSize({ width: 1280, height: 720 })
  await panel(page).getByRole('button', { name: '製造完了 → 発送へ進む' }).click()
  await page.getByRole('dialog', { name: '製造完了' }).getByRole('button', { name: '進む' }).click()
  await expect(panel(page)).toContainText('製造完了')
  await expect(panel(page).getByRole('button', { name: /予定を直す|発送へ進む|サンプルを依頼/ })).toHaveCount(0) // 完了後は変更できない
  const s = await state(request)
  expect(s.deals.find((d: { id: string }) => d.id === deal)).toMatchObject({ process_stage: 8, waiting_on: 'us' })
  await expect(page.getByText('8 / 9 発送')).toBeVisible()
})

test('入稿と前払いが済むまではサンプルも本製造も始められない', async ({ page, request }) => {
  await seed(request, { sample: true, started: false })
  await open(page)
  await expect(panel(page)).toContainText('入稿と前払いを済ませて「製作開始へ進む」を押すと始められます')
  await expect(panel(page).getByRole('button')).toHaveCount(0)
  await panel(page).getByRole('link', { name: '入稿を開く' }).click()
  await expect(page).toHaveURL(/step=9/)
  expect((await state(request)).sample_rounds || []).toHaveLength(0)
})
