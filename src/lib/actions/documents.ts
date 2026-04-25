'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type DocumentType = 'quotation' | 'invoice' | 'delivery_note'

export interface DocumentRow {
  id: string
  deal_id: string
  document_type: DocumentType
  document_number: string | null
  version: number | null
  metadata: Record<string, unknown> | null
  issued_at: string
  created_at: string
}

const PREFIX_BY_TYPE: Record<DocumentType, string> = {
  quotation: 'QUO',
  invoice: 'INV',
  delivery_note: 'DLV',
}

async function nextDocumentNumber(supabase: Awaited<ReturnType<typeof createClient>>, type: DocumentType): Promise<string> {
  const prefix = PREFIX_BY_TYPE[type]
  const ym = new Date().toISOString().slice(0, 7).replace('-', '') // YYYYMM
  const startsWith = `${prefix}-${ym}-`

  const { data } = await supabase
    .from('documents')
    .select('document_number')
    .eq('document_type', type)
    .like('document_number', `${startsWith}%`)
    .order('document_number', { ascending: false })
    .limit(1)

  let next = 1
  if (data && data.length > 0 && data[0].document_number) {
    const tail = data[0].document_number.split('-').pop()
    const n = Number(tail)
    if (Number.isFinite(n)) next = n + 1
  }
  return `${startsWith}${String(next).padStart(3, '0')}`
}

export async function issueDocument(input: {
  deal_id: string
  document_type: DocumentType
  metadata?: Record<string, unknown>
}): Promise<{ data: DocumentRow | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const number = await nextDocumentNumber(supabase, input.document_type)

  const { data, error } = await supabase
    .from('documents')
    .insert({
      deal_id: input.deal_id,
      document_type: input.document_type,
      document_number: number,
      version: 1,
      metadata: input.metadata || null,
      issued_at: new Date().toISOString(),
      issued_by_user_id: user.id,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath(`/deals/${input.deal_id}`)
  revalidatePath(`/deals/${input.deal_id}/documents`)
  return { data: data as DocumentRow, error: null }
}

export async function listDocumentsForDeal(dealId: string): Promise<DocumentRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('id, deal_id, document_type, document_number, version, metadata, issued_at, created_at')
    .eq('deal_id', dealId)
    .order('issued_at', { ascending: false })
  return (data || []) as DocumentRow[]
}

export async function previewNextNumber(type: DocumentType): Promise<string> {
  const supabase = await createClient()
  return nextDocumentNumber(supabase, type)
}
