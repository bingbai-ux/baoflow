'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createLogisticsAgent } from '@/lib/actions/logistics'

const AGENT_TYPES = [
  { value: 'forwarder', label: 'フォワーダー' },
  { value: 'customs_broker', label: '通関業者' },
  { value: 'all_in_one', label: 'オールインワン' },
]

export default function NewLogisticsAgentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<string[]>([])
  const [newService, setNewService] = useState('')

  const addService = () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      setServices([...services, newService.trim()])
      setNewService('')
    }
  }

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('services', JSON.stringify(services))

    const result = await createLogisticsAgent(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/logistics')
  }

  return (
    <div className="px-[26px] py-5">
      {/* Back Link */}
      <Link
        href="/logistics"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        物流エージェント一覧に戻る
      </Link>

      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a] mb-5">
        物流エージェント登録
      </h1>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[#888] font-body mb-1">
                名称 <span className="text-[#e5a32e]">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                placeholder="例: D2D海上速達便"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] font-body mb-1">
                英語名
              </label>
              <input
                type="text"
                name="name_en"
                className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                placeholder="例: D2D Express Sea"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] text-[#888] font-body mb-1">
              タイプ <span className="text-[#e5a32e]">*</span>
            </label>
            <select
              name="agent_type"
              required
              className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            >
              <option value="">選択してください</option>
              {AGENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Services */}
          <div>
            <label className="block text-[11px] text-[#888] font-body mb-1">
              対応サービス
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addService()
                  }
                }}
                className="flex-1 bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                placeholder="例: 海上D2D"
              />
              <button
                type="button"
                onClick={addService}
                className="px-3 py-2 bg-[#0a0a0a] text-white rounded-[8px] text-[11px] font-body"
              >
                追加
              </button>
            </div>
            {services.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {services.map((service, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[10px] font-body text-[#555] bg-[#f2f2f0] px-2 py-1 rounded"
                  >
                    {service}
                    <button
                      type="button"
                      onClick={() => removeService(i)}
                      className="text-[#888] hover:text-[#0a0a0a]"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[#888] font-body mb-1">
                担当者名
              </label>
              <input
                type="text"
                name="contact_name"
                className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] font-body mb-1">
                連絡先
              </label>
              <input
                type="text"
                name="contact_info"
                className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                placeholder="メール or 電話番号"
              />
            </div>
          </div>

          {/* Primary */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_primary"
              id="is_primary"
              className="w-4 h-4 rounded border-[#e8e8e6]"
            />
            <label htmlFor="is_primary" className="text-[12px] font-body text-[#555]">
              主要担当に設定
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] text-[#888] font-body mb-1">
              メモ
            </label>
            <textarea
              name="notes"
              rows={3}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-[12px] py-2 px-3 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] font-body">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0a0a0a] text-white rounded-[8px] py-3 text-[13px] font-body font-medium disabled:opacity-50"
          >
            {loading ? '登録中...' : '登録'}
          </button>
        </div>
      </form>
    </div>
  )
}
