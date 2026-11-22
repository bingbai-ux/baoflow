import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

// 横断機能（トーク欄・AIの返信下書き・カタログのAI取込）: ブラウザ → 実際の Next サーバー → 代役DB / AIの代役 の配線確認。
// AIは代役が決まった返事を返す（外部には接続しない）。本物のAIの文章の良し悪しは、このテストでは確かめていない。
// メールは実際には送らない（送信キーを空にしてあり、送れない状態の表示を確認する）。

const fixture = 'http://127.0.0.1:55440'
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'
const deal = 'aaaaaaaa-0000-4000-8000-000000000010'
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, exp: 4102444800, iat: 1700000000, role: 'authenticated' }, 'fixture']
  .map(x => typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
const shots = process.env.STAGE1_SHOTS
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }
const state = async (request: APIRequestContext) => await (await request.get(fixture + '/__state')).json()
const post = (request: APIRequestContext, table: string, data: object) => request.post(`${fixture}/rest/v1/${table}`, { data })
const talk = (page: Page) => page.getByRole('region', { name: 'トーク' })
const thread = (page: Page) => talk(page).getByRole('list', { name: 'やり取り' })

test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await request.post(fixture + '/__reset')
  const session = { access_token: jwt, refresh_token: 'local-fixture-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { id: userId, role: 'authenticated', email: 'local@example.test' } }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
})

test('トーク欄: 届いた連絡を記録し、AIの下書きを直して記録できる。工場あては中国語つき。相手ごとに渡す履歴を分ける', async ({ page, request }) => {
  await post(request, 'client_contacts', { id: 'aaaaaaaa-0000-4000-8000-0000000010d1', client_id: clientId, name: '佐藤', email: 'sato@example.test', is_primary: true })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-010', deal_name: '定番の袋', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'us', sales_user_id: userId, process_stage: 3, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_products', { deal_id: deal, product_no: 1, sort_order: 1, description: '平袋 / W100×H150mm', is_selected: false })
  await page.goto(`/deals/${deal}`); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '会話・連絡記録を開く', exact: true }).click()
  await expect(thread(page)).toContainText('やり取りはまだありません')

  // 顧客から届いたメールを記録
  await talk(page).getByRole('button', { name: '相手から届いた' }).click()
  await talk(page).getByLabel('本文').fill('納期を1週間早められますか？')
  await talk(page).getByRole('button', { name: '記録する' }).click()
  await expect(thread(page).getByRole('listitem')).toHaveCount(1)
  await expect(thread(page)).toContainText('顧客 ・ メール'); await expect(thread(page)).toContainText('納期を1週間早められますか？')
  // 工場とのやり取り（顧客あての下書きには渡さない）
  await talk(page).getByRole('button', { name: '工場', exact: true }).click()
  await talk(page).getByLabel('本文').fill('原価は1個 0.08ドルです')
  await talk(page).getByRole('button', { name: '記録する' }).click()
  await expect(thread(page).getByRole('listitem')).toHaveCount(2)
  await expect(thread(page)).toContainText('工場 ・ WeChat')

  // 顧客あての下書き → 直して記録。メール送信は設定が無いので押せない
  await talk(page).getByRole('button', { name: '顧客', exact: true }).click()
  await talk(page).getByLabel(/AIへの指示/).fill('難しいと伝える')
  await talk(page).getByRole('button', { name: '顧客あての下書きをAIでつくる' }).click()
  await expect(talk(page).getByLabel('本文')).toHaveValue('お世話になっております。ご連絡の件、確認のうえご連絡します。')
  await talk(page).getByLabel('手段').selectOption('email')
  await expect(talk(page)).toContainText('宛先: 佐藤 <sato@example.test>')
  await expect(talk(page).getByRole('button', { name: 'メールで送る' })).toBeDisabled()
  await expect(talk(page)).toContainText('メール送信の設定がありません')
  await talk(page).getByLabel('本文').fill('お世話になっております。1週間の前倒しは難しい状況です。')
  await talk(page).getByRole('button', { name: '記録する' }).click()
  await expect(thread(page).getByRole('listitem')).toHaveCount(3)
  await expect(thread(page)).toContainText('BAO ・ メール')
  await shot(page, 'a0-talk')
  // 工場あての下書きは中国語 + 日本語訳
  await talk(page).getByRole('button', { name: '工場', exact: true }).click()
  await talk(page).getByRole('button', { name: '工場あての下書きをAIでつくる' }).click()
  await expect(talk(page).getByLabel('本文')).toHaveValue(/您好.*\n--- 日本語訳 ---\n/)

  const s = await state(request)
  expect(s.deal_communications.map((c: { author_role: string; channel: string }) => [c.author_role, c.channel])).toEqual([['client', 'email'], ['factory', 'wechat'], ['staff', 'email']])
  const [toClient, toFactory] = s.ai_requests
  expect(toClient.text).toContain('納期を1週間早められますか？'); expect(toClient.text).toContain('営業からの指示: 難しいと伝える'); expect(toClient.text).toContain('平袋 / W100×H150mm')
  expect(toClient.text).not.toContain('0.08') // 顧客あての下書きに、工場とのやり取り（原価）は渡さない
  expect(toFactory.text).toContain('原価は1個 0.08ドルです'); expect(toFactory.text).not.toContain('納期を1週間早められますか？') // 工場あてには顧客とのやり取りを渡さない
  // AIが混んでいて使えないときは、下書きを入れずに理由を出す
  await request.post(fixture + '/__ai_fail', { data: { fail: true } })
  await talk(page).getByLabel('本文').fill('')
  await talk(page).getByRole('button', { name: '工場あての下書きをAIでつくる' }).click()
  await expect(talk(page).getByRole('alert')).toContainText('AIで下書きをつくれませんでした')
  await expect(talk(page).getByLabel('本文')).toHaveValue('')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

