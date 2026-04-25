import { createClient } from '@/lib/supabase/server'

export default async function CatalogPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          Catalog
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items && items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5"
            >
              {item.images && item.images[0] && (
                <div className="w-full h-32 bg-[#f2f2f0] rounded-[10px] mb-3 overflow-hidden">
                  <img
                    src={item.images[0]}
                    alt={item.product_type_ja || ''}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <h3 className="text-[14px] font-body font-medium text-[#0a0a0a] mb-1">
                {item.product_type_ja || item.product_type_en}
              </h3>
              <p className="text-[12px] text-[#888] font-body mb-2">
                {item.description_ja || item.description_en}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#888] font-body">
                  MOQ: {item.moq_estimate?.toLocaleString() || '-'}
                </span>
                <span className="text-[11px] text-[#555] font-display tabular-nums">
                  {item.price_range || '-'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
            <p className="text-[13px] text-[#888] font-body">
              カタログアイテムがありません
            </p>
          </div>
        )}
      </div>
    </>
  )
}
