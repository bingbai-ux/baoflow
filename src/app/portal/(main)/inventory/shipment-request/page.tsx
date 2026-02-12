'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface InventoryItem {
  id: string
  product_name: string
  current_stock: number
  sku?: string
}

export default function ShipmentRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [formData, setFormData] = useState({
    itemId: '',
    quantity: '',
    recipientName: '',
    recipientPhone: '',
    postalCode: '',
    address: '',
    notes: '',
  })

  useEffect(() => {
    const loadItems = async () => {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Get client_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single()

      if (!profile?.client_id) return

      // Get inventory items
      const { data: itemsData } = await supabase
        .from('inventory_items')
        .select('id, product_name, current_stock, sku')
        .eq('client_id', profile.client_id)
        .gt('current_stock', 0)
        .order('product_name')

      if (itemsData) {
        setItems(itemsData)
      }

      setLoading(false)
    }

    loadItems()
  }, [])

  const selectedItem = items.find((i) => i.id === formData.itemId)
  const maxQuantity = selectedItem?.current_stock || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSubmitting(false)
      return
    }

    // Get client_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('client_id')
      .eq('id', user.id)
      .single()

    if (!profile?.client_id) {
      setSubmitting(false)
      return
    }

    // Generate order code
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderCode = `SO-${dateStr}-${random}`

    // Create shipment order
    const { error } = await supabase.from('shipment_orders').insert({
      order_code: orderCode,
      client_id: profile.client_id,
      inventory_item_id: formData.itemId,
      quantity: parseInt(formData.quantity),
      recipient_name: formData.recipientName,
      recipient_phone: formData.recipientPhone,
      recipient_postal_code: formData.postalCode,
      recipient_address: formData.address,
      notes: formData.notes || null,
      status: 'pending',
    })

    if (error) {
      alert('エラーが発生しました: ' + error.message)
      setSubmitting(false)
      return
    }

    router.push('/portal/inventory')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="py-10 text-center">
        <p className="text-[13px] text-[#888] font-body">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/portal/inventory"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        在庫一覧に戻る
      </Link>

      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
        出庫依頼
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Item Selection */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            出庫商品
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                商品 <span className="text-[#e5a32e]">*</span>
              </label>
              <select
                required
                value={formData.itemId}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value, quantity: '' })}
                className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
              >
                <option value="">選択してください</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.product_name} ({item.current_stock.toLocaleString()}個在庫)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                数量 <span className="text-[#e5a32e]">*</span>
                {maxQuantity > 0 && (
                  <span className="text-[#555]"> (最大: {maxQuantity.toLocaleString()})</span>
                )}
              </label>
              <input
                type="number"
                required
                min="1"
                max={maxQuantity}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                disabled={!formData.itemId}
                className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] disabled:opacity-50"
                placeholder="個"
              />
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            配送先情報
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                宛名 <span className="text-[#e5a32e]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.recipientName}
                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                電話番号 <span className="text-[#e5a32e]">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.recipientPhone}
                onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                placeholder="03-1234-5678"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                郵便番号 <span className="text-[#e5a32e]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                placeholder="123-4567"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                住所 <span className="text-[#e5a32e]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                備考
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] resize-none"
                placeholder="配送時間指定など"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !formData.itemId || !formData.quantity}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-6 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
          >
            {submitting ? '送信中...' : '出庫依頼を送信'}
          </button>
        </div>
      </form>
    </div>
  )
}
