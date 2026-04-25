'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Trash2, Bell, BellOff, Check } from 'lucide-react'
import {
  type DealCommunication,
  type CommChannel,
  COMM_CHANNEL_LABELS,
} from '@/lib/types'
import {
  createCommunication,
  markCommRead,
  setCommFollowup,
  deleteCommunication,
} from '@/lib/actions/communications'
import { formatDate } from '@/lib/utils/format'

interface Props {
  dealId: string
  initial: DealCommunication[]
}

type ChannelFilter = 'all' | CommChannel | 'unread' | 'followup'

const CHANNELS: CommChannel[] = ['email', 'wechat', 'phone', 'memo', 'meeting']

export function DealCommunicationTab({ dealId, initial }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<ChannelFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [, startMutate] = useTransition()
  const [posting, startPost] = useTransition()

  const [channel, setChannel] = useState<CommChannel>('memo')
  const [authorRole, setAuthorRole] = useState<'staff' | 'client' | 'factory'>('staff')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [needsFollowup, setNeedsFollowup] = useState(false)
  const [followupDate, setFollowupDate] = useState('')

  const unreadCount = initial.filter((c) => !c.is_read).length
  const followupCount = initial.filter((c) => c.needs_followup).length

  const filtered = initial.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !c.is_read
    if (filter === 'followup') return c.needs_followup
    return c.channel === filter
  })

  const handlePost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!body.trim()) return
    const fd = new FormData(e.currentTarget)
    startPost(async () => {
      const r = await createCommunication(dealId, fd)
      if (r.error) {
        setError(r.error)
        return
      }
      setBody('')
      setSubject('')
      setNeedsFollowup(false)
      setFollowupDate('')
      router.refresh()
    })
  }

  const handleMarkRead = (id: string) => {
    startMutate(async () => {
      await markCommRead(id)
      router.refresh()
    })
  }
  const handleToggleFollowup = (c: DealCommunication) => {
    startMutate(async () => {
      await setCommFollowup(c.id, !c.needs_followup, c.followup_date)
      router.refresh()
    })
  }
  const handleDelete = (id: string) => {
    if (!confirm('この通信を削除しますか?')) return
    startMutate(async () => {
      await deleteCommunication(id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1">
        <Chip label="すべて" count={initial.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        {CHANNELS.map((c) => {
          const cnt = initial.filter((x) => x.channel === c).length
          if (cnt === 0) return null
          return (
            <Chip
              key={c}
              label={`${COMM_CHANNEL_LABELS[c].emoji} ${COMM_CHANNEL_LABELS[c].label}`}
              count={cnt}
              active={filter === c}
              onClick={() => setFilter(c)}
            />
          )
        })}
        {unreadCount > 0 && (
          <Chip label="未読" count={unreadCount} active={filter === 'unread'} onClick={() => setFilter('unread')} accent />
        )}
        {followupCount > 0 && (
          <Chip
            label="🟡 フォローアップ"
            count={followupCount}
            active={filter === 'followup'}
            onClick={() => setFilter('followup')}
            accent
          />
        )}
      </div>

      {/* List */}
      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="text-[12px] text-[#888] text-center py-6 border border-dashed border-[#e8e8e6] rounded-[10px]">
            通信がありません
          </li>
        ) : (
          filtered.map((c) => {
            const ch = COMM_CHANNEL_LABELS[c.channel]
            return (
              <li
                key={c.id}
                className={`border rounded-[10px] p-3 ${
                  c.is_read ? 'border-[#e8e8e6] bg-white' : 'border-[#22c55e] bg-[#f0fdf4]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    {!c.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />}
                    <span className="text-[10px] text-[#888]">{ch.emoji}</span>
                    <span className="text-[12px] font-body font-semibold text-[#0a0a0a] truncate">
                      {c.subject || c.body.slice(0, 40)}
                    </span>
                    {c.author_role && (
                      <span className="text-[9px] text-[#888] uppercase tracking-wider">{c.author_role}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#888] tabular-nums flex-shrink-0">
                    {formatDate(c.occurred_at)}
                  </span>
                </div>
                <p className="text-[12px] text-[#0a0a0a] whitespace-pre-line">{c.body}</p>
                {c.needs_followup && (
                  <p className="text-[10px] text-[#e5a32e] mt-1.5">
                    🟡 フォローアップ {c.followup_date && `予定 ${formatDate(c.followup_date)}`}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-[#f0f0ed]">
                  {!c.is_read && (
                    <button
                      onClick={() => handleMarkRead(c.id)}
                      className="text-[10px] text-[#555] border border-[#e8e8e6] rounded-[4px] px-2 py-0.5 inline-flex items-center gap-1 hover:bg-[#fafaf8]"
                    >
                      <Check className="w-2.5 h-2.5" /> 既読
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleFollowup(c)}
                    className={`text-[10px] border rounded-[4px] px-2 py-0.5 inline-flex items-center gap-1 ${
                      c.needs_followup
                        ? 'text-[#888] border-[#e8e8e6] hover:bg-[#fafaf8]'
                        : 'text-[#e5a32e] border-[#fde4b6] hover:bg-[#fffaf2]'
                    }`}
                  >
                    {c.needs_followup ? <BellOff className="w-2.5 h-2.5" /> : <Bell className="w-2.5 h-2.5" />}
                    {c.needs_followup ? 'フォロー解除' : 'フォロー'}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-[10px] text-[#ef4444] border border-[#fde2e2] rounded-[4px] px-2 py-0.5 inline-flex items-center gap-1 hover:bg-[#fef2f2]"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> 削除
                  </button>
                </div>
              </li>
            )
          })
        )}
      </ul>

      {/* Post form */}
      <form onSubmit={handlePost} className="bg-white rounded-[10px] border border-[#e8e8e6] p-3 space-y-2">
        {error && (
          <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[6px] px-2 py-1 text-[11px] text-[#b91c1c]">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[10px] text-[#555] mb-0.5">チャンネル</span>
            <select
              name="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as CommChannel)}
              className={inputClass}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{COMM_CHANNEL_LABELS[c].emoji} {COMM_CHANNEL_LABELS[c].label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] text-[#555] mb-0.5">発信元</span>
            <select
              name="author_role"
              value={authorRole}
              onChange={(e) => setAuthorRole(e.target.value as 'staff' | 'client' | 'factory')}
              className={inputClass}
            >
              <option value="staff">社内 (staff)</option>
              <option value="client">クライアント</option>
              <option value="factory">工場</option>
            </select>
          </label>
        </div>
        <input
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="件名 (任意)"
          className={inputClass}
        />
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="メッセージ本文..."
          className={`${inputClass} resize-y`}
          required
        />
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-[#555]">
            <input
              type="checkbox"
              name="needs_followup"
              checked={needsFollowup}
              onChange={(e) => setNeedsFollowup(e.target.checked)}
              className="w-3 h-3"
            />
            フォローアップ予定
          </label>
          {needsFollowup && (
            <input
              type="date"
              name="followup_date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              className={`${inputClass} w-auto`}
            />
          )}
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="ml-auto bg-[#0a0a0a] text-white rounded-[6px] px-3 py-1.5 text-[11px] inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            {posting ? '投稿中...' : '投稿'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputClass =
  'w-full px-2 py-1.5 text-[12px] font-body bg-white border border-[#e8e8e6] rounded-[6px] focus:outline-none focus:border-[#0a0a0a]'

function Chip({
  label,
  count,
  active,
  onClick,
  accent,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body rounded-full transition-colors ${
        active
          ? 'bg-[#0a0a0a] text-white'
          : accent
            ? 'bg-[#fffaf2] text-[#e5a32e] border border-[#fde4b6]'
            : 'bg-white text-[#555] border border-[#e8e8e6] hover:bg-[#fafaf8]'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}
