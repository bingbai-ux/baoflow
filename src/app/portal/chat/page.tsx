import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PortalChatListPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get client_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return (
      <div className="text-center py-10">
        <p className="text-[#888] font-body">クライアント情報が設定されていません。</p>
      </div>
    )
  }

  // Get chat rooms with deal info
  const { data: rooms } = await supabase
    .from('chat_rooms')
    .select(`
      id,
      room_type,
      created_at,
      deal:deals!inner(
        id,
        deal_code,
        deal_name,
        client_id,
        specifications:deal_specifications(product_name)
      )
    `)
    .eq('room_type', 'client_sales')
    .eq('deal.client_id', profile.client_id)
    .order('updated_at', { ascending: false })

  // Get last message for each room
  const roomsWithMessages = await Promise.all(
    (rooms || []).map(async (room) => {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('content_original, created_at, user:profiles(display_name, role)')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1)

      return {
        ...room,
        lastMessage: messages?.[0] || null,
      }
    })
  )

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
        Chat
      </h1>

      {/* Chat Rooms List */}
      {roomsWithMessages && roomsWithMessages.length > 0 ? (
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] divide-y divide-[rgba(0,0,0,0.06)]">
          {roomsWithMessages.map((room) => {
            const dealData = room.deal
            const deal = Array.isArray(dealData) ? dealData[0] : dealData
            const spec = deal?.specifications?.[0]
            const lastMessage = room.lastMessage

            return (
              <Link
                key={room.id}
                href={`/portal/chat/${room.id}`}
                className="flex items-center justify-between p-4 hover:bg-[#fcfcfb] transition-colors no-underline"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-display tabular-nums text-[#888]">
                      {deal?.deal_code}
                    </span>
                  </div>
                  <p className="text-[13px] font-body text-[#0a0a0a] truncate">
                    {spec?.product_name || deal?.deal_name || '案件チャット'}
                  </p>
                  {lastMessage && (
                    <p className="text-[11px] text-[#888] font-body truncate mt-1">
                      {lastMessage.content_original}
                    </p>
                  )}
                </div>
                {lastMessage && (
                  <span className="text-[10px] text-[#bbb] font-body ml-4 whitespace-nowrap">
                    {new Date(lastMessage.created_at).toLocaleDateString('ja-JP')}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#888] font-body mb-4">
            チャットルームはありません
          </p>
          <p className="text-[12px] text-[#bbb] font-body">
            見積もり依頼を作成すると、自動的にチャットルームが作成されます。
          </p>
        </div>
      )}
    </div>
  )
}
