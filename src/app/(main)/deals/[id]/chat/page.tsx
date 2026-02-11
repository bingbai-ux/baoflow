import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { SalesChatMessages } from './sales-chat-messages'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DealChatPage({ params }: Props) {
  const { id: dealId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get deal info
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      client:clients(company_name),
      specifications:deal_specifications(product_name)
    `)
    .eq('id', dealId)
    .single()

  if (!deal) {
    notFound()
  }

  // Get or create chat room
  let { data: room } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('deal_id', dealId)
    .eq('room_type', 'client_sales')
    .single()

  if (!room) {
    // Create chat room
    const { data: newRoom } = await supabase
      .from('chat_rooms')
      .insert({
        deal_id: dealId,
        room_type: 'client_sales',
      })
      .select()
      .single()

    room = newRoom
  }

  if (!room) {
    return <div>チャットルームを作成できませんでした</div>
  }

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
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })
    .limit(100)

  const spec = deal.specifications?.[0]
  const client = Array.isArray(deal.client) ? deal.client[0] : deal.client

  return (
    <div className="flex flex-col h-[calc(100vh-52px-40px)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link
          href={`/deals/${dealId}`}
          className="text-[#888] hover:text-[#0a0a0a]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
              クライアントチャット
            </h1>
            <span className="text-[11px] font-display tabular-nums text-[#888]">
              {deal.deal_code}
            </span>
          </div>
          <p className="text-[12px] text-[#888] font-body">
            {client?.company_name} - {spec?.product_name || deal.deal_name || '商品名未設定'}
          </p>
        </div>
      </div>

      {/* Chat Messages Component */}
      <SalesChatMessages
        roomId={room.id}
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
