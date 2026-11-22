// 選べるAIの一覧（画面とサーバーの両方で使う）。
export const AI_MODEL_CHOICES = [
  { id: 'claude-opus-5-5', label: '最上位（正確さ優先・遅め・高め）' },
  { id: 'claude-sonnet-5-5', label: '標準（速さと正確さの中間）' },
  { id: 'claude-haiku-5-5', label: '軽量（最も速い・安い）' },
] as const
export interface AiModels { draft: string; catalog: string }
