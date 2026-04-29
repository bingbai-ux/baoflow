import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DesignGallery } from '@/components/deals/design-gallery'
import { listDesignFiles } from '@/lib/actions/designs'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DesignsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deal } = await supabase
    .from('deals')
    .select('id, deal_code, deal_name')
    .eq('id', id)
    .single()
  if (!deal) notFound()

  const files = await listDesignFiles(id)

  return (
    <>
      <Link
        href={`/deals/${id}`}
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件詳細に戻る
      </Link>

      <div className="py-3">
        <p className="text-[11px] text-[#888] font-body tabular-nums">{deal.deal_code}</p>
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">画像</h1>
        <p className="text-[12px] font-body text-[#888] mt-1">
          商品やデザインの画像をアップロードして案件と紐付けます。
        </p>
      </div>

      <DesignGallery dealId={id} initial={files} />
    </>
  )
}