test('カタログのAI取込: 画像を読ませると、登録済みを除いた候補が出る。選んだものだけ商品マスターに入る', async ({ page, request }) => {
  await page.goto('/settings/product-master'); await page.waitForLoadState('networkidle')
  const box = page.getByRole('region', { name: 'カタログからAIで取り込む' })
  const png = Buffer.from((await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1600; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 2400, 1600); x.fillStyle = '#351E28'; x.font = '80px sans-serif'; x.fillText('スタンド袋 ガゼット袋', 100, 200); return c.toDataURL('image/png') })).split(',')[1], 'base64')
  await box.getByLabel('カタログの画像・PDF').setInputFiles({ name: 'catalog.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  await expect(box.getByRole('alert')).toContainText('画像（PNG / JPEG）か PDF を選んでください')
  await box.getByLabel('カタログの画像・PDF').setInputFiles({ name: 'catalog-p1.png', mimeType: 'image/png', buffer: png })
  const categories = box.getByRole('list', { name: '分類の候補' })
  await expect(categories.getByRole('listitem')).toHaveCount(2) // 登録済みの「袋 › スタンド袋 › ジップ付きスタンド」と重複は出ない
  await expect(categories).toContainText('袋 › ガゼット袋'); await expect(categories).toContainText('カップ › 紙カップ › 二重断熱')
  await expect(box.getByRole('list', { name: '素材の候補' }).getByRole('listitem')).toHaveCount(1) // クラフト紙は登録済み
  await expect(box.getByRole('list', { name: '印刷の色数の候補' })).toContainText('特色2色')
  await expect(box.getByRole('list', { name: '付属品の候補' })).toContainText('窓')
  await shot(page, 'a1-catalog-candidates')
  const before = await state(request)
  expect(before.ai_requests[0].text).toContain('[image:image/jpeg]') // 画像は縮めて JPEG で渡している
  expect(before.product_catalog).toHaveLength(5) // 候補を出しただけでは何も登録しない
  await box.getByRole('checkbox', { name: '窓' }).uncheck()
  await box.getByRole('button', { name: '選んだ 4件を登録する' }).click()
  await expect(box.getByRole('list', { name: '分類の候補' })).toHaveCount(0)
  const s = await state(request)
  const names = (level: number) => s.product_catalog.filter((c: { level: number }) => c.level === level).map((c: { name: string }) => c.name).sort()
  expect(names(1)).toEqual(['カップ', 'パウチ', '袋']); expect(names(2)).toEqual(['ガゼット袋', 'スタンド袋', '平袋', '紙カップ']); expect(names(3)).toEqual(['ジップ付きスタンド', '二重断熱'])
  const gusset = s.product_catalog.find((c: { name: string }) => c.name === 'ガゼット袋')
  expect(gusset.parent_id).toBe('bag') // 既にある「袋」の下に入る
  const options = s.product_option_items.map((o: { kind: string; name: string }) => `${o.kind}:${o.name}`)
  expect(options).toContain('material:アルミ蒸着'); expect(options).toContain('print_colors:特色2色'); expect(options).not.toContain('accessory:窓')
  await expect(page.getByRole('region', { name: '種類・形状・ディテール' })).toContainText('カップ')
})
