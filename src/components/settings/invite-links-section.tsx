'use client'

// Sprint 11: 設定画面の「招待リンク」管理。
// クライアント/工場が増えたら、ここでリンクを生成して WeChat/メールで送るだけで
// 先方が自分でフォーム記入 → マスターに自動登録される。
// 発行済みリンクの再コピー・無効化・提出状況の確認もここでできる。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, X } from 'lucide-react'
import {
  createClientInvitation,
  createFactoryInvitation,
  createPartnerInvitation,
  cancelExternalForm,
} from '@/lib/actions/external-forms'
import type { ExternalFormRow } from '@/lib/actions/external-forms-types'
import { useUi } from '@/components/ui/ui-store'
import { formatDate } from '@/lib/utils/format'

interface Props {
  forms: ExternalFormRow[]
}

type RowState = 'pending' | 'submitted' | 'expired' | 'cancelled'

function rowState(f: ExternalFormRow): RowState {
  if (f.status === 'submitted') return 'submitted'
  if (f.status === 'cancelled' || f.cancelled_at) return 'cancelled'
  if (f.expires_at && new Date(f.expires_at) < new Date()) return 'expired'
  return 'pending'
}

const STATE_BADGE: Record<RowState, { label: string; cls: string }> = {
  pending: { label: '受付中', cls: 'bg-[#D7EFFF] text-[#33566F]' },
  submitted: { label: '登録済み', cls: 'bg-[#AEB8A0] text-[#4C5544]' },
  expired: { label: '期限切れ', cls: 'bg-[#FFD8C2] text-[#B03616]' },
  cancelled: { label: '無効化', cls: 'bg-[#EFEFEA] border border-[#E2E1DA] text-[#84787D]' },
}

const TYPE_LABEL: Record<string, string> = {
  client_self_registration: 'クライアント',
  factory_self_registration: '工場',
  shipping_self_registration: '発送業者',
  logistics_self_registration: 'ロジ会社',
}

type InviteKind = 'client' | 'factory' | 'shipping' | 'logistics'

const GENERATE_BUTTONS: Array<{ kind: InviteKind; label: string }> = [
  { kind: 'client', label: '+ クライアント' },
  { kind: 'factory', label: '+ 工場' },
  { kind: 'shipping', label: '+ 発送業者' },
  { kind: 'logistics', label: '+ ロジ会社(在庫保管)' },
]

export function InviteLinksSection({ forms }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [justCreated, setJustCreated] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urlOf = (token: string) => `${origin}/external/${token}`

  const generate = (kind: InviteKind) =>
    startTransition(async () => {
      const r =
        kind === 'client'
          ? await createClientInvitation()
          : kind === 'factory'
            ? await createFactoryInvitation()
            : await createPartnerInvitation(kind)
      if (!r.token || r.error) {
        toast(r.error || 'リンク生成に失敗しました', 'warn')
        return
      }
      setJustCreated(r.token)
      try {
        await navigator.clipboard.writeText(urlOf(r.token))
        toast('新しい招待リンクを生成してコピーしました')
      } catch {
        toast('新しい招待リンクを生成しました(下の一覧からコピーできます)')
      }
      router.refresh()
    })

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(urlOf(token))
      toast('URL をコピーしました')
    } catch {
      toast('コピーに失敗しました。URL を選択して手動でコピーしてください', 'warn')
    }
  }

  const cancel = (formId: string) =>
    startTransition(async () => {
      const r = await cancelExternalForm(formId)
      if (r.success) {
        toast('リンクを無効化しました')
        router.refresh()
      } else {
        toast(r.error || '無効化に失敗しました', 'warn')
      }
    })

  const active = forms.filter((f) => rowState(f) === 'pending')
  const rest = forms.filter((f) => rowState(f) !== 'pending')

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-5 mt-4">
      <h2 className="font-display text-[15px] font-bold text-[#351E28]">
        招待リンク(先方が自分で登録するフォーム)
      </h2>
      <p className="text-[11.5px] text-[#84787D] font-body mt-1 leading-relaxed">
        新しいクライアントや工場が増えたら、ここでリンクを生成して WeChat /
        メールで送ってください。先方がフォームを記入すると自動でマスターに登録されます。
        リンクは1回の登録で使い切り・有効期限7日です。
      </p>

      <div className="flex gap-2 mt-3 flex-wrap">
        {GENERATE_BUTTONS.map((b) => (
          <button
            key={b.kind}
            type="button"
            onClick={() => generate(b.kind)}
            disabled={pending}
            className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 disabled:opacity-40 hover:brightness-95"
          >
            {pending ? '…' : `${b.label}の招待リンク`}
          </button>
        ))}
      </div>

      {forms.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#E2E1DA]">
          <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
                <th className="text-left px-3 py-1.5">種別</th>
                <th className="text-left px-3 py-1.5">状態</th>
                <th className="text-left px-3 py-1.5">URL</th>
                <th className="text-left px-3 py-1.5 whitespace-nowrap">作成 / 期限</th>
                <th className="text-left px-3 py-1.5">登録者</th>
                <th className="px-3 py-1.5 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...rest].map((f, i) => {
                const st = rowState(f)
                const badge = STATE_BADGE[st]
                const isNew = f.token === justCreated
                return (
                  <tr
                    key={f.id}
                    className={`border-b border-[#EFEFEA] last:border-b-0 ${
                      isNew ? 'bg-[rgba(233,240,86,0.28)]' : i % 2 ? 'bg-[#FBFAF6]' : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap font-bold text-[#351E28]">
                      {TYPE_LABEL[f.form_type] || f.form_type}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded-full text-[10px] font-bold px-2 py-[2px] ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 min-w-[200px] max-w-[320px]">
                      {st === 'pending' ? (
                        <input
                          readOnly
                          value={urlOf(f.token)}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-full bg-[#EFEFEA] rounded-[8px] px-2 py-1 text-[10.5px] border-none outline-none text-[#351E28]"
                        />
                      ) : (
                        <span className="text-[#84787D]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap fc-num text-[#84787D]">
                      {formatDate(f.created_at)}
                      {f.expires_at && st === 'pending' && (
                        <> / {formatDate(f.expires_at)}まで</>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[#351E28]">
                      {f.submitted_by_email || (st === 'submitted' ? '登録済み' : '—')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {st === 'pending' && (
                        <span className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => copy(f.token)}
                            className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[10px] font-bold px-2 py-1 inline-flex items-center gap-1 hover:bg-[#FBFAF6]"
                          >
                            <Copy className="w-3 h-3" /> コピー
                          </button>
                          <button
                            type="button"
                            onClick={() => cancel(f.id)}
                            disabled={pending}
                            className="rounded-full bg-white border border-[#FF5C34] text-[#B03616] text-[10px] font-bold px-2 py-1 inline-flex items-center gap-1 disabled:opacity-40"
                            title="このリンクを無効化"
                          >
                            <X className="w-3 h-3" /> 無効化
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
