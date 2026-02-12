'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  company_name: string
}

const productCategoryOptions = [
  'コーヒーバッグ',
  'ギフトボックス',
  'ショッピングバッグ',
  'カップ',
  '蓋',
  'アイスカップ',
  '化粧品箱',
  '抹茶缶',
  'パウチ',
  '紙袋',
  'その他',
]

export default function NewDealPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitActionRef = useRef<'detail' | 'save'>('save')

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name')
      if (data) setClients(data)
    }
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const clientId = formData.get('client_id') as string

    if (!clientId) {
      setError('クライアントを選択してください')
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Generate deal code
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `PF-${year}${month}-`

    const { data: existingDeals } = await supabase
      .from('deals')
      .select('deal_code')
      .like('deal_code', `${prefix}%`)
      .order('deal_code', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (existingDeals && existingDeals.length > 0) {
      const lastNumber = parseInt(existingDeals[0].deal_code.split('-')[2], 10)
      nextNumber = lastNumber + 1
    }
    const dealCode = `${prefix}${String(nextNumber).padStart(3, '0')}`

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('ログインが必要です')
      setLoading(false)
      return
    }

    // Create deal with minimal info
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        deal_code: dealCode,
        deal_name: null,
        client_id: clientId,
        sales_user_id: user.id,
        master_status: 'M01',
        win_probability: 'medium',
        delivery_type: 'direct',
        ai_mode: 'assist',
        last_activity_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dealError) {
      setError(dealError.message)
      setLoading(false)
      return
    }

    // Create specification with basic info only
    const { error: specError } = await supabase
      .from('deal_specifications')
      .insert({
        deal_id: deal.id,
        product_category: formData.get('product_category') as string || null,
        product_name: formData.get('product_name') as string || null,
        specification_memo: formData.get('specification_memo') as string || null,
      })

    if (specError) {
      setError(specError.message)
      setLoading(false)
      return
    }

    // Create status history
    await supabase.from('deal_status_history').insert({
      deal_id: deal.id,
      from_status: null,
      to_status: 'M01',
      changed_by: user.id,
      note: '案件作成',
    })

    // Navigate based on which button was clicked
    if (submitActionRef.current === 'detail') {
      router.push(`/deals/${deal.id}/edit`)
    } else {
      router.push(`/deals/${deal.id}`)
    }
  }

  return (
    <>
      <div className="max-w-[600px]">
        {/* Page Header */}
        <div className="flex justify-between items-center py-[18px]">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
              新規案件
            </h1>
            <p className="text-[12px] text-[#888] font-body mt-1">
              ステップ 1/2: 基本情報を入力
            </p>
          </div>
          <Link
            href="/deals"
            className="text-[#888] text-[13px] font-body no-underline hover:text-[#555]"
          >
            キャンセル
          </Link>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-6 mb-4">
            <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">基本情報</h2>

            {/* Client */}
            <div className="mb-4">
              <label style={labelStyle}>クライアント *</label>
              <select name="client_id" required style={inputStyle}>
                <option value="">選択してください</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Category */}
            <div className="mb-4">
              <label style={labelStyle}>商品カテゴリ</label>
              <select name="product_category" style={inputStyle}>
                <option value="">選択してください</option>
                {productCategoryOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Product Name */}
            <div className="mb-4">
              <label style={labelStyle}>商品名</label>
              <input
                type="text"
                name="product_name"
                style={inputStyle}
                placeholder="例: コーヒー豆パッケージ 200g"
              />
            </div>

            {/* Specification Memo */}
            <div>
              <label style={labelStyle}>仕様メモ</label>
              <textarea
                name="specification_memo"
                rows={4}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                placeholder="サイズ、素材、印刷方法など、わかっている情報を自由に入力してください&#10;※ 見積もりExcelがある場合は、案件保存後に「Excel取込」から自動で読み取れます"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="py-3 px-4 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] text-[13px] font-body mb-4">
              {error}
            </div>
          )}

          {/* Buttons - Two options */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              onClick={() => { submitActionRef.current = 'detail' }}
              style={{
                flex: 1,
                backgroundColor: '#0a0a0a',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '保存中...' : '保存して詳細を入力'}
            </button>
            <button
              type="submit"
              disabled={loading}
              onClick={() => { submitActionRef.current = 'save' }}
              style={{
                backgroundColor: '#ffffff',
                color: '#555',
                border: '1px solid #e8e8e6',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              保存のみ
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#888888',
  marginBottom: '6px',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#f2f2f0',
  borderRadius: '10px',
  padding: '12px 14px',
  fontSize: '13px',
  border: 'none',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}
