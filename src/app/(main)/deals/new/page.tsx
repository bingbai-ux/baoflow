'use client'

import { useState, useEffect } from 'react'
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

const materialCategoryOptions = [
  'クラフト紙',
  'コート紙',
  'PET',
  'PP',
  'アルミ蒸着フィルム',
  'ナイロン',
  '段ボール',
  '合成紙',
  'その他',
]

const printingMethodOptions = [
  'グラビア印刷',
  'フレキソ印刷',
  'オフセット印刷',
  'デジタル印刷',
  'シルクスクリーン',
  'その他',
]

const processingOptions = [
  'エンボス加工',
  '箔押し',
  'UV加工',
  'PP貼り',
  'マットラミネート',
  'グロスラミネート',
  '窓貼り',
  'ミシン目',
  'ジッパー付き',
  'バルブ付き',
  'ノッチ',
]

const laminationOptions = [
  'なし',
  'マットラミ',
  'グロスラミ',
  'ソフトタッチ',
]

const attachmentOptions = [
  'ハンドル',
  'リボン',
  'タグ',
  'インナー仕切り',
  'フォーム挿入',
  'シール',
]

export default function NewDealPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProcessing, setSelectedProcessing] = useState<string[]>([])
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([])

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

  const toggleProcessing = (item: string) => {
    setSelectedProcessing(prev =>
      prev.includes(item) ? prev.filter(p => p !== item) : [...prev, item]
    )
  }

  const toggleAttachment = (item: string) => {
    setSelectedAttachments(prev =>
      prev.includes(item) ? prev.filter(a => a !== item) : [...prev, item]
    )
  }

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

    // Create deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        deal_code: dealCode,
        deal_name: formData.get('deal_name') as string || null,
        client_id: clientId,
        sales_user_id: user.id,
        master_status: 'M01',
        win_probability: formData.get('win_probability') as string || 'medium',
        delivery_type: formData.get('delivery_type') as string || 'direct',
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

    // Create specification
    const { error: specError } = await supabase
      .from('deal_specifications')
      .insert({
        deal_id: deal.id,
        product_category: formData.get('product_category') as string || null,
        product_name: formData.get('product_name') as string || null,
        height_mm: formData.get('height_mm') ? parseFloat(formData.get('height_mm') as string) : null,
        width_mm: formData.get('width_mm') ? parseFloat(formData.get('width_mm') as string) : null,
        depth_mm: formData.get('depth_mm') ? parseFloat(formData.get('depth_mm') as string) : null,
        diameter_mm: formData.get('diameter_mm') ? parseFloat(formData.get('diameter_mm') as string) : null,
        bottom_diameter_mm: formData.get('bottom_diameter_mm') ? parseFloat(formData.get('bottom_diameter_mm') as string) : null,
        capacity_ml: formData.get('capacity_ml') ? parseFloat(formData.get('capacity_ml') as string) : null,
        material_category: formData.get('material_category') as string || null,
        material_thickness: formData.get('material_thickness') as string || null,
        material_notes: formData.get('material_notes') as string || null,
        printing_method: formData.get('printing_method') as string || null,
        print_colors: formData.get('print_colors') as string || null,
        print_sides: formData.get('print_sides') as string || null,
        processing_list: selectedProcessing.length > 0 ? selectedProcessing : null,
        lamination: formData.get('lamination') as string || null,
        attachments_list: selectedAttachments.length > 0 ? selectedAttachments : null,
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

    router.push(`/deals/${deal.id}`)
  }

  return (
    <>
      <div className="max-w-[800px]">
        {/* Page Header */}
        <div className="flex justify-between items-center py-[18px]">
          <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
            新規案件
          </h1>
          <Link
            href="/deals"
            className="text-[#888] text-[13px] font-body no-underline hover:text-[#555]"
          >
            キャンセル
          </Link>
        </div>

        {/* Excel/PDF Import Placeholder */}
        <div className="bg-[#f2f2f0] rounded-[14px] border border-dashed border-[#e8e8e6] p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center">
              <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-[#555] font-body font-medium">
                Excel/PDF から自動入力
              </p>
              <p className="text-[11px] text-[#888] font-body mt-0.5">
                工場の見積もりExcel/PDFをアップロードすると、仕様と価格を自動入力します（準備中）
              </p>
            </div>
            <button
              type="button"
              disabled
              className="bg-white text-[#888] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[12px] font-body opacity-50 cursor-not-allowed"
            >
              ファイル選択
            </button>
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-6 mb-4">
            <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">基本情報</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Client */}
              <div>
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

              {/* Deal Name */}
              <div>
                <label style={labelStyle}>案件名</label>
                <input
                  type="text"
                  name="deal_name"
                  style={inputStyle}
                  placeholder="例: ABC様向けコーヒー袋"
                />
              </div>

              {/* Win Probability */}
              <div>
                <label style={labelStyle}>受注角度</label>
                <select name="win_probability" style={inputStyle} defaultValue="medium">
                  <option value="very_high">非常に高い</option>
                  <option value="high">高い</option>
                  <option value="medium">中程度</option>
                  <option value="low">低い</option>
                </select>
              </div>

              {/* Delivery Type */}
              <div>
                <label style={labelStyle}>納品タイプ</label>
                <select name="delivery_type" style={inputStyle} defaultValue="direct">
                  <option value="direct">直送</option>
                  <option value="logistics_center">ロジセンター経由</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-6 mb-4">
            <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">商品仕様</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Product Category */}
              <div>
                <label style={labelStyle}>商品カテゴリ</label>
                <select name="product_category" style={inputStyle}>
                  <option value="">選択してください</option>
                  {productCategoryOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Product Name */}
              <div>
                <label style={labelStyle}>商品名</label>
                <input
                  type="text"
                  name="product_name"
                  style={inputStyle}
                  placeholder="例: コーヒー豆パッケージ 200g"
                />
              </div>
            </div>

            {/* Size */}
            <div className="mb-4">
              <label style={labelStyle}>サイズ (mm)</label>
              <div className="grid grid-cols-6 gap-2">
                <input type="number" name="height_mm" style={inputStyle} placeholder="高さ" step="0.1" />
                <input type="number" name="width_mm" style={inputStyle} placeholder="幅" step="0.1" />
                <input type="number" name="depth_mm" style={inputStyle} placeholder="奥行" step="0.1" />
                <input type="number" name="diameter_mm" style={inputStyle} placeholder="口径" step="0.1" />
                <input type="number" name="bottom_diameter_mm" style={inputStyle} placeholder="底径" step="0.1" />
                <input type="number" name="capacity_ml" style={inputStyle} placeholder="容量ml" step="0.1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Material Category */}
              <div>
                <label style={labelStyle}>素材カテゴリ</label>
                <select name="material_category" style={inputStyle}>
                  <option value="">選択してください</option>
                  {materialCategoryOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Material Thickness */}
              <div>
                <label style={labelStyle}>素材厚み</label>
                <input
                  type="text"
                  name="material_thickness"
                  style={inputStyle}
                  placeholder="例: 100μm"
                />
              </div>

              {/* Material Notes */}
              <div>
                <label style={labelStyle}>素材備考</label>
                <input
                  type="text"
                  name="material_notes"
                  style={inputStyle}
                  placeholder="例: アルミ蒸着層付き"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Printing Method */}
              <div>
                <label style={labelStyle}>印刷方法</label>
                <select name="printing_method" style={inputStyle}>
                  <option value="">選択してください</option>
                  {printingMethodOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Print Colors */}
              <div>
                <label style={labelStyle}>印刷色数</label>
                <input
                  type="number"
                  name="print_colors"
                  style={inputStyle}
                  placeholder="例: 4"
                  min="1"
                  max="12"
                />
              </div>

              {/* Print Sides */}
              <div>
                <label style={labelStyle}>印刷面</label>
                <select name="print_sides" style={inputStyle}>
                  <option value="">選択してください</option>
                  <option value="片面">片面</option>
                  <option value="両面">両面</option>
                  <option value="外面">外面</option>
                  <option value="内面">内面</option>
                </select>
              </div>
            </div>

            {/* Processing */}
            <div className="mb-4">
              <label style={labelStyle}>加工</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {processingOptions.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleProcessing(item)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                      backgroundColor: selectedProcessing.includes(item) ? '#0a0a0a' : '#f2f2f0',
                      color: selectedProcessing.includes(item) ? '#ffffff' : '#555555',
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Lamination */}
            <div className="mb-4">
              <label style={labelStyle}>ラミネーション</label>
              <select name="lamination" style={inputStyle}>
                {laminationOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Attachments */}
            <div className="mb-4">
              <label style={labelStyle}>付属品</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {attachmentOptions.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAttachment(item)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                      backgroundColor: selectedAttachments.includes(item) ? '#0a0a0a' : '#f2f2f0',
                      color: selectedAttachments.includes(item) ? '#ffffff' : '#555555',
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Specification Memo */}
            <div>
              <label style={labelStyle}>仕様メモ</label>
              <textarea
                name="specification_memo"
                rows={3}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="その他の仕様に関する情報"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="py-3 px-4 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] text-[13px] font-body mb-4">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#0a0a0a',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '保存中...' : '保存'}
            </button>
            <Link
              href="/deals"
              style={{
                backgroundColor: '#ffffff',
                color: '#888',
                border: '1px solid #e8e8e6',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                textDecoration: 'none',
              }}
            >
              キャンセル
            </Link>
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
  padding: '10px 14px',
  fontSize: '13px',
  border: 'none',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}
