import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

// 再設計 工程2（商品登録）: ブラウザ → 実際の Next サーバーアクション → 代役DB の配線確認。
// 検査・名前付け・数量の扱いの正しさ（SQL）は tests/process-stage2-sql.test.ts で別に検証している。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const seededDeal = '33333333-3333-4333-8333-333333333333' // 代役DBに元からある案件（工場の価格が入った商品1つ）
const newDeal = 'aaaaaaaa-0000-4000-8000-000000000001'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true })
const pick = (page: Page, g: string, name: string | RegExp) => group(page, g).getByRole('button', { name, exact: typeof name === 'string' }).click()
const add = (page: Page) => page.getByRole('button', { name: '＋ 商品を追加' }).first().click()
const cards = (page: Page) => page.getByRole('list', { name: '登録した商品' }).getByRole('listitem')

test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
  await request.post(`${fixture}/rest/v1/deals`, { data: { id: newDeal, deal_code: 'PF-TEST-001', deal_name: '商品登録の確認', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'us', sales_user_id: userId, process_stage: 1, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' } })
})

async function registerStandPouch(page: Page) {
  await add(page)
  await pick(page, '種類', '袋'); await pick(page, '形状', 'スタンド袋'); await pick(page, 'ディテール', 'ジップ付きスタンド')
  await pick(page, '素材', 'クラフト紙'); await pick(page, '印刷の色数', '4色（フルカラー）')
  await pick(page, '付属品', 'ジップ'); await pick(page, '付属品', 'バルブ')
  await pick(page, '大きさの決め方', '縦×横×奥行')
  await page.getByLabel('横（幅）（mm）').fill('120'); await page.getByLabel('縦（高さ）（mm）').fill('200'); await page.getByLabel('奥行（マチ・深さ）（mm）').fill('40')
  await pick(page, 'よく使う数量', '1,000'); await pick(page, 'よく使う数量', '5,000')
  await pick(page, '配送方法', '船便'); await pick(page, '配送の手配', '提携の配送業者に頼む')
  await pick(page, 'サンプル', 'サンプルを頼む'); await pick(page, '食品検査', '必要')
}
const standName = 'ジップ付きスタンド / W120×H200×D40mm / クラフト紙 / 4色（フルカラー） / ジップ・バルブ'

test('商品を登録すると、名前が自動で付き、仕様・数量・配送・サンプル・食品検査が保存される', async ({ page, request }) => {
  await page.goto(`/deals/${newDeal}`)
  await expect(page.getByText('2 / 9 商品登録')).toBeVisible()
  await registerStandPouch(page)
  // 数量: スロットと手入力でも足せる
  await page.getByRole('button', { name: 'スロットで選ぶ' }).click()
  await page.getByRole('listbox', { name: '数量のスロット' }).getByRole('option', { name: '20,000' }).click()
  await page.getByRole('button', { name: '20,000 を追加' }).click()
  await page.getByLabel('数量を手で入力').fill('12000'); await page.getByRole('button', { name: 'この数量を追加' }).click()
  await page.getByPlaceholder('備考', { exact: true }).fill('マット仕上げ希望')
  await expect(page.getByTestId('product-name-preview')).toHaveText(standName)
  await expect(page.getByRole('list', { name: '選んだ数量' }).getByRole('listitem')).toHaveCount(4)
  await shot(page, '20-product-form')
  await page.getByRole('button', { name: 'この内容で登録する' }).click()
  const card = cards(page).first()
  await expect(card).toContainText(standName)
  for (const t of ['袋 › スタンド袋 › ジップ付きスタンド', '船便・提携業者', 'サンプルあり', '食品検査あり', '1,000', '5,000', '12,000', '20,000', 'マット仕上げ希望']) await expect(card).toContainText(t)
  await shot(page, '21-product-list-one')
  const s = await state(request)
  const product = s.deal_products.find((p: { deal_id: string }) => p.deal_id === newDeal)
  expect(product).toMatchObject({ description: standName, category_l1: '袋', category_l2: 'スタンド袋', category_l3: 'ジップ付きスタンド', shipping_mode: 'sea', shipping_arranger: 'partner', sample_required: true, food_inspection_required: true, product_memo: 'マット仕上げ希望' })
  const variant = s.deal_product_variants.find((v: { product_id: string }) => v.product_id === product.id)
  expect(variant).toMatchObject({ size_mode: 'box', width_mm: 120, height_mm: 200, depth_mm: 40, material: 'クラフト紙', print_color_count: '4色（フルカラー）', accessories: ['ジップ', 'バルブ'] })
  expect(s.deal_quotes.filter((q: { variant_id: string }) => q.variant_id === variant.id).map((q: { quantity: number }) => q.quantity).sort((a: number, b: number) => a - b)).toEqual([1000, 5000, 12000, 20000])
  expect(s.deals.find((d: { id: string }) => d.id === newDeal).process_stage).toBe(2)
})

test('キーボードなし（押すだけ）で登録でき、大きさ未定でも登録できる。数量なしは理由つきで止まる', async ({ page, request }) => {
  await page.goto(`/deals/${newDeal}?step=2`)
  await add(page)
  await pick(page, '種類', '袋'); await pick(page, '形状', '平袋')
  await expect(group(page, 'ディテール')).toHaveCount(0) // 下の階層がなければ出さない
  await page.getByRole('button', { name: 'この内容で登録する' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '数量を1つ以上' })).toBeVisible()
  expect((await state(request)).deal_products.filter((p: { deal_id: string }) => p.deal_id === newDeal)).toHaveLength(0)
  await pick(page, 'よく使う数量', '3,000')
  await page.getByRole('button', { name: 'この内容で登録する' }).click()
  await expect(cards(page).first()).toContainText('平袋 / サイズ未定')
  await expect(cards(page).first()).toContainText('配送方法 未定')
  const s = await state(request)
  const product = s.deal_products.find((p: { deal_id: string }) => p.deal_id === newDeal)
  expect(s.deal_product_variants.find((v: { product_id: string }) => v.product_id === product.id)).toMatchObject({ size_mode: 'undecided', width_mm: null, material: null })
})

