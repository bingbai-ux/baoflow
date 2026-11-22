import Anthropic from '@anthropic-ai/sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'

// AI（Claude API）の呼び出しを1か所にまとめる。鍵が無いときは理由の分かる例外を投げる（黙って別の動きをしない）。
// 用途でAIを使い分ける（設定で変えられる。指定が無いときは下の既定）:
// - 返信の下書き: 速さ優先の標準のAI（ANTHROPIC_MODEL_DRAFT。無ければ ANTHROPIC_MODEL）
// - カタログの読み取り: 正確さ優先の最上位のAI（ANTHROPIC_MODEL_CATALOG）

export const AI_MODEL_DRAFT = process.env.ANTHROPIC_MODEL_DRAFT || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
export const AI_MODEL_CATALOG = process.env.ANTHROPIC_MODEL_CATALOG || 'claude-opus-5-5'
export const AI_NOT_CONFIGURED = 'AIの設定（ANTHROPIC_API_KEY）がありません。管理者に連絡してください。'
export const aiReady = () => !!process.env.ANTHROPIC_API_KEY

export async function askClaude(input: { system: string; content: string | ContentBlockParam[]; maxTokens: number; model?: string; timeoutMs?: number }): Promise<string> {
  if (!aiReady()) throw new Error(AI_NOT_CONFIGURED)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: input.timeoutMs ?? 60000 })
  const res = await client.messages.create({ model: input.model || AI_MODEL_DRAFT, max_tokens: input.maxTokens, system: input.system, messages: [{ role: 'user', content: input.content }] })
  const text = res.content.map(block => block.type === 'text' ? block.text : '').join('').trim()
  if (!text) throw new Error('AIから内容が返りませんでした。もう一度お試しください。')
  if (res.stop_reason === 'max_tokens') throw new Error('AIの出力が途中で切れました。対象を減らしてもう一度お試しください。')
  return text
}

/** AIの返答から JSON を取り出す（前後に説明文や ``` が付いていても読む）。読めなければ例外。 */
export function parseAiJson<T>(text: string): T {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AIの返答を読み取れませんでした。もう一度お試しください。')
  try { return JSON.parse(text.slice(start, end + 1)) as T } catch { throw new Error('AIの返答を読み取れませんでした。もう一度お試しください。') }
}
