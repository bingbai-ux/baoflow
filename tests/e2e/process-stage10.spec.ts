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
  expect(before.ai_requests[0].model).toBe('claude-opus-5-5') // カタログの読み取りは最上位のAI
  expect(before.storage_objects.filter((x: string) => x.startsWith('catalog-imports/'))).toEqual([]) // 読み終わったら、置いたファイルは消す
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

test('カタログのAI取込: 大きなPDFは10ページずつ読み、進み具合を出す。途中で失敗したら、そこまでの候補を残して知らせる', async ({ page, request }) => {
  await page.goto('/settings/product-master'); await page.waitForLoadState('networkidle')
  const box = page.getByRole('region', { name: 'カタログからAIで取り込む' })
  // 代役の保管場所は、置かれた PDF の代わりに23ページの見本を返す（→ 1〜10 / 11〜20 / 21〜23 の3回に分けて読む）
  await box.getByLabel('カタログの画像・PDF').setInputFiles({ name: '工場カタログ 2026.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6 * 1024 * 1024, 1) }) // これまで読めなかった 6MB
  await expect(box.getByRole('list', { name: '分類の候補' }).getByRole('listitem')).toHaveCount(2)
  const s = await state(request)
  expect(s.ai_requests).toHaveLength(3)
  expect(s.ai_requests.every((r: { text: string; model: string }) => r.text.includes('[document:application/pdf]') && r.model === 'claude-opus-5-5')).toBe(true)
  expect(s.storage_objects.filter((x: string) => x.startsWith('catalog-imports/'))).toEqual([])
  await shot(page, 'a2-catalog-pdf')

  await request.post(fixture + '/__ai_fail', { data: { fail: true } })
  await box.getByLabel('カタログの画像・PDF').setInputFiles({ name: 'b.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
  await expect(box.getByRole('alert')).toContainText('b.pdf の 1〜10ページ')
  expect((await state(request)).storage_objects.filter((x: string) => x.startsWith('catalog-imports/'))).toEqual([]) // 失敗しても置いたファイルは消す
})

test('トーク欄: 工場あてもメールで送れる形になり（宛先は見積をもらった工場）、WeChat 用に中国語の部分だけコピーできる', async ({ page, request, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const f1 = 'ffffffff-0000-4000-8000-0000000000f1', f2 = 'ffffffff-0000-4000-8000-0000000000f2'
  await post(request, 'factories', { id: f1, factory_name: '東莞パック', contact_email: 'dg@example.test', wechat: 'dg-pack' })
  await post(request, 'factories', { id: f2, factory_name: '義烏プリント', contact_email: null, wechat: null })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-010', deal_name: '定番の袋', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'us', sales_user_id: userId, process_stage: 3, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_quotes', { id: 'aaaaaaaa-0000-4000-8000-0000000010a1', deal_id: deal, factory_id: f1, quantity: 1000, version: 1, status: 'draft' })
  await post(request, 'deal_quotes', { id: 'aaaaaaaa-0000-4000-8000-0000000010a2', deal_id: deal, factory_id: f2, quantity: 1000, version: 1, status: 'draft' })
  await page.goto(`/deals/${deal}`); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '会話・連絡記録を開く', exact: true }).click()
  await talk(page).getByRole('button', { name: '工場', exact: true }).click()
  await expect(talk(page).getByLabel('手段')).toHaveValue('email') // メールアドレスのある工場がいるので、メールのまま
  await expect(talk(page)).toContainText('宛先: 東莞パック <dg@example.test>（中国語の部分だけ送ります）')
  await expect(talk(page)).toContainText('返信の自動取り込みは未設定です')
  await talk(page).getByLabel('送り先の工場').selectOption(f2)
  await expect(talk(page)).toContainText('義烏プリント のメールアドレスが未登録')
  await expect(talk(page).getByRole('button', { name: 'メールで送る' })).toBeDisabled()
  // AIの下書き（中国語 + 日本語訳）→ WeChat に貼る用に中国語の部分だけコピー
  await talk(page).getByRole('button', { name: '工場あての下書きをAIでつくる' }).click()
  await expect(talk(page).getByLabel('本文')).toHaveValue(/日本語訳/)
  await talk(page).getByLabel('手段').selectOption('wechat')
  await talk(page).getByRole('button', { name: '中国語の部分をコピー' }).click()
  await expect(talk(page).getByRole('button', { name: 'コピーしました' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('您好，样品已收到。')
  await shot(page, 'a3-talk-factory')
  expect((await state(request)).deal_communications || []).toHaveLength(0) // 送っても記録してもいない
})

test('工場の返信ページ: リンクをつくって渡す → 工場がログインなしで返事と写真を送る → トーク欄と案件のファイルに入る', async ({ page, request, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const f1 = 'ffffffff-0000-4000-8000-0000000000f1'
  await post(request, 'factories', { id: f1, factory_name: '東莞パック', contact_email: null, wechat: 'dg-pack' })
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-010', deal_name: '定番の袋', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'factory', sales_user_id: userId, process_stage: 7, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await post(request, 'deal_quotes', { id: 'aaaaaaaa-0000-4000-8000-0000000010a1', deal_id: deal, factory_id: f1, quantity: 1000, version: 1, status: 'draft' })
  await page.goto(`/deals/${deal}`); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '会話・連絡記録を開く', exact: true }).click()
  await talk(page).getByRole('button', { name: '工場', exact: true }).click()
  await talk(page).getByRole('button', { name: '返信ページのリンクをコピー' }).click()
  await expect(talk(page).getByRole('status')).toContainText('コピーしました')
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3100\/external\/talk\/[0-9a-f]{64}$/)
  await talk(page).getByRole('button', { name: '返信ページのリンクをコピー' }).click() // もう一度押しても同じリンク
  await expect.poll(async () => (await state(request)).talk_links.length).toBe(1)

  // 工場側（ログインしていない別のブラウザ・スマホ幅）
  const outside = await browser.newContext({ viewport: { width: 390, height: 800 } })
  await outside.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const fp = await outside.newPage()
  await fp.goto(url)
  await expect(fp.getByRole('heading', { name: '给 (bao) 的回复' })).toBeVisible()
  await expect(fp.locator('body')).toContainText('東莞パック ／ 订单编号 PF-TEST-010')
  await expect(fp.locator('body')).not.toContainText('検証用カフェ') // 顧客名は出さない
  expect((await state(request)).deal_communications || []).toHaveLength(0) // 開いただけでは何も記録しない
  await expect(fp.getByRole('button', { name: /发送/ })).toBeDisabled()
  await fp.getByLabel('文件（ファイル）').setInputFiles({ name: 'a.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })
  await fp.getByLabel(/内容/).fill('样品已完成，请看照片。')
  await fp.getByRole('button', { name: /发送/ }).click()
  await expect(fp.locator('p[role=alert]')).toContainText('仅支持图片、视频、PDF') // 種類の違うファイルは受けない
  await fp.getByRole('button', { name: /删除/ }).click()
  await fp.getByLabel('文件（ファイル）').setInputFiles({ name: '样品 1.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('jpg') })
  await fp.getByRole('button', { name: /发送/ }).click()
  await expect(fp.locator('p[role=status]')).toContainText('已发送')
  expect(await fp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  if (shots) await fp.screenshot({ path: `${shots}/a4-factory-reply-page.png`, fullPage: true })
  await expect(fp.goto(url.slice(0, -4) + '0000').then(() => fp.getByRole('heading', { name: '找不到此页面' }).isVisible())).resolves.toBe(true)
  await outside.close()

  const s = await state(request)
  expect(s.deal_communications.map((c: { author_role: string; channel: string; body: string }) => [c.author_role, c.channel, c.body])).toEqual([['factory', 'link', '样品已完成，请看照片。\n\n添付: 样品 1.jpg']])
  expect(s.deal_design_files.map((f: { category: string; storage_path: string }) => [f.category, f.storage_path.startsWith(deal + '/')])).toEqual([['talk_link', true]])
  expect(s.deals.find((d: { id: string }) => d.id === deal).waiting_on).toBe('us')
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '会話・連絡記録を開く', exact: true }).click()
  await expect(thread(page)).toContainText('工場 ・ 返信ページ'); await expect(thread(page)).toContainText('样品已完成')
})

test('設定 > AIの使い分け: 用途ごとにAIを選んで保存すると、下書きがそのAIで作られる', async ({ page, request }) => {
  await page.goto('/settings'); await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: /AIの使い分け/ }).click()
  await page.waitForURL('**/settings/ai'); await page.waitForLoadState('networkidle')
  const box = page.getByRole('region', { name: 'AIの使い分け' })
  await expect(box.getByLabel(/返信の下書き/)).toHaveValue('claude-sonnet-5-5'); await expect(box.getByLabel(/カタログの読み取り/)).toHaveValue('claude-opus-5-5')
  await expect(box.getByRole('button', { name: 'この内容で保存する' })).toBeDisabled()
  await box.getByLabel(/返信の下書き/).selectOption('claude-opus-5-5')
  await box.getByRole('button', { name: 'この内容で保存する' }).click()
  await expect.poll(async () => (await state(request)).ai_settings[0].draft_model).toBe('claude-opus-5-5')
  await shot(page, 'a5-ai-settings')
  await post(request, 'deals', { id: deal, deal_code: 'PF-TEST-010', deal_name: '定番の袋', client_id: clientId, client_name_text: '検証用カフェ', simple_status: 'quoting', waiting_on: 'us', sales_user_id: userId, process_stage: 3, tags: [], desired_delivery_date: null, last_activity_at: '2026-11-01T00:00:00Z' })
  await page.goto(`/deals/${deal}`); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '会話・連絡記録を開く', exact: true }).click()
  await talk(page).getByRole('button', { name: '顧客あての下書きをAIでつくる' }).click()
  await expect(talk(page).getByLabel('本文')).toHaveValue(/確認のうえご連絡します/)
  expect((await state(request)).ai_requests[0].model).toBe('claude-opus-5-5')
})
