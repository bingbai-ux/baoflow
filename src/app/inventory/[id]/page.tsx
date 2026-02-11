import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function InventoryDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('inventory_items')
    .select(`
      *,
      client:clients(company_name)
    `)
    .eq('id', id)
    .single()

  if (!item) {
    notFound()
  }

  const client = Array.isArray(item.client) ? item.client[0] : item.client

  // Get movement history
  const { data: movements } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('inventory_item_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="px-[26px] py-5 space-y-5">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        在庫一覧に戻る
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          {item.product_name}
        </h1>
        <Link
          href={`/inventory/${id}/certificate`}
          className="text-[12px] text-white bg-[#0a0a0a] px-4 py-2 rounded-[8px] font-body font-medium no-underline"
        >
          在庫証明書発行
        </Link>
      </div>

      {/* Item Info */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            在庫情報
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">クライアント</p>
              <p className="text-[13px] text-[#0a0a0a] font-body">{client?.company_name}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">商品名</p>
              <p className="text-[13px] text-[#0a0a0a] font-body">{item.product_name}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">保管場所</p>
              <p className="text-[13px] text-[#0a0a0a] font-body">{item.storage_location || '未設定'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            在庫数量
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">現在庫</p>
              <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
                {item.current_quantity.toLocaleString()}個
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">安全在庫</p>
              <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                {(item.safety_stock || 0).toLocaleString()}個
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Movement History */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            入出庫履歴
          </h2>
        </div>
        {movements && movements.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {movements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${movement.movement_type === 'incoming' ? 'bg-[#22c55e]' : 'bg-[#0a0a0a]'}`} />
                  <div>
                    <p className="text-[13px] text-[#0a0a0a] font-body">
                      {movement.movement_type === 'incoming' ? '入庫' : '出庫'}
                    </p>
                    {movement.notes && (
                      <p className="text-[11px] text-[#888] font-body">{movement.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[13px] font-display tabular-nums ${movement.movement_type === 'incoming' ? 'text-[#22c55e]' : 'text-[#0a0a0a]'}`}>
                    {movement.movement_type === 'incoming' ? '+' : '-'}{movement.quantity.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[#888] font-body">
                    {new Date(movement.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              入出庫履歴はありません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
