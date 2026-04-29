'use client'

// Sprint 8-6: RFQ (見積依頼) 作成モーダル。
//   - 商品リストにチェックボックス
//   - 工場マスター複数選択 (basic_info_completed=true のみ依頼可)
//   - 期限 + メッセージ
//   - 送信で rfq_requests + 各工場 invitation + external_forms トークンを作成
//   - 送信完了後、各工場用の URL を表示してコピー可能 (§0.5-3 リンクコピーのみ)

import { useEffect, useState, useTransition } from 'react'
import { Copy, X, FileText } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'
import { createRfq, listFactoriesForRfq } from '@/lib/actions/rfq'
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
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [factories, setFactories] = useState<FactoryOpt[]>([])
  const [productIds, setProductIds] = useState<Set<string>>(
    new Set(products.map((p) => p.id))
  )
  const [factoryIds, setFactoryIds] = useState<Set<string>>(new Set())
  const [deadline, setDeadline] = useState<string>('')
  const [message, setMessage] = useState<string>('')

  // 完了後の招待 URL
  const [createdInvites, setCreatedInvites] = useState<
    Array<{ factoryName: string; url: string }>
  >([])

  useEffect(() => {
    listFactoriesForRfq().then(setFactories)
  }, [])

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
    startTransition(async () => {
      const r = await createRfq({
        dealId,
        productIds: Array.from(productIds),
        factoryIds: Array.from(factoryIds),
        responseDeadline: deadline || null,
        requestMessage: message,
      })
      if (!r.data || r.error) {
        toast(r.error || 'RFQ 作成に失敗しました', 'warn')
        return
      }
      toast(`${r.data.rfqNumber} を作成しました`)
      setCreatedInvites(
        r.data.invitations.map((i) => ({
          factoryName: i.factoryName,
          url: i.formUrl,
        }))
      )
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

  // ----- 完了後画面 -----
  if (createdInvites.length > 0) {
    return (
      <Modal onClose={onClose} title="見積依頼を作成しました">
        <p className="text-[12px] text-[#555] mb-3">
          各工場用の依頼 URL です。WeChat / メール等で送信してください。**有効期限は 7 日**。
        </p>
        <div className="space-y-2">
          {createdInvites.map((inv, i) => (
            <div
              key={i}
              className="bg-[#fafaf9] border border-[#e8e8e6] rounded-[8px] p-2.5"
            >
              <p className="text-[12px] font-semibold mb-1.5">{inv.factoryName}</p>
              <div className="flex gap-2 items-center">
                <input
                  value={inv.url}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-2 py-1 text-[10px] font-mono bg-white border border-[#e8e8e6] rounded-[4px]"
                />
                {inv.url.startsWith('http') ? (
                  <button
                    onClick={() => copy(inv.url)}
                    className="text-[11px] px-2 py-1 bg-[#0a0a0a] text-white rounded-[5px] inline-flex items-center gap-1 hover:bg-[#222]"
                  >
                    <Copy className="w-3 h-3" /> コピー
                  </button>
                ) : (
                  <span className="text-[10px] text-[#888]">手動紐付け要</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="text-[12px] px-3 py-1.5 bg-[#0a0a0a] text-white rounded-[6px]"
          >
            閉じる
          </button>
        </div>
      </Modal>
    )
  }

  // ----- 入力画面 -----
  return (
    <Modal onClose={onClose} title="見積依頼を作成">
      <div className="space-y-4">
        {/* 商品選択 */}
        <Section title="対象商品">
          {products.length === 0 ? (
            <p className="text-[11px] text-[#888]">この案件には商品がまだありません</p>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-auto border border-[#e8e8e6] rounded-[6px] p-2">
              {products.map((p) => (
                <li key={p.id}>
                  <label className="inline-flex items-center gap-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productIds.has(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="font-display tabular-nums text-[10px] text-[#888]">
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
          {factories.length === 0 ? (
            <div className="text-[11px] text-[#888] bg-[#fffbf2] border border-[#f5d7a8] rounded-[6px] p-2.5">
              工場マスターが空です。先に「工場招待リンク」で工場を登録してもらうか、自社で手動登録してください。
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-auto border border-[#e8e8e6] rounded-[6px] p-2">
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
                      {f.name_cn && <span className="text-[10px] text-[#888]">/ {f.name_cn}</span>}
                      {!eligible && (
                        <span className="text-[9px] text-[#c0392b] bg-[#fef2f2] px-1.5 py-0.5 rounded">
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
        <Section title="補足">
          <label className="block">
            <span className="block text-[10px] text-[#555] mb-1">回答期限 (任意)</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e8e8e6] rounded-[6px]"
            />
          </label>
          <label className="block mt-2">
            <span className="block text-[10px] text-[#555] mb-1">メッセージ (任意)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="特記事項があれば"
              className="w-full px-2 py-1.5 text-[12px] border border-[#e8e8e6] rounded-[6px] resize-y"
            />
          </label>
        </Section>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-[12px] px-3 py-1.5 border border-[#e8e8e6] rounded-[6px]"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || productIds.size === 0 || factoryIds.size === 0}
            className="text-[12px] px-3 py-1.5 bg-[#0a0a0a] text-white rounded-[6px] disabled:opacity-50 inline-flex items-center gap-1"
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
      className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-[14px] font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-[#888] hover:bg-[#fafaf9] rounded">
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
      <p className="text-[10px] uppercase tracking-[0.06em] text-[#888] mb-1.5">{title}</p>
      {children}
    </div>
  )
}
