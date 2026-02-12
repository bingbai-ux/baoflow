'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { assignFactoriesToDeal } from '@/lib/actions/factory-assignments'

interface Factory {
  id: string
  factory_name: string
  address: string | null
  specialties: string[] | null
  rating: number | null
}

interface Props {
  params: Promise<{ id: string }>
}

export default function AssignFactoriesPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [factories, setFactories] = useState<Factory[]>([])
  const [selectedFactories, setSelectedFactories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFactories = async () => {
      const supabase = createClient()

      // Fetch all factories
      const { data: factoryData } = await supabase
        .from('factories')
        .select('id, factory_name, address, specialties, rating')
        .order('factory_name')

      // Fetch existing assignments
      const { data: assignmentData } = await supabase
        .from('deal_factory_assignments')
        .select('factory_id')
        .eq('deal_id', id)

      if (factoryData) {
        setFactories(factoryData)
      }

      if (assignmentData) {
        setSelectedFactories(new Set(assignmentData.map(a => a.factory_id)))
      }

      setLoading(false)
    }

    fetchFactories()
  }, [id])

  const toggleFactory = (factoryId: string) => {
    setSelectedFactories(prev => {
      const next = new Set(prev)
      if (next.has(factoryId)) {
        next.delete(factoryId)
      } else {
        next.add(factoryId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedFactories.size === 0) {
      setError('少なくとも1つの工場を選択してください')
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await assignFactoriesToDeal(id, Array.from(selectedFactories))

    if (result.success) {
      router.push(`/deals/${id}`)
    } else {
      setError(result.error || '工場の割り当てに失敗しました')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-[18px]">
        <p className="text-[13px] text-[#888] font-body">読み込み中...</p>
      </div>
    )
  }

  return (
    <>
      <div className="py-[18px]">
        <Link
          href={`/deals/${id}`}
          className="text-[13px] text-[#888] hover:text-[#555] font-body mb-2 inline-block"
        >
          ← 案件詳細
        </Link>
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          工場選定
        </h1>
        <p className="text-[13px] text-[#888] font-body mt-1">
          見積もりを依頼する工場を選択してください（複数選択可）
        </p>
      </div>

      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <div className="space-y-2">
          {factories.map(factory => (
            <label
              key={factory.id}
              className={`flex items-start gap-3 p-4 rounded-[12px] cursor-pointer transition-all ${
                selectedFactories.has(factory.id)
                  ? 'bg-[#f0fdf4] border-2 border-[#22c55e]'
                  : 'bg-[#f2f2f0] border-2 border-transparent hover:bg-[#e8e8e6]'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedFactories.has(factory.id)}
                onChange={() => toggleFactory(factory.id)}
                className="mt-1 w-4 h-4 accent-[#22c55e]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[#0a0a0a] font-body">
                    {factory.factory_name}
                  </span>
                  {factory.rating && (
                    <span className="text-[11px] text-[#888] font-body">
                      ★ {factory.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                {factory.address && (
                  <p className="text-[12px] text-[#888] font-body mt-1">
                    {factory.address}
                  </p>
                )}
                {factory.specialties && factory.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {factory.specialties.map((specialty, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-white px-2 py-0.5 rounded-full text-[#555] font-body"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>

        {factories.length === 0 && (
          <p className="text-[13px] text-[#888] font-body text-center py-8">
            工場が登録されていません
          </p>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-[#fef3c7] rounded-[10px] text-[12px] text-[#92400e] font-body">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedFactories.size === 0}
          className="flex-1 bg-[#22c55e] text-white rounded-[8px] py-3 text-[13px] font-medium font-body disabled:opacity-50 transition-opacity"
        >
          {submitting
            ? '送信中...'
            : `${selectedFactories.size}社に見積もり依頼を送信`}
        </button>
        <Link
          href={`/deals/${id}`}
          className="px-6 py-3 bg-white border border-[#e8e8e6] rounded-[8px] text-[13px] text-[#555] font-body no-underline text-center"
        >
          キャンセル
        </Link>
      </div>
    </>
  )
}
