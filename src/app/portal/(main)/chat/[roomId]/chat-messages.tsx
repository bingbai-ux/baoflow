'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/actions/chat'

interface Message {
  id: string
  content_original: string | null
  created_at: string
  user_id: string | null
  is_system_message: boolean
  attachments: string[] | null
  user?: {
    display_name: string | null
    role: string
  } | null
}

interface ChatMessagesProps {
  roomId: string
  currentUserId: string
  initialMessages: Message[]
}

export function ChatMessages({ roomId, currentUserId, initialMessages }: ChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          // Fetch the full message with user info
          const { data } = await supabase
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
            .eq('id', payload.new.id)
            .single()

          if (data) {
            const normalizedData = {
              ...data,
              user: Array.isArray(data.user) ? data.user[0] : data.user,
            }
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === data.id)) {
                return prev
              }
              return [...prev, normalizedData as Message]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const content = newMessage.trim()
    setNewMessage('')

    const result = await sendMessage(roomId, content)

    if (result.error) {
      setNewMessage(content) // Restore message on error
      console.error('Failed to send message:', result.error)
    }

    setSending(false)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let currentDate = ''

  messages.forEach((message) => {
    const messageDate = new Date(message.created_at).toDateString()
    if (messageDate !== currentDate) {
      currentDate = messageDate
      groupedMessages.push({
        date: message.created_at,
        messages: [message],
      })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message)
    }
  })

  return (
    <>
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-4">
        {groupedMessages.length > 0 ? (
          <div className="space-y-4">
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="text-[10px] text-[#bbb] font-body bg-[#f2f2f0] px-2 py-1 rounded">
                    {formatDate(group.date)}
                  </span>
                </div>

                {/* Messages */}
                <div className="space-y-2">
                  {group.messages.map((message) => {
                    const isOwn = message.user_id === currentUserId
                    const isSystem = message.is_system_message

                    if (isSystem) {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <span className="text-[10px] text-[#888] font-body bg-[#f2f2f0] px-3 py-1 rounded-full">
                            {message.content_original}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] ${
                            isOwn ? 'order-2' : 'order-1'
                          }`}
                        >
                          {/* Sender Name */}
                          {!isOwn && message.user?.display_name && (
                            <p className="text-[10px] text-[#888] font-body mb-1 ml-3">
                              {message.user.display_name}
                            </p>
                          )}

                          {/* Message Bubble */}
                          <div
                            className={`px-4 py-2 rounded-[16px] ${
                              isOwn
                                ? 'bg-[#0a0a0a] text-white'
                                : 'bg-[#f2f2f0] text-[#0a0a0a]'
                            }`}
                          >
                            <p className="text-[13px] font-body whitespace-pre-wrap break-words">
                              {message.content_original}
                            </p>

                            {/* Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {message.attachments.map((url, i) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-[11px] underline ${
                                      isOwn ? 'text-white/80' : 'text-[#555]'
                                    }`}
                                  >
                                    添付ファイル {i + 1}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Time */}
                          <p
                            className={`text-[9px] text-[#bbb] font-body mt-1 ${
                              isOwn ? 'text-right mr-3' : 'ml-3'
                            }`}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-[#888] font-body">
              メッセージはまだありません
            </p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] px-4 py-3 text-[13px] font-body text-[#0a0a0a] outline-none focus:border-[#e8e8e6]"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="bg-[#0a0a0a] text-white rounded-[12px] px-5 py-3 text-[13px] font-body font-medium disabled:opacity-50"
        >
          {sending ? '...' : '送信'}
        </button>
      </form>
    </>
  )
}
