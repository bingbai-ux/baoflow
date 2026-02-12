'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type DesignStatus = 'draft' | 'submitted' | 'approved' | 'revision_requested'

/**
 * Upload a new design file
 */
export async function uploadDesignFile(
  dealId: string,
  fileUrl: string,
  fileName: string,
  fileType?: string
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get next version number
  const { data: existingFiles } = await supabase
    .from('deal_design_files')
    .select('version_number')
    .eq('deal_id', dealId)
    .order('version_number', { ascending: false })
    .limit(1)

  const nextVersion = existingFiles && existingFiles.length > 0
    ? existingFiles[0].version_number + 1
    : 1

  const { data, error } = await supabase
    .from('deal_design_files')
    .insert({
      deal_id: dealId,
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType || null,
      version_number: nextVersion,
      uploaded_by_user_id: user?.id || null,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/deals/${dealId}`)

  return { success: true, data }
}

/**
 * Submit design to client for review
 */
export async function submitDesignToClient(
  designId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_design_files')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', designId)
    .select('deal_id, version_number')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Post system message to client chat
  if (data) {
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('room_type', 'client_sales')
      .single()

    if (room) {
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        user_id: null,
        content_original: `デザインデータ（v${data.version_number}）をお送りしました。ご確認ください。`,
        is_system_message: true,
      })
    }

    revalidatePath(`/deals/${data.deal_id}`)
    revalidatePath(`/portal/orders/${data.deal_id}`)
  }

  return { success: true }
}

/**
 * Approve design (called by client)
 */
export async function approveDesign(
  designId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_design_files')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      is_final: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', designId)
    .select('deal_id, version_number')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Post system message to sales chat
  if (data) {
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('room_type', 'client_sales')
      .single()

    if (room) {
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        user_id: null,
        content_original: `デザインデータ（v${data.version_number}）が承認されました。`,
        is_system_message: true,
      })
    }

    revalidatePath(`/deals/${data.deal_id}`)
    revalidatePath(`/portal/orders/${data.deal_id}`)
  }

  return { success: true }
}

/**
 * Request design revision (called by client)
 */
export async function requestDesignRevision(
  designId: string,
  revisionNotes: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_design_files')
    .update({
      status: 'revision_requested',
      reviewed_at: new Date().toISOString(),
      reviewer_notes: revisionNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', designId)
    .select('deal_id, version_number')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Post system message to sales chat with feedback
  if (data) {
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('room_type', 'client_sales')
      .single()

    if (room) {
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        user_id: null,
        content_original: `デザインデータ（v${data.version_number}）の修正依頼がありました。\n修正内容: ${revisionNotes}`,
        is_system_message: true,
      })
    }

    revalidatePath(`/deals/${data.deal_id}`)
    revalidatePath(`/portal/orders/${data.deal_id}`)
  }

  return { success: true }
}

/**
 * Get design files for a deal
 */
export async function getDesignFilesForDeal(dealId: string): Promise<{
  data: Array<{
    id: string
    deal_id: string
    file_url: string
    file_name: string | null
    file_type: string | null
    version_number: number
    status: string | null
    is_final: boolean | null
    submitted_at: string | null
    reviewed_at: string | null
    reviewer_notes: string | null
    created_at: string
  }>
  error?: string
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_design_files')
    .select('*')
    .eq('deal_id', dealId)
    .order('version_number', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [] }
}
