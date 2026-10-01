import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const fixture = 'http://127.0.0.1:55440'
const actor = '11111111-1111-4111-8111-111111111111'
const deal = '/deals/33333333-3333-4333-8333-333333333333'
const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: actor, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture'].map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort())
  await request.post(fixture + '/__reset')
  const session = { access_token: token, refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: actor, role: 'authenticated', email: 'synthetic@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
})

test('capture the same synthetic case at desktop and mobile', async ({ page }) => {
  const phase = process.env.CASE_CAPTURE_PHASE === 'before' ? 'before' : 'after'
  const dir = `tmp/case-workspace/${phase}`
  await mkdir(dir, { recursive: true })
  for (const width of [1366, 390]) for (const [name, url] of [['list', '/deals'], ['case', deal + '?step=2'], ['new', '/deals/new']]) {
    await page.setViewportSize({ width, height: 900 })
    expect((await page.goto(url))?.status()).toBe(200)
    await expect(page.locator('body')).not.toContainText('画面を読み込めませんでした')
    await page.evaluate(() => document.fonts.ready)
    if (name === 'new') await expect(page.locator('#deal-create-requirement')).not.toContainText('確認しています')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage: true })
  }
})

test('case entry searches directly, preserves filters and returns focus, and preview never updates status', async ({ page, request }) => {
  await page.goto('/deals')
  await expect(page.getByRole('table', { name: '案件一覧' })).toBeVisible()
  await page.getByRole('searchbox', { name: '案件名・番号・取引先で検索' }).fill('LOCAL-001')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page).toHaveURL(/q=LOCAL-001/)
  await page.getByRole('button', { name: '検証用パウチの概要', exact: true }).click()
  const preview = page.getByRole('region', { name: '案件の概要' })
  await expect(preview).toContainText('未採用')
  await expect(preview.getByRole('button', { name: /入金|見積依頼/ })).toHaveCount(0)
  await page.getByRole('button', { name: '概要を閉じる' }).click()
  await expect(preview).toHaveCount(0)
  await page.getByRole('link', { name: /検証用パウチ.*LOCAL-001/ }).click()
  await expect(page).toHaveURL(/step=6.*from=/)
  await page.getByRole('link', { name: '← 案件一覧へ戻る', exact: true }).click()
  await expect(page).toHaveURL(/q=LOCAL-001/)
  await expect(page.locator('#case-33333333-3333-4333-8333-333333333333')).toBeFocused()
  const state = await (await request.get(fixture + '/__state')).json()
  expect(state.deals[0].simple_status).toBe('quoting')
  expect(state.deal_status_history).toHaveLength(0)
})

test('legacy confirmed without adoption guides to adoption, not invoice or paid, and stage browsing is read-only', async ({ page, request }) => {
  await request.patch(fixture + '/rest/v1/deals?id=eq.33333333-3333-4333-8333-333333333333', { data: { simple_status: 'quote_confirmed' } })
  await page.goto(deal)
  await expect(page.getByRole('region', { name: '次の対応' })).toContainText('採用見積を確認')
  await expect(page.getByText('未採用', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: '表示する工程' }).selectOption('7')
  await expect(page.getByRole('button', { name: '請求書をつくる', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '入金を確認した → 入金完了へ', exact: true })).toBeDisabled()
  const state = await (await request.get(fixture + '/__state')).json()
  expect(state.deals[0].simple_status).toBe('quote_confirmed')
  expect(state.deal_status_history).toHaveLength(0)
})

test('two products each save two specifications with three quantity patterns using the existing atomic API', async ({ page, request }) => {
  test.setTimeout(120000)
  await page.goto('/deals/new')
  await page.getByLabel('クライアント', { exact: true }).selectOption('22222222-2222-4222-8222-222222222222')
  await page.getByRole('button', { name: 'パウチ', exact: true }).click()
  await page.getByRole('button', { name: '商品1と同じ分類の商品を追加', exact: true }).click()
  await page.getByRole('button', { name: '案件を保存して商品仕様へ', exact: true }).click()
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]+\?step=2/)
  const newId = new URL(page.url()).pathname.split('/').pop()
  for (let p = 0; p < 2; p++) {
    await page.getByRole('navigation', { name: '案件の商品' }).getByRole('button').nth(p).click()
    for (let v = 0; v < 2; v++) {
      await page.getByRole('button', { name: v ? '別の仕様案を追加' : '仕様・数量を入力', exact: true }).click()
      const editor = page.getByRole('region', { name: '商品仕様の入力' })
      await editor.getByLabel('幅（mm）', { exact: true }).fill(String(100 + v * 10))
      await editor.getByLabel('高さ（mm）', { exact: true }).fill('150')
      await editor.getByLabel('素材', { exact: true }).selectOption('PET')
      await editor.getByLabel('数量パターン 1', { exact: true }).fill('1000')
      await editor.getByLabel('数量パターン 2', { exact: true }).fill('2000')
      await editor.getByLabel('数量パターン 3', { exact: true }).fill('3000')
      await editor.getByRole('button', { name: '仕様と数量を保存', exact: true }).click()
      await expect(editor).toHaveCount(0)
    }
  }
  await page.reload()
  await mkdir('tmp/case-workspace/after', { recursive: true })
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: `tmp/case-workspace/after/two-products-${width}.png`, fullPage: true })
  }
  const state = await (await request.get(fixture + '/__state')).json()
  const ps = state.deal_products.filter((p: { deal_id: string }) => p.deal_id === newId)
  expect(ps).toHaveLength(2)
  const vs = state.deal_product_variants.filter((v: { product_id: string }) => ps.some((p: { id: string }) => p.id === v.product_id))
  expect(vs).toHaveLength(4)
  const qs = state.deal_quotes.filter((q: { deal_id: string }) => q.deal_id === newId)
  expect(qs).toHaveLength(12)
  for (const v of vs) expect(qs.filter((q: { variant_id: string }) => q.variant_id === v.id).map((q: { quantity: number }) => q.quantity)).toEqual([1000, 2000, 3000])
  expect(state.rfq_requests).toHaveLength(0)
  expect(state.documents).toHaveLength(0)
})

