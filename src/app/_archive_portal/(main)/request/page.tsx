'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createQuoteRequest, type QuoteRequestItem } from '@/lib/actions/portal'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
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

interface FormItem {
  product_name: string
  category: string
  quantity: string
  size_notes: string
  material_notes: string
  reference_image_url: string
  existing_quote_url: string
  memo: string
}

const emptyItem: FormItem = {
  product_name: '',
  category: '',
  quantity: '',
  size_notes: '',
  material_notes: '',
  reference_image_url: '',
  existing_quote_url: '',
  memo: '',
}

export default function PortalRequestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const catalogItemId = searchParams.get('catalog_item_id')

  const [items, setItems] = useState<FormItem[]>([{ ...emptyItem }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalogItem, setCatalogItem] = useState<{
    product_type_ja: string
    category: string
  } | null>(null)

  // Load catalog item if specified
  useEffect(() => {
    if (catalogItemId) {
      const supabase = createClient()
      supabase
        .from('catalog_items')
        .select('product_type_ja, category')
        .eq('id', catalogItemId)
        .single()
        .then(({ data }) => {
          if (data) {
            setCatalogItem(data)
            setItems([
              {
                ...emptyItem,
                product_name: data.product_type_ja || '',
                category: data.category || '',
              },
            ])
          }
        })
    }
  }, [catalogItemId])

  const addItem = () => {
    setItems([...items, { ...emptyItem }])
  }

  const removeItem = (index: number) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof FormItem, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate - at least one item with product name
    const validItems = items.filter((item) => item.product_name.trim())
    if (validItems.length === 0) {
      setError('商品名を1つ以上入力してください')
      return
    }

    setLoading(true)

    const requestItems: QuoteRequestItem[] = validItems.map((item) => ({
      product_name: item.product_name,
      category: item.category || undefined,
      quantity: item.quantity || undefined,
      size_notes: item.size_notes || undefined,
      material_notes: item.material_notes || undefined,
      reference_image_url: item.reference_image_url || undefined,
      existing_quote_url: item.existing_quote_url || undefined,
      memo: item.memo || undefined,
    }))

    const result = await createQuoteRequest(requestItems)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Redirect to orders page
    router.push('/portal/orders')
  }

  return (
    <div className="space-y-5">
      {/* Back Link */}
      <Link
        href="/portal"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        ダッシュボードに戻る
      </Link>

      {/* Page Title */}
      <div>
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          見積もり依頼
        </h1>
        <p className="text-[13px] text-[#888] font-body mt-1">
          複数の商品を一度にお見積もり依頼いただけます。
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5"
          >
            {/* Item Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-body font-medium text-[#0a0a0a]">
                商品 {index + 1}
              </h3>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-[11px] text-[#888] font-body hover:text-[#0a0a0a]"
                >
                  削除
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="col-span-2">
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  商品名 <span className="text-[#e5a32e]">*</span>
                </label>
                <input
                  type="text"
                  value={item.product_name}
                  onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                  required
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                  placeholder="例: コーヒー用スタンドパック"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  カテゴリ
                </label>
                <select
                  value={item.category}
                  onChange={(e) => updateItem(index, 'category', e.target.value)}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                >
                  <option value="">選択してください</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  希望数量
                </label>
                <input
                  type="text"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                  placeholder="例: 5,000個 or 5000〜10000個くらい"
                />
              </div>

              {/* Size */}
              <div>
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  サイズ目安
                </label>
                <input
                  type="text"
                  value={item.size_notes}
                  onChange={(e) => updateItem(index, 'size_notes', e.target.value)}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                  placeholder="例: 縦20cm x 横15cm x マチ5cm"
                />
              </div>

              {/* Material */}
              <div>
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  素材希望
                </label>
                <input
                  type="text"
                  value={item.material_notes}
                  onChange={(e) => updateItem(index, 'material_notes', e.target.value)}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                  placeholder="例: クラフト紙、マット加工"
                />
              </div>

              {/* Reference Image URL */}
              <div>
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  参考画像URL
                </label>
                <input
                  type="url"
                  value={item.reference_image_url}
                  onChange={(e) => updateItem(index, 'reference_image_url', e.target.value)}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                  placeholder="https://..."
                />
              </div>

              {/* Existing Quote URL */}
              <div>
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  既存見積書URL
                </label>
                <input
                  type="url"
                  value={item.existing_quote_url}
                  onChange={(e) => updateItem(index, 'existing_quote_url', e.target.value)}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                  placeholder="https://..."
                />
              </div>

              {/* Memo */}
              <div className="col-span-2">
                <label className="block text-[11px] text-[#888] font-body mb-1">
                  備考（曖昧な要望もOK）
                </label>
                <textarea
                  value={item.memo}
                  onChange={(e) => updateItem(index, 'memo', e.target.value)}
                  rows={3}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] resize-none"
                  placeholder="例: 以前使っていた袋と同じ感じで、もう少し高級感を出したい"
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add Item Button */}
        <button
          type="button"
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 bg-white text-[#888] border border-dashed border-[#e8e8e6] rounded-[12px] py-3 text-[12px] font-body hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          商品を追加
        </button>

        {/* Error Message */}
        {error && (
          <div className="text-[12px] py-2 px-3 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] font-body">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0a0a0a] text-white rounded-[8px] py-3 text-[13px] font-body font-medium disabled:opacity-50"
        >
          {loading ? '送信中...' : '見積もり依頼を送信'}
        </button>
      </form>
    </div>
  )
}