test('コピーして一部だけ変える・並べ替え（上下ボタンとドラッグ）・削除は確認を挟む', async ({ page, request }) => {
  await page.goto(`/deals/${newDeal}?step=2`)
  await registerStandPouch(page)
  await page.getByRole('button', { name: 'この内容で登録する' }).click()
  await expect(cards(page)).toHaveCount(1)
  // コピー → ジップを外して登録
  await page.getByRole('button', { name: '1番目の商品をコピー' }).click()
  await expect(page.getByTestId('product-name-preview')).toHaveText(standName)
  await pick(page, '付属品', 'ジップ')
  await page.getByRole('button', { name: 'この内容で登録する' }).click()
  await expect(cards(page)).toHaveCount(2)
  const noZip = 'ジップ付きスタンド / W120×H200×D40mm / クラフト紙 / 4色（フルカラー） / バルブ'
  await expect(cards(page).nth(1)).toContainText(noZip)
  // 3つ目
  await add(page); await pick(page, '種類', 'パウチ'); await pick(page, 'よく使う数量', '500')
  await page.getByRole('button', { name: 'この内容で登録する' }).click()
  await expect(cards(page)).toHaveCount(3)
  await shot(page, '22-product-list-three')
  const names = async () => (await state(request)).deal_products.filter((p: { deal_id: string }) => p.deal_id === newDeal).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order).map((p: { description: string }) => p.description)
  expect(await names()).toEqual([standName, noZip, 'パウチ / サイズ未定'])
  // 上下ボタン
  await page.getByRole('button', { name: '1番目の商品を下へ' }).click()
  await expect.poll(names).toEqual([noZip, standName, 'パウチ / サイズ未定'])
  // ドラッグ: 3番目を先頭へ
  await cards(page).nth(2).dragTo(cards(page).nth(0))
  await expect.poll(names).toEqual(['パウチ / サイズ未定', noZip, standName])
  await page.reload()
  await expect(cards(page).first()).toContainText('パウチ / サイズ未定') // 読み直しても順番が残る
  // 削除: 確認を挟み、やめると残る
  await page.getByRole('button', { name: '1番目の商品を削除' }).click()
  const dialog = page.getByRole('dialog', { name: '削除の確認' })
  await expect(dialog).toContainText('パウチ / サイズ未定')
  await shot(page, '23-product-delete-confirm')
  await dialog.getByRole('button', { name: 'やめる' }).click()
  await expect(cards(page)).toHaveCount(3)
  await page.getByRole('button', { name: '1番目の商品を削除' }).click()
  await dialog.getByRole('button', { name: '削除する' }).click()
  await expect(cards(page)).toHaveCount(2)
  expect(await names()).toEqual([noZip, standName])
})

