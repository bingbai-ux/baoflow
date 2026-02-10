'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateLogisticsAgent, deleteLogisticsAgent } from '@/lib/actions/logistics'

const AGENT_TYPES = [
  { value: 'forwarder', label: 'フォワーダー' },
  { value: 'customs_broker', label: '通関業者' },
  { value: 'all_in_one', label: 'オールインワン' },
]

interface LogisticsAgent {
  id: string
  name: string
  name_en: string | null
  agent_type: string
  services: string[] | null
  contact_name: string | null
  contact_info: string | null
  is_primary: boolean
  notes: string | null
}

interface LogisticsAgentFormProps {
  agent: LogisticsAgent
}

export function LogisticsAgentForm({ agent }: LogisticsAgentFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<string[]>(agent.services || [])
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

    const result = await updateLogisticsAgent(agent.id, formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/logistics')
  }

  const handleDelete = async () => {
    if (!confirm('この物流エージェントを削除しますか？')) return

    setLoading(true)
    const result = await deleteLogisticsAgent(agent.id)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/logistics')
  }

  return (
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
              defaultValue={agent.name}
              required
              className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#888] font-body mb-1">
              英語名
            </label>
            <input
              type="text"
              name="name_en"
              defaultValue={agent.name_en || ''}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
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
            defaultValue={agent.agent_type}
            required
            className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
          >
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
              defaultValue={agent.contact_name || ''}
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
              defaultValue={agent.contact_info || ''}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-3 py-2 text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            />
          </div>
        </div>

        {/* Primary */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_primary"
            id="is_primary"
            defaultChecked={agent.is_primary}
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
            defaultValue={agent.notes || ''}
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

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] py-3 text-[13px] font-body font-medium disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-3 bg-white text-[#e5a32e] border border-[#e5a32e] rounded-[8px] text-[13px] font-body font-medium disabled:opacity-50"
          >
            削除
          </button>
        </div>
      </div>
    </form>
  )
}
