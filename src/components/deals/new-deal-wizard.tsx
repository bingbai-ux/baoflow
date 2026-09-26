'use client'

// Sprint 14: 新規案件ウィザード。
// 入力: クライアント(選択) / ブランド / 何を作るか(プリセット+任意追加・複数) /
//       希望納期 / 担当スタッフ。案件名は自動生成 (プレビュー表示、後から編集可)。

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDealFromWizard } from '@/lib/actions/deal-wizard'
import { useUi } from '@/components/ui/ui-store'

interface ClientOpt {
  id: string
  name: string
  fullName: string
  brand: string | null
}
interface StaffOpt {
  id: string
  name: string
}

interface Props {
  clients: ClientOpt[]
  staff: StaffOpt[]
  selfId: string
  itemPresets: string[]
}

const inputCls =
  'w-full bg-[#EFEFEA] rounded-[12px] px-3.5 py-2.5 text-[13px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#351E28]'

export function NewDealWizard({ clients, staff, selfId, itemPresets }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()

  const [clientId, setClientId] = useState('')
  const [freeClient, setFreeClient] = useState('')
  const [useFree, setUseFree] = useState(clients.length === 0)
  const [brand, setBrand] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [customItem, setCustomItem] = useState('')
  const [desired, setDesired] = useState('')
  const [salesId, setSalesId] = useState(selfId)
  const [error, setError] = useState<string | null>(null)

  const selectedClient = clients.find((c) => c.id === clientId)
  const clientName = useFree ? freeClient.trim() : selectedClient?.name || ''

  const previewName = useMemo(() => {
    const now = new Date()
    if (!clientName || items.length === 0) return ''
    return `${clientName} ${items.join('・')} ${now.getMonth() + 1}/${now.getDate()}`
  }, [clientName, items])

  const toggleItem = (name: string) =>
    setItems((xs) => (xs.includes(name) ? xs.filter((x) => x !== name) : [...xs, name]))

  const addCustom = () => {
    const v = customItem.trim()
    if (!v) return
    if (!items.includes(v)) setItems((xs) => [...xs, v])
    setCustomItem('')
  }

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const r = await createDealFromWizard({
        client_id: useFree ? null : clientId || null,
        client_name_text: clientName,
        brand_text: brand || null,
        items,
        desired_delivery_date: desired || null,
        sales_user_id: salesId,
      })
      if (r.dealId) {
        toast(`案件を作成しました(${r.dealCode})`)
        router.push(`/deals/${r.dealId}`)
      } else {
        setError(r.error || '作成に失敗しました')
      }
    })

  return (
    <div className="max-w-[640px] bg-white rounded-[16px] border border-[#E2E1DA] p-6 space-y-5 mb-8">
      {/* 1. クライアント */}
      <section>
        <p className="text-[12px] font-bold text-[#351E28] mb-1.5">
          1. クライアント <span className="text-[#B03616]">*</span>
          <span className="text-[10.5px] font-normal text-[#84787D] ml-2">後からでも変えられます</span>
        </p>
        {!useFree ? (
          <div className="flex items-center gap-2">
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value)
                const c = clients.find((x) => x.id === e.target.value)
                if (c?.brand && !brand) setBrand(c.brand)
              }}
              className={inputCls}
            >
              <option value="">— クライアントを選択 —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.name !== c.fullName ? `(${c.fullName})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setUseFree(true)}
              className="flex-shrink-0 text-[10.5px] text-[#33566F] font-bold underline"
            >
              未登録の名前を入力
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={freeClient}
              onChange={(e) => setFreeClient(e.target.value)}
              className={inputCls}
              placeholder="クライアント名を入力"
            />
            {clients.length > 0 && (
              <button
                type="button"
                onClick={() => setUseFree(false)}
                className="flex-shrink-0 text-[10.5px] text-[#33566F] font-bold underline"
              >
                登録済みから選ぶ
              </button>
            )}
          </div>
        )}
      </section>

      {/* 2. ブランド */}
      <section>
        <p className="text-[12px] font-bold text-[#351E28] mb-1.5">2. ブランド</p>
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={inputCls}
          placeholder="例: SOW COFFEE ROASTERS"
        />
      </section>

      {/* 3. 何を作るか */}
      <section>
        <p className="text-[12px] font-bold text-[#351E28] mb-1.5">
          3. 何を作るか <span className="text-[#B03616]">*</span>
          <span className="text-[10.5px] font-normal text-[#84787D] ml-2">複数選べます</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {itemPresets.map((name) => {
            const on = items.includes(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleItem(name)}
                className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold border transition-colors ${
                  on
                    ? 'bg-[#351E28] text-[#C9A2B8] border-[#351E28]'
                    : 'bg-white text-[#351E28] border-[#E2E1DA] hover:bg-[#FBFAF6]'
                }`}
              >
                {name}
              </button>
            )
          })}
          {items
            .filter((x) => !itemPresets.includes(x))
            .map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleItem(name)}
                className="rounded-full px-3.5 py-2 text-[12.5px] font-bold border bg-[#351E28] text-[#C9A2B8] border-[#351E28]"
              >
                {name} ×
              </button>
            ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            value={customItem}
            onChange={(e) => setCustomItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            className={`${inputCls} max-w-[260px]`}
            placeholder="その他(自由入力)"
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11.5px] font-bold px-3 py-2 hover:bg-[#FBFAF6]"
          >
            + 追加
          </button>
        </div>
      </section>

      {/* 4. 希望納期 / 5. 担当 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <section>
          <p className="text-[12px] font-bold text-[#351E28] mb-1.5">4. 希望納期</p>
          <input type="date" value={desired} onChange={(e) => setDesired(e.target.value)} className={inputCls} />
        </section>
        <section>
          <p className="text-[12px] font-bold text-[#351E28] mb-1.5">5. 担当スタッフ</p>
          <select value={salesId} onChange={(e) => setSalesId(e.target.value)} className={inputCls}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </section>
      </div>

      {/* 案件名プレビュー */}
      <div className="rounded-[12px] bg-[#FBFAF6] border border-[#E2E1DA] px-4 py-3">
        <p className="text-[10.5px] text-[#84787D] font-body">案件名(自動生成 — 作成後に編集できます)</p>
        <p className="text-[14px] font-display font-bold text-[#351E28] mt-0.5">
          {previewName || 'クライアントと「何を作るか」を選ぶと表示されます'}
        </p>
      </div>

      {error && (
        <p className="text-[12px] rounded-[12px] bg-[#FFD8C2] text-[#B03616] px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !clientName || items.length === 0}
        className="w-full rounded-full bg-[#E9F056] text-[#666C14] text-[14px] font-extrabold py-3 disabled:opacity-40 hover:brightness-95"
      >
        {pending ? '作成中…' : 'この内容で案件をつくる'}
      </button>
    </div>
  )
}
