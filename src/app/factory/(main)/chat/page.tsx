import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function FactoryChatListPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_id')
    .eq('id', user.id)
    .single()

  if (!profile?.factory_id) {
    return (
      <div className="text-center py-10">
        <p className="text-[#888] font-body">工場情報が設定されていません。</p>
      </div>
    )
  }

  // Get deals for this factory with chat rooms
  const { data: assignments } = await supabase
    .from('deal_factory_assignments')
    .select(`
      id,
      deal:deals(
        id,
        deal_code,
        deal_name,
        specifications:deal_specifications(product_name)
      )
    `)
    .eq('factory_id', profile.factory_id)
    .in('status', ['selected', 'responded'])
    .order('created_at', { ascending: false })

  // Get chat rooms for these deals
  const dealIds = assignments?.map((a) => {
    const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal
    return deal?.id
  }).filter(Boolean) || []

  const { data: rooms } = await supabase
    .from('chat_rooms')
    .select(`
      id,
      deal_id,
      room_type,
      updated_at
    `)
    .in('deal_id', dealIds)
    .eq('room_type', 'sales_factory')
    .order('updated_at', { ascending: false })

  // Get last message for each room
  const roomsWithMessages = await Promise.all(
    (rooms || []).map(async (room) => {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('content_original, created_at')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const assignment = assignments?.find((a) => {
        const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal
        return deal?.id === room.deal_id
      })
      const deal = assignment?.deal
      const dealData = Array.isArray(deal) ? deal[0] : deal

      return {
        ...room,
        deal: dealData,
        lastMessage: messages?.[0] || null,
      }
    })
  )

  return (
    <div className="space-y-5">
      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
        チャット
      </h1>

      {roomsWithMessages && roomsWithMessages.length > 0 ? (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] divide-y divide-[rgba(0,0,0,0.06)]">
          {roomsWithMessages.map((room) => {
            const spec = room.deal?.specifications?.[0]
            return (
              <Link
                key={room.id}
                href={`/factory/chat/${room.id}`}
                className="flex items-center justify-between p-4 hover:bg-[#fcfcfb] transition-colors no-underline"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-display tabular-nums text-[#888]">
                      {room.deal?.deal_code}
                    </span>
                  </div>
                  <p className="text-[13px] font-body text-[#0a0a0a] truncate">
                    {spec?.product_name || room.deal?.deal_name || '案件チャット'}
                  </p>
                  {room.lastMessage && (
                    <p className="text-[11px] text-[#888] font-body truncate mt-1">
                      {room.lastMessage.content_original}
                    </p>
                  )}
                </div>
                {room.lastMessage && (
                  <span className="text-[10px] text-[#bbb] font-body ml-4 whitespace-nowrap">
                    {new Date(room.lastMessage.created_at).toLocaleDateString('ja-JP')}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#888] font-body">
            チャットルームはありません
          </p>
        </div>
      )}
    </div>
  )
}
