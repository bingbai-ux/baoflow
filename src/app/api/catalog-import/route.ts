import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from '@/lib/actions/deal-access'
import { askClaude, aiReady, AI_NOT_CONFIGURED, loadAiModels, parseAiJson } from '@/lib/ai/claude'
import { CATALOG_BUCKET, CATALOG_MAX_BYTES, CATALOG_MAX_PAGES, CATALOG_PAGES_PER_READ, tidyCandidates } from '@/lib/process/catalog-import'

// 商品マスター: カタログの画像・PDFをAIに読ませて、マスターに足す候補（種類・形状・ディテール・素材・印刷の色数・付属品）を返す。
// 大きなファイルでも読めるよう、ファイルは先に保管場所（catalog-imports）へ置いてもらい、ここでは置き場所の名前だけ受け取る。
//   action 'inspect': 何ページあるかを返す
//   action 'read':    指定の範囲（PDF は10ページまで）をAIに読ませて候補を返す。画面側が範囲を変えて順番に呼ぶ
// ここでは何も登録しない（候補を返すだけ）。登録は画面で選んでから別の処理で行う。

export const dynamic = 'force-dynamic'
export const maxDuration = 300
const SYSTEM = `あなたは包装資材（袋・箱・カップなど）のカタログを読み取る係です。渡されたカタログから、商品マスターに登録する候補を抜き出し、次の形の JSON だけを返してください。説明文は不要です。
{"categories":[{"l1":"種類（例: 袋）","l2":"形状（例: スタンド袋）または null","l3":"ディテール（例: ジップ付き）または null"}],"materials":["素材名"],"print_colors":["印刷の色数（例: 1色、4色（フルカラー））"],"accessories":["付属品（例: ジップ、バルブ、窓）"]}
決まり: カタログに実際に書かれているものだけを挙げる。推測で足さない。日本語で、短い名詞にする（説明文にしない。中国語・英語のカタログは日本語に直す）。同じものを重ねない。価格・サイズ・数量・会社名は含めない。読み取れるものが無ければ、空の配列を返す。`
const json = (body: object, status = 200) => NextResponse.json(body, { status })
const PATH = /^[0-9a-f-]{36}_[A-Za-z0-9._-]{1,200}\.(pdf|png|jpe?g)$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return json({ error: accessError }, 403)
  if (!aiReady()) return json({ error: AI_NOT_CONFIGURED }, 503)
  let input: { action?: unknown; path?: unknown; from?: unknown; to?: unknown }
  try { input = await request.json() } catch { return json({ error: 'ファイルを読み込めませんでした' }, 400) }
  const path = typeof input?.path === 'string' ? input.path : ''
  if (!PATH.test(path) || !['inspect', 'read'].includes(String(input.action))) return json({ error: 'ファイルを確認してください' }, 400)
  const file = await supabase.storage.from(CATALOG_BUCKET).download(path)
  if (file.error || !file.data) return json({ error: 'ファイルを開けませんでした。もう一度選び直してください。' }, 404)
  const bytes = Buffer.from(await file.data.arrayBuffer())
  if (!bytes.length || bytes.length > CATALOG_MAX_BYTES) return json({ error: 'ファイルが大きすぎます（50MB まで）' }, 413)
  const isPdf = /\.pdf$/i.test(path)

  let pdf: PDFDocument | null = null
  if (isPdf) {
    try { pdf = await PDFDocument.load(bytes) } catch { return json({ error: 'この PDF は開けませんでした（パスワード付き、または壊れている可能性があります）' }, 422) }
    if (pdf.getPageCount() > CATALOG_MAX_PAGES) return json({ error: `ページが多すぎます（${CATALOG_MAX_PAGES}ページまで）` }, 413)
  }
  const pages = pdf ? pdf.getPageCount() : 1
  if (input.action === 'inspect') return json({ pages })

  const from = Number(input.from), to = Number(input.to)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > pages || to - from + 1 > CATALOG_PAGES_PER_READ) return json({ error: '読む範囲が正しくありません' }, 400)
  let block: ContentBlockParam
  if (pdf) {
    const part = await PDFDocument.create()
    for (const page of await part.copyPages(pdf, Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i))) part.addPage(page)
    block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(await part.save()).toString('base64') } }
  } else {
    block = { type: 'image', source: { type: 'base64', media_type: /\.png$/i.test(path) ? 'image/png' : 'image/jpeg', data: bytes.toString('base64') } }
  }
  const [catalog, options] = await Promise.all([supabase.from('product_catalog').select('id, level, parent_id, name'), supabase.from('product_option_items').select('kind, name')])
  if (catalog.error || options.error) return json({ error: '登録済みのマスターを読み込めませんでした' }, 500)
  try {
    const text = await askClaude({ system: SYSTEM, content: [block, { type: 'text', text: 'このカタログから、商品マスターに登録する候補を JSON で返してください。' }], maxTokens: 4000, model: (await loadAiModels(supabase)).catalog, timeoutMs: 240000 })
    return json({ candidates: tidyCandidates(parseAiJson(text), { catalog: catalog.data || [], options: options.data || [] }) })
  } catch (e) {
    return json({ error: e instanceof Error && /AI/.test(e.message) ? e.message : 'AIで読み取れませんでした。時間をおいてもう一度お試しください。' }, 502)
  }
}
