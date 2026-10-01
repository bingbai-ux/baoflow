'use client'

// Sprint 8-6: RFQ (見積依頼) 作成モーダル。
//   - 商品リストにチェックボックス
//   - 工場マスター複数選択 (basic_info_completed=true のみ依頼可)
//   - 期限 + メッセージ
//   - 送信で rfq_requests + 各工場 invitation + external_forms トークンを作成
//   - 送信完了後、各工場用の URL を表示してコピー可能 (§0.5-3 リンクコピーのみ)

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, X, FileText } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'
import { useWorkflowRequest } from '@/lib/hooks/use-workflow-request'
import { createRfq, emailRfqInvitation, listFactoriesForRfq } from '@/lib/actions/rfq'
import type { ProductRow } from '@/components/deals/deals-nested-table'

interface Props {
  dealId: string
  products: ProductRow[]
  onClose: () => void
}

interface FactoryOpt {
  id: string
  factory_name: string
  name_cn: string | null
  basic_info_completed: boolean
  contact_email: string | null
}

export function RfqCreateModal({ dealId, products, onClose }: Props) {
  const router = useRouter()
  const { toast, mailReady } = useUi()
  const [pending, startTransition] = useTransition()
  const recovery = useWorkflowRequest(`rfq/${dealId}`, 'rfq', dealId)
  const { recovered, complete: completeRecovery } = recovery
  const [error, setError] = useState<string | null>(null)
  const [loadingFactories, setLoadingFactories] = useState(true)
  const [emailPending, setEmailPending] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [factories, setFactories] = useState<FactoryOpt[]>([])
  const [productIds, setProductIds] = useState<Set<string>>(
    new Set(products.map((p) => p.id))
  )
  const [factoryIds, setFactoryIds] = useState<Set<string>>(new Set())
  const [pendingName, setPendingName] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [deadline, setDeadline] = useState<string>('')
  const [message, setMessage] = useState<string>('')

  // 完了後の招待 URL
  const [createdInvites, setCreatedInvites] = useState<
    Array<{ invitationId: string; factoryName: string; url: string }>
  >([])

  useEffect(() => {
    listFactoriesForRfq().then(setFactories).catch(() => setError('工場一覧を取得できませんでした')).finally(() => setLoadingFactories(false))
  }, [])

  useEffect(() => {
    const invitations = recovered?.invitations
    if (Array.isArray(invitations)) {
      setCreatedInvites(invitations.map(i => ({ invitationId: i.invitationId, factoryName: i.factoryName, url: new URL(`/external/${i.formToken}`, window.location.origin).href })))
      toast('前回保存した見積依頼と回答リンクを復帰しました')
    }
  }, [recovered, completeRecovery, toast])

  const close = () => {
    if (pending) return
    if (createdInvites.length) completeRecovery()
    onClose()
    router.refresh()
  }

  const toggleProduct = (id: string) => {
    setProductIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleFactory = (id: string) => {
    setFactoryIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const handleSubmit = () => {
    if (pending) return
    const name = pendingName.trim(), email = pendingEmail.trim()
    if (email && (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
      setError('未登録工場名と有効なメールアドレスを入力してください')
      return
    }
    if (name && factories.some(f => factoryIds.has(f.id) && f.factory_name.trim().toLowerCase() === name.toLowerCase())) {
      setError('選択済みの登録工場と同じ名前の未登録工場は追加できません')
      return
    }
    startTransition(async () => {
      setError(null)
      try {
      const requestId = await recovery.requestId({ dealId, products: [...productIds].sort(), factories: [...factoryIds].sort(), pendingFactories: pendingName.trim() ? [{ name: pendingName.trim(), email: pendingEmail.trim() }] : [], deadline, message })
      const r = await createRfq({
        requestId,
        dealId,
        productIds: Array.from(productIds),
        factoryIds: Array.from(factoryIds),
        pendingFactories: pendingName.trim() ? [{ name: pendingName.trim(), email: pendingEmail.trim() }] : [],
        responseDeadline: deadline || null,
        requestMessage: message,
      })
      if (!r.data || r.error) {
        setError(r.error || 'RFQ 作成に失敗しました。同じ内容で再試行してください')
        return
      }
      toast(`${r.data.rfqNumber} を作成しました`)
      setCreatedInvites(
        r.data.invitations.map((i) => ({
          invitationId: i.invitationId,
          factoryName: i.factoryName,
          url: new URL(i.formUrl, window.location.origin).href,
        }))
      )
      } catch (e) { setError(e instanceof Error ? e.message : '通信に失敗しました。同じ内容で再試行しても依頼は重複しません') }
    })
  }

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast('URL をコピーしました')
    } catch {
      toast('コピー失敗', 'warn')
    }
  }

  const sendEmail = async (invitationId: string) => {
    if (emailPending || sentIds.has(invitationId)) return
    setEmailPending(invitationId)
    setError(null)
    try {
      const result = await emailRfqInvitation(invitationId)
      if (result.error) setError(result.error)
      else { setSentIds(previous => new Set([...previous, invitationId])); toast('メールを送信しました') }
    } catch { setError('送信状況を確認できませんでした。再送前に履歴を確認してください') }
    finally { setEmailPending(null) }
  }

  // ----- 完了後画面 -----
  if (createdInvites.length > 0) {
    return (
      <Modal onClose={close} title="見積依頼を作成しました">
        <p className="text-[12px] text-[#351E28] mb-3">
          各工場の回答リンクを作成しました。有効期限は7日です。メールはまだ送信していません。回答リンクをコピーして工場へ共有してください。
        </p>
        {error && <p role="alert" className="text-[12px] text-[#B03616] mb-3">{error}</p>}
        <div className="space-y-2">
          {createdInvites.map((inv, i) => (
            <div
              key={i}
              className="bg-[#FBFAF6] border border-[#E2E1DA] rounded-[12px] p-2.5"
            >
              <p className="text-[12px] font-semibold mb-1.5">{inv.factoryName}</p>
              <div className="flex gap-2 items-center">
                <input
                  value={inv.url}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-2 py-1 text-[10px] font-mono bg-white border border-[#E2E1DA] rounded-[4px]"
                />
                {inv.url.startsWith('http') ? (
                  <button
                    onClick={() => copy(inv.url)}
                    className="text-[11px] px-2 py-1 bg-[#351E28] text-[#C9A2B8] rounded-[5px] inline-flex items-center gap-1 hover:brightness-95"
                  >
                    <Copy className="w-3 h-3" /> コピー
                  </button>
                ) : (
                  <span className="text-[10px] text-[#84787D]">手動紐付け要</span>
                )}
              </div>
              {!mailReady && <p className="text-[12px] text-[#84787D] mt-2">メール送信の設定が未完了です。回答リンクを共有するか、管理者に設定を依頼してください。</p>}
              <button type="button" onClick={() => sendEmail(inv.invitationId)} disabled={!mailReady || !!emailPending || sentIds.has(inv.invitationId)} className="rounded-full border border-[#E2E1DA] px-3 py-2 mt-2 text-[12px] disabled:opacity-50">
                {sentIds.has(inv.invitationId) ? 'メール送信済み' : emailPending === inv.invitationId ? '送信中…' : '工場にメールを送信する'}
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={close}
            className="text-[12px] px-3 py-1.5 bg-[#351E28] text-[#C9A2B8] rounded-[8px]"
          >
            閉じる
          </button>
        </div>
      </Modal>
    )
  }

  // ----- 入力画面 -----
  return (
    <Modal onClose={close} title="見積依頼を作成">
      <div className="space-y-4">
        <p className="text-[12px] text-[#84787D]">作成すると回答リンクを保存します。メール送信は作成後に選べます。</p>
        {error && <p role="alert" className="text-[12px] text-[#B03616]">{error}</p>}
        {recovery.error && <p role="alert" className="text-[#B03616] text-[12px]">{recovery.error}</p>}
        {recovery.unfinished && !recovery.recovered && <p className="text-[12px]">前回の保存結果が未確認です。同じ内容で再試行してください。<button type="button" className="underline ml-2" onClick={recovery.complete}>既存RFQを確認済み・新しい入力を始める</button></p>}
        <fieldset disabled={!recovery.ready || pending} className="space-y-4">
        {/* 商品選択 */}
        <Section title="対象商品">
          {products.length === 0 ? (
            <p className="text-[11px] text-[#84787D]">この案件には商品がまだありません</p>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-auto border border-[#E2E1DA] rounded-[8px] p-2">
              {products.map((p) => (
                <li key={p.id}>
                  <label className="inline-flex items-center gap-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productIds.has(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="font-display tabular-nums text-[10px] text-[#84787D]">
                      #{p.product_no}
                    </span>
                    <span>{p.description || '(未設定)'}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 工場選択 */}
        <Section title={`依頼先工場 (${factoryIds.size} 選択中)`}>
          {loadingFactories ? <p className="text-[12px] text-[#84787D]">工場を読込中…</p> : factories.length === 0 ? (
            <div className="text-[11px] text-[#84787D] bg-[#FFD8C2] border border-[#FFD8C2] rounded-[8px] p-2.5">
              工場マスターが空です。先に「工場招待リンク」で工場を登録してもらうか、自社で手動登録してください。
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-auto border border-[#E2E1DA] rounded-[8px] p-2">
              {factories.map((f) => {
                const eligible = f.basic_info_completed
                return (
                  <li key={f.id}>
                    <label
                      className={`inline-flex items-center gap-2 text-[11px] ${
                        eligible ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={factoryIds.has(f.id)}
                        onChange={() => eligible && toggleFactory(f.id)}
                        disabled={!eligible}
                      />
                      <span>{f.factory_name}</span>
                      {f.name_cn && <span className="text-[10px] text-[#84787D]">/ {f.name_cn}</span>}
                      {!eligible && (
                        <span className="text-[9px] text-[#B03616] bg-[#FFD8C2] px-1.5 py-0.5 rounded">
                          基本情報未入力
                        </span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        {/* 期限 + メッセージ */}
        <Section title="未登録工場への依頼 (任意)">
          <p className="text-[11px] text-[#84787D] mb-2">回答は保存されます。工場の基本情報を登録した後、この案件で登録工場を選んで回答を取り込めます。</p>
          <label className="block text-[12px]">未登録工場名<input value={pendingName} maxLength={200} onChange={e => setPendingName(e.target.value)} className="block min-h-11 w-full border border-[#E2E1DA] rounded-[8px] p-2" /></label>
          <label className="block text-[12px] mt-2">未登録工場メール (任意)<input type="email" value={pendingEmail} maxLength={254} onChange={e => setPendingEmail(e.target.value)} className="block min-h-11 w-full border border-[#E2E1DA] rounded-[8px] p-2" /></label>
        </Section>
        <Section title="補足">
          <label className="block">
            <span className="block text-[10px] text-[#351E28] mb-1">回答期限 (任意)</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] border border-[#E2E1DA] rounded-[8px]"
            />
          </label>
          <label className="block mt-2">
            <span className="block text-[10px] text-[#351E28] mb-1">メッセージ (任意)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="特記事項があれば"
              className="w-full px-2 py-1.5 text-[12px] border border-[#E2E1DA] rounded-[8px] resize-y"
            />
          </label>
        </Section>

        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={close}
            className="text-[12px] px-3 py-1.5 border border-[#E2E1DA] rounded-[8px]"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!recovery.ready || pending || loadingFactories || productIds.size === 0 || (factoryIds.size === 0 && !pendingName.trim())}
            className="text-[12px] px-3 py-1.5 bg-[#351E28] text-[#C9A2B8] rounded-[8px] disabled:opacity-50 inline-flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            {pending ? '作成中…' : 'RFQ を作成'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[16px] shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-[14px] font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-[#84787D] hover:bg-[#FBFAF6] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.06em] text-[#84787D] mb-1.5">{title}</p>
      {children}
    </div>
  )
}