test('keyboard search and return restore the case list scroll and focus', async ({ page, request }) => {
  const initial = await (await request.get(fixture + '/__state')).json()
  for (let i = 1; i <= 35; i++) await request.post(fixture + '/rest/v1/deals', { data: { ...initial.deals[0], id: `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, deal_code: `LOCAL-${String(i + 1).padStart(3, '0')}`, deal_name: `合成案件${i}`, desired_delivery_date: '2027-01-01' } })
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/deals?scope=todo')
  const row = page.locator('#case-a0000000-0000-4000-8000-000000000030')
  await row.scrollIntoViewIfNeeded()
  await row.focus()
  const top = await page.locator('#main-content').evaluate(e => e.scrollTop)
  expect(top).toBeGreaterThan(100)
  await row.press('Enter')
  await expect(page.getByRole('heading', { name: '合成案件30', exact: true })).toBeVisible()
  const back = page.getByRole('link', { name: '← 案件一覧へ戻る', exact: true })
  await back.focus(); await back.press('Enter')
  await expect(page).toHaveURL(/scope=todo/)
  await expect(row).toBeFocused()
  await expect.poll(() => page.locator('#main-content').evaluate(e => e.scrollTop)).toBe(top)
  const search = page.getByRole('searchbox', { name: '案件名・番号・取引先で検索' })
  await search.focus(); await search.fill('LOCAL-031'); await search.press('Enter')
  await expect(page.getByRole('table', { name: '案件一覧' })).toContainText('合成案件30')
  await expect(page.getByRole('table', { name: '案件一覧' })).not.toContainText('合成案件29')
})

test('invalid quantities are explained and unsaved specification input survives cancelled navigation', async ({ page }) => {
  await page.goto(deal + '?step=2')
  await page.getByRole('button', { name: '別の仕様案を追加', exact: true }).click()
  const editor = page.getByRole('region', { name: '商品仕様の入力' })
  await editor.getByLabel('大分類', { exact: true }).selectOption('パウチ')
  await editor.getByLabel('数量パターン 1', { exact: true }).fill('1.5')
  await expect(editor.locator('#spec-save-reason')).toContainText('整数')
  await expect(editor.getByRole('button', { name: '仕様と数量を保存' })).toBeDisabled()
  await editor.getByLabel('数量パターン 1', { exact: true }).fill('1000')
  await editor.getByLabel('数量パターン 2', { exact: true }).fill('1000')
  await expect(editor.locator('#spec-save-reason')).toContainText('重複')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('link', { name: '← 案件一覧へ戻る', exact: true }).click()
  await expect(editor.getByLabel('数量パターン 1', { exact: true })).toHaveValue('1000')
  await expect(page).toHaveURL(/step=2/)
})

test('mobile specification cards and empty input reasons are readable; navigation and contacts collapse', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(deal + '?step=2')
  await expect(page.getByRole('region', { name: '仕様 100g', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '別の仕様案を追加', exact: true }).click()
  const editor = page.getByRole('region', { name: '商品仕様の入力' })
  await expect(editor.getByRole('button', { name: '仕様と数量を保存', exact: true })).toBeDisabled()
  await expect(editor.locator('#spec-save-reason')).toContainText('大分類')
  await editor.getByRole('button', { name: '入力を閉じる', exact: true }).click()
  await page.getByRole('button', { name: '連絡記録を開く', exact: true }).click()
  await expect(page.getByRole('complementary', { name: '案件の連絡記録' })).toContainText('チャット受信は行いません')
  await page.getByRole('button', { name: '連絡記録を閉じる', exact: true }).click()
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.getByRole('button', { name: 'ナビを閉じる', exact: true }).click()
  await expect(page.getByRole('button', { name: 'ナビを開く', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ナビを開く', exact: true }).click()
})
