import { test, expect, type Page } from '@playwright/test'

// 再設計 工程1: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// SQL の正しさ（移行・採番・権限・履歴）は tests/process-stage1-sql.test.ts で別に検証している。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const day = (offset: number) => new Date(Date.now() + 9 * 3600000 + offset * 86400000).toISOString().slice(0, 10)

test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
})
const state = async (request: import('@playwright/test').APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: import('@playwright/test').APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })

test('T1 既存取引先からクリックだけでプロジェクトが工程1で作られる', async ({ page, request }) => {
  await post(request, 'client_contacts', { id: 'c0000000-0000-4000-8000-000000000001', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await page.goto('/deals/new')
  await shot(page, '01-new-choose')
  await page.getByRole('button', { name: /既存の取引先/ }).click()
  await shot(page, '02-new-pick-client')
  await page.getByRole('button', { name: /検証用カフェ/ }).click()
  await expect(page.getByRole('button', { name: /佐藤/ })).toHaveAttribute('aria-pressed', 'true') // 1人なら自動で選ばれる
  await page.getByRole('button', { name: '2か月後' }).click()
  await expect(page.getByRole('button', { name: '2か月後' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '未定' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText(/残り \d+日/)).toBeVisible()
  await shot(page, '03-new-details')
  await page.getByRole('button', { name: 'このプロジェクトをつくる' }).click()
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/)
  await expect(page.getByText('1 / 9 プロジェクト作成')).toBeVisible()
  await expect(page.getByText(/次は「商品登録」です/)).toBeVisible()
  await shot(page, '04-deal-header-stage1')
  const s = await state(request)
  expect(s.deals).toHaveLength(2)
  const created = s.deals[1]
  expect(created.process_stage).toBe(1)
  expect(created.client_id).toBe(clientId)
  expect(created.contact_id).toBe('c0000000-0000-4000-8000-000000000001')
  expect(created.desired_delivery_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('T2 新規取引先を登録してそのまま作成でき、担当者を複数持てる', async ({ page, request }) => {
  await page.goto('/deals/new')
  await page.getByRole('button', { name: /新規の取引先/ }).click()
  await page.getByLabel('会社名（必須）').fill('（テスト）デモ商事')
  await page.getByLabel('担当者の名前').fill('田中')
  await page.getByLabel('メール').fill('tanaka@example.test')
  await shot(page, '05-new-client-form')
  await page.getByRole('button', { name: '登録して次へ' }).click()
  await expect(page.getByRole('button', { name: /田中/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '＋ 担当者を追加' }).click()
  await page.getByLabel('名前（必須）').fill('鈴木')
  await page.getByRole('button', { name: 'この担当者を追加' }).click()
  await expect(page.getByRole('button', { name: /鈴木/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'このプロジェクトをつくる' }).click()
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/)
  const s = await state(request)
  const client = s.clients.find((c: { company_name: string }) => c.company_name === '（テスト）デモ商事')
  const contacts = s.client_contacts.filter((c: { client_id: string }) => c.client_id === client.id)
  expect(contacts.map((c: { name: string }) => c.name).sort()).toEqual(['田中', '鈴木'].sort())
  expect(contacts.filter((c: { is_primary: boolean }) => c.is_primary)).toHaveLength(1)
  const deal = s.deals.at(-1)
  expect(deal.client_id).toBe(client.id)
  expect(deal.contact_id).toBe(contacts.find((c: { name: string }) => c.name === '鈴木').id)
})

test('T3 ブランドは登録がある取引先でだけ選択肢が出て、その場で追加もできる', async ({ page, request }) => {
  await page.goto(`/deals/new?client=${clientId}`)
  await expect(page.getByRole('button', { name: '指定しない' })).toHaveCount(0)
  await page.getByRole('button', { name: /この会社にブランドを登録する/ }).click()
  await page.getByLabel('ブランド名').fill('TEST COFFEE')
  await page.getByRole('button', { name: 'このブランドを追加' }).click()
  await expect(page.getByRole('button', { name: 'TEST COFFEE' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '指定しない' })).toBeVisible()
  await shot(page, '06-brand-selected')
  await page.getByRole('button', { name: 'このプロジェクトをつくる' }).click()
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/)
  const s = await state(request)
  expect(s.deals.at(-1).brand_text).toBe('TEST COFFEE')
  expect(s.deals.at(-1).deal_name).toMatch(/^TEST COFFEE /)
  // 登録済みの取引先では最初から選択肢が出る
  await page.goto(`/deals/new?client=${clientId}`)
  await expect(page.getByRole('button', { name: 'TEST COFFEE' })).toBeVisible()
})

test('T5 案件一覧に9工程と残り日数（7日以内・超過・未設定）が出て、並び替えられる', async ({ page, request }) => {
  const base = { client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'us', sales_user_id: userId, last_activity_at: '2026-09-30T00:00:00Z', tags: [] }
  await post(request, 'deals', { ...base, deal_code: 'T-SOON', deal_name: '納期が近い案件', process_stage: 7, desired_delivery_date: day(5) })
  await post(request, 'deals', { ...base, deal_code: 'T-OVER', deal_name: '納期を過ぎた案件', process_stage: 4, desired_delivery_date: day(-3) })
  await post(request, 'deals', { ...base, deal_code: 'T-NONE', deal_name: '納期が未定の案件', process_stage: 1, desired_delivery_date: null })
  await post(request, 'deals', { ...base, deal_code: 'T-FAR', deal_name: '余裕のある案件', process_stage: 3, desired_delivery_date: day(40) })
  await page.goto('/deals?scope=all')
  const row = (name: string) => page.getByRole('row').filter({ hasText: name })
  await expect(row('納期が近い案件').getByText('残り 5日')).toBeVisible()
  await expect(row('納期が近い案件').getByText('7 / 9 製造')).toBeVisible()
  await expect(row('納期を過ぎた案件').getByText('3日 超過')).toBeVisible()
  await expect(row('納期が未定の案件').getByText('納期未設定')).toBeVisible()
  await expect(row('余裕のある案件').getByText('残り 40日')).toBeVisible()
  await shot(page, '07-deal-list')
  // 既定は納期が近い順（超過 → 近い → 余裕 → 未設定）。代役DBに元からある1件は比較から外す
  const mine = ['納期を過ぎた案件', '納期が近い案件', '余裕のある案件', '納期が未定の案件']
  const names = async () => (await page.getByRole('row').locator('a[id^="case-"] > span:first-child').allTextContents()).filter(n => mine.includes(n))
  expect(await names()).toEqual(mine)
  await page.getByLabel('並び順').selectOption('stage')
  await expect(page).toHaveURL(/sort=stage/)
  expect(await names()).toEqual(['納期が未定の案件', '余裕のある案件', '納期を過ぎた案件', '納期が近い案件'])
})

test('工程を手で直すと表示が変わり、履歴が1件残る', async ({ page, request }) => {
  await page.goto('/deals/33333333-3333-4333-8333-333333333333')
  await expect(page.getByText('2 / 9 商品登録')).toBeVisible()
  await page.getByText('工程を手で直す').click()
  await page.getByRole('group', { name: '工程を選ぶ' }).getByRole('button', { name: /4 価格提示/ }).click()
  await expect(page.getByText('4 / 9 価格提示')).toBeVisible()
  const s = await state(request)
  expect(s.deals[0].process_stage).toBe(4)
  expect(s.deal_status_history.filter((h: { note?: string }) => h.note?.includes('工程を'))).toHaveLength(1)
  await shot(page, '08-deal-header-stage4')
})

test('取引先マスター: 一覧 → 詳細で担当者とブランドを管理できる', async ({ page, request }) => {
  await post(request, 'client_contacts', { id: 'c0000000-0000-4000-8000-000000000001', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await page.goto('/clients')
  await expect(page.getByRole('heading', { name: '取引先' })).toBeVisible()
  await shot(page, '09-clients-list')
  await page.getByRole('link', { name: '検証用カフェ' }).click()
  await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`))
  await page.getByRole('button', { name: '＋ 担当者を追加' }).click()
  await page.getByLabel('名前（必須）').fill('高橋')
  await page.getByRole('button', { name: 'この内容で保存する' }).click()
  await expect(page.getByText('高橋')).toBeVisible()
  await page.getByRole('button', { name: '主担当にする' }).click()
  await expect.poll(async () => (await state(request)).client_contacts.filter((c: { is_primary: boolean }) => c.is_primary).map((c: { name: string }) => c.name)).toEqual(['高橋'])
  await page.getByLabel('新しいブランド名').fill('TEST BRAND')
  await page.getByRole('button', { name: 'ブランドを追加' }).click()
  await expect(page.getByText('TEST BRAND')).toBeVisible()
  await shot(page, '10-client-detail')
  // 削除は確認ポップアップを挟む
  await page.getByRole('button', { name: 'TEST BRAND を削除' }).click()
  await expect(page.getByRole('dialog', { name: '削除の確認' })).toBeVisible()
  await page.getByRole('button', { name: '削除する' }).click()
  await expect.poll(async () => (await state(request)).brands.length).toBe(0)
})

test('スマホ幅(390px)で横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/deals', '/deals/new', `/deals/new?client=${clientId}`, '/clients', `/clients/${clientId}`, '/deals/33333333-3333-4333-8333-333333333333']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
  await page.goto('/deals'); await shot(page, '11-mobile-deal-list')
  await page.goto(`/deals/new?client=${clientId}`); await shot(page, '12-mobile-new-details')
})
