import { NextResponse } from 'next/server'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from '@/lib/actions/deal-access'
import { askClaude, aiReady, AI_NOT_CONFIGURED, parseAiJson } from '@/lib/ai/claude'
import { tidyCandidates } from '@/lib/process/catalog-import'

// 商品マスター: カタログの画像・PDFをAIに読ませて、マスターに足す候補（種類・形状・ディテール・素材・印刷の色数・付属品）を返す。
// ここでは何も登録しない（候補を返すだけ）。登録は画面で選んでから別の処理で行う。

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const MAX_FILES = 4, MAX_CHARS = 4_200_000 // 送信できる合計の大きさ（文字数）。サーバーの受信上限 4.5MB に収める
const SYSTEM = `あなたは包装資材（袋・箱・カップなど）のカタログを読み取る係です。渡されたカタログから、商品マスターに登録する候補を抜き出し、次の形の JSON だけを返してください。説明文は不要です。
{"categories":[{"l1":"種類（例: 袋）","l2":"形状（例: スタンド袋）または null","l3":"ディテール（例: ジップ付き）または null"}],"materials":["素材名"],"print_colors":["印刷の色数（例: 1色、4色（フルカラー））"],"accessories":["付属品（例: ジップ、バルブ、窓）"]}
決まり: カタログに実際に書かれているものだけを挙げる。推測で足さない。日本語で、短い名詞にする（説明文にしない）。同じものを重ねない。価格・サイズ・数量・会社名は含めない。読み取れるものが無ければ、空の配列を返す。`
const json = (body: object, status = 200) => NextResponse.json(body, { status })

export async function POST(request: Request) {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return json({ error: accessError }, 403)
  if (!aiReady()) return json({ error: AI_NOT_CONFIGURED }, 503)
  let files: unknown
  try { files = (await request.json())?.files } catch { return json({ error: 'ファイルを読み込めませんでした' }, 400) }
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) return json({ error: `ファイルは1〜${MAX_FILES}件まで選んでください` }, 400)
  const blocks: ContentBlockParam[] = []
  let total = 0
  for (const f of files) {
    const m = typeof f === 'string' ? /^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(f) : null
    if (!m) return json({ error: '画像（PNG / JPEG）か PDF を選んでください' }, 400)
    total += m[2].length
    blocks.push(m[1] === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: m[2] } } : { type: 'image', source: { type: 'base64', media_type: m[1] as 'image/png' | 'image/jpeg', data: m[2] } })
  }
  if (total > MAX_CHARS) return json({ error: 'ファイルが大きすぎます（合計 3MB まで）。ページを分けるか、画像にしてお試しください。' }, 413)
  blocks.push({ type: 'text', text: 'このカタログから、商品マスターに登録する候補を JSON で返してください。' })
  const [catalog, options] = await Promise.all([supabase.from('product_catalog').select('id, level, parent_id, name'), supabase.from('product_option_items').select('kind, name')])
  if (catalog.error || options.error) return json({ error: '登録済みのマスターを読み込めませんでした' }, 500)
  try {
    const text = await askClaude({ system: SYSTEM, content: blocks, maxTokens: 4000 })
    return json({ candidates: tidyCandidates(parseAiJson(text), { catalog: catalog.data || [], options: options.data || [] }) })
  } catch (e) {
    return json({ error: e instanceof Error && /AI/.test(e.message) ? e.message : 'AIで読み取れませんでした。時間をおいてもう一度お試しください。' }, 502)
  }
}
