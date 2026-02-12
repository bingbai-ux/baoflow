'use server'

import Anthropic from '@anthropic-ai/sdk'
import type { ContentBlockParam, DocumentBlockParam, ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ParsedQuote {
  product_name?: string | null
  material?: string | null
  size_description?: string | null
  quantity?: number | null
  unit_price_usd?: number | null
  total_usd?: number | null
  moq?: number | null
  production_days?: number | null
  shipping_cost_usd?: number | null
  notes?: string | null
}

export async function checkApiKeyAvailable(): Promise<boolean> {
  return !!process.env.ANTHROPIC_API_KEY
}

const EXTRACTION_PROMPT = `以下のJSON形式で情報を抽出してください。見つからない項目はnullにしてください。JSONのみを返してください:
{"product_name":"商品名","material":"素材","size_description":"サイズ（例:W140×D80×H230mm）","quantity":数量,"unit_price_usd":単価USD,"total_usd":合計USD,"moq":最小ロット,"production_days":製造日数,"shipping_cost_usd":送料USD,"notes":"特記事項"}`

export async function parseFactoryDocument(
  formData: FormData
): Promise<{ success: boolean; data?: ParsedQuote; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      error: 'AI解析を利用するにはANTHROPIC_API_KEYの設定が必要です',
    }
  }

  const file = formData.get('file') as File
  if (!file) return { success: false, error: 'ファイルが選択されていません' }

  const fileName = file.name.toLowerCase()

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let content: ContentBlockParam[]

    // Excel/CSV → テキスト化
    if (
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.csv')
    ) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const workbook = XLSX.read(buffer)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const csvContent = XLSX.utils.sheet_to_csv(sheet)

      const textBlock: TextBlockParam = {
        type: 'text',
        text: `以下は中国の包装工場から受け取った見積もり書のCSVデータです。\nファイル名: ${file.name}\n\n${csvContent}\n\n${EXTRACTION_PROMPT}`,
      }
      content = [textBlock]
    } else if (fileName.endsWith('.pdf')) {
      // PDF → document type
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64Data = buffer.toString('base64')

      const docBlock: DocumentBlockParam = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      }
      const textBlock: TextBlockParam = {
        type: 'text',
        text: `このPDFは中国の包装工場から受け取った見積もり書です。${EXTRACTION_PROMPT}`,
      }
      content = [docBlock, textBlock]
    } else {
      // Images → image type
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64Data = buffer.toString('base64')

      // Determine media type
      let mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' = 'image/png'
      if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        mediaType = 'image/jpeg'
      } else if (fileName.endsWith('.webp')) {
        mediaType = 'image/webp'
      } else if (fileName.endsWith('.gif')) {
        mediaType = 'image/gif'
      }

      const imageBlock: ImageBlockParam = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      }
      const textBlock: TextBlockParam = {
        type: 'text',
        text: `この画像は中国の包装工場から受け取った見積もり書です。${EXTRACTION_PROMPT}`,
      }
      content = [imageBlock, textBlock]
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch)
      return { success: false, error: '解析結果をパースできませんでした' }

    const parsed: ParsedQuote = JSON.parse(jsonMatch[0])
    return { success: true, data: parsed }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: `AI解析エラー: ${message}` }
  }
}

export async function applyParsedQuote(
  dealId: string,
  data: ParsedQuote
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Update deal_specifications
  const { data: existingSpec } = await supabase
    .from('deal_specifications')
    .select('id')
    .eq('deal_id', dealId)
    .single()

  if (existingSpec) {
    // Update existing spec
    const { error: specError } = await supabase
      .from('deal_specifications')
      .update({
        product_name: data.product_name || undefined,
        material_category: data.material || undefined,
        size_notes: data.size_description || undefined,
        specification_memo: data.notes || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSpec.id)

    if (specError) {
      return { success: false, error: `仕様更新エラー: ${specError.message}` }
    }
  } else {
    // Create new spec
    const { error: specError } = await supabase
      .from('deal_specifications')
      .insert({
        deal_id: dealId,
        product_name: data.product_name || null,
        material_category: data.material || null,
        size_notes: data.size_description || null,
        specification_memo: data.notes || null,
      })

    if (specError) {
      return { success: false, error: `仕様作成エラー: ${specError.message}` }
    }
  }

  // Create draft quote if we have pricing info
  if (data.unit_price_usd || data.total_usd) {
    // Get next version number
    const { data: existingQuotes } = await supabase
      .from('deal_quotes')
      .select('version')
      .eq('deal_id', dealId)
      .order('version', { ascending: false })
      .limit(1)

    const version =
      existingQuotes && existingQuotes.length > 0
        ? existingQuotes[0].version + 1
        : 1

    const { error: quoteError } = await supabase.from('deal_quotes').insert({
      deal_id: dealId,
      version,
      quantity: data.quantity || null,
      factory_unit_price_usd: data.unit_price_usd || null,
      total_cost_usd: data.total_usd || null,
      moq: data.moq || null,
      status: 'drafting',
      source_type: 'excel_import',
    })

    if (quoteError) {
      return { success: false, error: `見積作成エラー: ${quoteError.message}` }
    }
  }

  // Update deal last_activity_at
  await supabase
    .from('deals')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', dealId)

  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/deals')

  return { success: true }
}
