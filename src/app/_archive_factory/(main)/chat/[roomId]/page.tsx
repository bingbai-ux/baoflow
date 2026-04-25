import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { FactoryChatMessages } from './factory-chat-messages'

interface Props {
  params: Promise<{ roomId: string }>
}

export default async function FactoryChatRoomPage({ params }: Props) {
  const { roomId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/factory/login')
  }

  // Get factory_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_id')
    .eq('id', user.id)
    .single()

  if (!profile?.factory_id) {
    redirect('/factory')
  }

  // Get room with deal info
  const { data: room } = await supabase
    .from('chat_rooms')
    .select(`
      id,
      room_type,
      deal_id,
      deal:deals(
        id,
        deal_code,
        deal_name,
        specifications:deal_specifications(product_name)
      )
    `)
    .eq('id', roomId)
    .eq('room_type', 'sales_factory')
    .single()

  if (!room) {
    notFound()
  }

  // Verify factory has access to this deal
  const { data: assignment } = await supabase
    .from('deal_factory_assignments')
    .select('id')
    .eq('deal_id', room.deal_id)
    .eq('factory_id', profile.factory_id)
    .single()

  if (!assignment) {
    notFound()
  }

  const deal = Array.isArray(room.deal) ? room.deal[0] : room.deal
  const spec = deal?.specifications?.[0]

  // Get initial messages
  const { data: messages } = await supabase
    .from('chat_messages')
    .select(`
      id,
      content_original,
      created_at,
      user_id,
      is_system_message,
      attachments,
      user:profiles(display_name, role)
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(100)

  return (
    <div className="flex flex-col h-[calc(100vh-52px-40px)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link
          href="/factory/chat"
          className="text-[#888] hover:text-[#0a0a0a]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            {spec?.product_name || deal?.deal_name || 'チャット'}
          </h1>
          <p className="text-[11px] font-display tabular-nums text-[#888]">
            {deal?.deal_code}
          </p>
        </div>
      </div>

      {/* Chat Messages Component */}
      <FactoryChatMessages
        roomId={roomId}
        currentUserId={user.id}
        initialMessages={(messages || []).map((m) => ({
          id: m.id,
          content_original: m.content_original,
          created_at: m.created_at,
          user_id: m.user_id,
          is_system_message: m.is_system_message,
          attachments: m.attachments,
          user: Array.isArray(m.user) ? m.user[0] : m.user,
        }))}
      />
    </div>
  )
}