test('編集: 以前の画面で登録した商品も開ける。価格のある数量は外せず、価格のある商品は削除できない（黙って消さない）', async ({ page, request }) => {
  await page.goto(`/deals/${seededDeal}?step=2`)
  await expect(cards(page).first()).toContainText('パウチ')
  await page.getByRole('button', { name: '1番目の商品を編集' }).click()
  await expect(group(page, '大きさの決め方').getByRole('button', { name: '縦×横×奥行' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('横（幅）（mm）')).toHaveValue('100')
  await expect(group(page, '素材').getByRole('button', { name: 'PET' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '数量 1,000 を外す' }).click()
  await pick(page, 'よく使う数量', '3,000')
  await page.getByRole('button', { name: 'この内容で保存する' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '数量 1000 には工場の価格や見積の記録があるため外せません' })).toBeVisible()
  expect((await state(request)).deal_quotes.map((q: { quantity: number }) => q.quantity)).toEqual([1000])
  // 数量を戻して足すだけなら保存できる
  await pick(page, 'よく使う数量', '1,000')
  await page.getByRole('button', { name: 'この内容で保存する' }).click()
  await expect(page.getByRole('heading', { name: '1番目の商品を編集' })).toHaveCount(0) // 保存が済むと入力欄が閉じる
  await expect(cards(page).first()).toContainText('3,000')
  expect((await state(request)).deal_quotes.map((q: { quantity: number }) => q.quantity).sort((a: number, b: number) => a - b)).toEqual([1000, 3000])
  await page.getByRole('button', { name: '1番目の商品を削除' }).click()
  await page.getByRole('dialog', { name: '削除の確認' }).getByRole('button', { name: '削除する' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '工場の価格や見積の記録があるため削除できません' })).toBeVisible()
  expect((await state(request)).deal_products).toHaveLength(1)
})

test('商品マスター: 足した選択肢がすぐ商品登録で選べ、削除は確認を挟む', async ({ page, request }) => {
  await page.goto('/settings')
  await page.getByRole('link', { name: /商品マスター/ }).click()
  await expect(page.getByRole('heading', { name: '商品マスター' })).toBeVisible()
  await page.waitForLoadState('networkidle') // 画面の準備（ハイドレーション）を待ってから入力する
  await page.getByLabel('新しい素材').fill('和紙'); await page.getByRole('button', { name: '素材を追加' }).click()
  await expect(page.getByRole('region', { name: '素材' })).toContainText('和紙')
  // 種類 › 形状 › ディテール
  const tree = page.getByRole('region', { name: '種類・形状・ディテール' })
  await tree.getByRole('button', { name: /^袋/ }).click()
  await tree.getByRole('button', { name: /^平袋/ }).click()
  await page.getByLabel('新しいディテール').fill('三方シール'); await page.getByRole('button', { name: 'ディテールを追加' }).click()
  await expect(tree.getByRole('list', { name: 'ディテール' })).toContainText('三方シール')
  await shot(page, '24-product-master')
  await page.getByRole('button', { name: 'バルブ を削除' }).click()
  await expect(page.getByRole('dialog', { name: '削除の確認' })).toBeVisible()
  await page.getByRole('button', { name: '削除する' }).click()
  await expect.poll(async () => (await state(request)).product_option_items.map((o: { name: string }) => o.name)).not.toContain('バルブ')
  // 商品登録に反映
  await page.goto(`/deals/${newDeal}?step=2`)
  await add(page)
  await expect(group(page, '素材').getByRole('button', { name: '和紙' })).toBeVisible()
  await expect(group(page, '付属品').getByRole('button', { name: 'バルブ' })).toHaveCount(0)
  await pick(page, '種類', '袋'); await pick(page, '形状', '平袋')
  await expect(group(page, 'ディテール').getByRole('button', { name: '三方シール' })).toBeVisible()
})

test('入力の途中で別の工程へ移ろうとすると確認が出て、やめれば入力が残る', async ({ page }) => {
  await page.goto(`/deals/${newDeal}?step=2`)
  await add(page)
  await pick(page, '種類', '袋'); await pick(page, 'よく使う数量', '1,000')
  let asked = ''
  page.once('dialog', d => { asked = d.message(); d.dismiss() })
  await page.getByRole('list', { name: '工程の進み具合' }).getByRole('button', { name: /3 工場見積/ }).click()
  expect(asked).toContain('未保存')
  await expect(page).toHaveURL(/step=2/)
  await expect(group(page, '種類').getByRole('button', { name: '袋', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('list', { name: '選んだ数量' }).getByRole('listitem')).toHaveCount(1)
})

test('スマホ幅(390px)で商品登録と商品マスターが横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/deals/${seededDeal}?step=2`)
  await add(page)
  await pick(page, '大きさの決め方', '縦×横×奥行')
  await page.getByRole('button', { name: 'スロットで選ぶ' }).click()
  for (const check of ['deal', 'master'] as const) {
    if (check === 'master') await page.goto('/settings/product-master')
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), check).toBeLessThanOrEqual(0)
    await shot(page, check === 'deal' ? '25-mobile-product-form' : '26-mobile-product-master')
  }
})
