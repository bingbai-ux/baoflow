'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ChatRoom {
  id: string
  deal_id: string | null
  room_type: 'client_sales' | 'sales_factory' | 'internal'
  created_at: string
}

export interface ChatMessage {
  id: string
  room_id: string
  user_id: string | null
  content_original: string | null
  content_translated: string | null
  original_language: string | null
  source: string | null
  is_system_message: boolean
  is_template_message: boolean
  is_ai_generated: boolean
  attachments: string[] | null
  created_at: string
  user?: {
    display_name: string | null
    role: string
  }
}

// Create a chat room
export async function createChatRoom(
  dealId: string,
  roomType: 'client_sales' | 'sales_factory' | 'internal' = 'client_sales'
): Promise<{ data: ChatRoom | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  // Check if room already exists
  const { data: existingRoom } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('deal_id', dealId)
    .eq('room_type', roomType)
    .single()

  if (existingRoom) {
    return { data: existingRoom as ChatRoom, error: null }
  }

  const { data, error } = await supabase
    .from('chat_rooms')
    .insert({
      deal_id: dealId,
      room_type: roomType,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: data as ChatRoom, error: null }
}

// Send a message
export async function sendMessage(
  roomId: string,
  content: string,
  attachments?: string[]
): Promise<{ data: ChatMessage | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      room_id: roomId,
      user_id: user.id,
      content_original: content,
      original_language: 'ja',
      source: 'app',
      is_system_message: false,
      is_template_message: false,
      is_ai_generated: false,
      attachments: attachments || null,
    })
    .select(`
      *,
      user:profiles(display_name, role)
    `)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  // Update deal last_activity_at
  const { data: room } = await supabase
    .from('chat_rooms')
    .select('deal_id')
    .eq('id', roomId)
    .single()

  if (room?.deal_id) {
    await supabase
      .from('deals')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', room.deal_id)
  }

  revalidatePath(`/portal/chat/${roomId}`)
  revalidatePath(`/deals`)

  return { data: data as ChatMessage, error: null }
}

// Get messages for a room
export async function getMessages(
  roomId: string,
  limit: number = 100
): Promise<{ data: ChatMessage[]; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      *,
      user:profiles(display_name, role)
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data || []) as ChatMessage[], error: null }
}

// Get chat rooms for a client
export async function getChatRoomsForClient(
  clientId: string
): Promise<{ data: (ChatRoom & { deal?: { deal_code: string; deal_name: string | null } })[]; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: [], error: 'Unauthorized' }
  }

  // Get rooms through deals that belong to this client
  const { data, error } = await supabase
    .from('chat_rooms')
    .select(`
      *,
      deal:deals!inner(
        id,
        deal_code,
        deal_name,
        client_id
      )
    `)
    .eq('room_type', 'client_sales')
    .eq('deal.client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return {
    data: (data || []).map((room) => ({
      ...room,
      deal: room.deal ? {
        deal_code: room.deal.deal_code,
        deal_name: room.deal.deal_name,
      } : undefined,
    })),
    error: null,
  }
}

// Get chat rooms for a deal
export async function getChatRoomsForDeal(
  dealId: string
): Promise<{ data: ChatRoom[]; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data || []) as ChatRoom[], error: null }
}

// Get room with access check
export async function getChatRoom(
  roomId: string
): Promise<{ data: ChatRoom & { deal?: { id: string; deal_code: string; deal_name: string | null; client_id: string } } | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('chat_rooms')
    .select(`
      *,
      deal:deals(
        id,
        deal_code,
        deal_name,
        client_id
      )
    `)
    .eq('id', roomId)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, client_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { data: null, error: 'Profile not found' }
  }

  // Clients can only access rooms for their own deals
  if (profile.role === 'client') {
    if (data.deal?.client_id !== profile.client_id) {
      return { data: null, error: 'Access denied' }
    }
  }

  return { data: data as ChatRoom & { deal?: { id: string; deal_code: string; deal_name: string | null; client_id: string } }, error: null }
}
