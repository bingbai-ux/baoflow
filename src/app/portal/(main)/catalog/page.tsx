import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PortalCatalogPage() {
  const supabase = await createClient()

  // Get visible catalog items
  const { data: items } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
    .order('category', { ascending: true })

  // Group by category with explicit typing
  const categories: Record<string, typeof items> = {}

  if (items) {
    for (const item of items) {
      const cat = item.category || 'その他'
      if (!categories[cat]) {
        categories[cat] = []
      }
      categories[cat]!.push(item)
    }
  }

  const categoryNames = Object.keys(categories).sort()

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          Catalog
        </h1>
        <Link
          href="/portal/request"
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-[13px] py-[7px] text-[12px] font-body font-medium no-underline"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          見積もり依頼
        </Link>
      </div>

      {/* Category Filter */}
      {categoryNames.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {categoryNames.map((cat) => (
            <span
              key={cat}
              className="px-3 py-1.5 bg-white rounded-full text-[12px] font-body text-[#555] border border-[rgba(0,0,0,0.06)]"
            >
              {cat} ({categories[cat]?.length || 0})
            </span>
          ))}
        </div>
      )}

      {/* Catalog Items */}
      {categoryNames.length > 0 ? (
        <div className="space-y-6">
          {categoryNames.map((category) => (
            <div key={category}>
              <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-3">
                {category}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {categories[category]?.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] overflow-hidden"
                  >
                    {/* Image */}
                    <div className="aspect-square bg-[#f2f2f0] flex items-center justify-center">
                      {item.images && item.images.length > 0 ? (
                        <img
                          src={item.images[0]}
                          alt={item.product_type_ja || ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-12 h-12 text-[#ddd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-[13px] font-body font-medium text-[#0a0a0a] mb-1">
                        {item.product_type_ja}
                      </h3>
                      {item.description_ja && (
                        <p className="text-[11px] text-[#888] font-body mb-3 line-clamp-2">
                          {item.description_ja}
                        </p>
                      )}

                      <div className="space-y-1 text-[11px] font-body mb-3">
                        {item.price_range && (
                          <div className="flex justify-between">
                            <span className="text-[#888]">参考価格</span>
                            <span className="text-[#0a0a0a]">{item.price_range}</span>
                          </div>
                        )}
                        {item.moq_estimate && (
                          <div className="flex justify-between">
                            <span className="text-[#888]">MOQ</span>
                            <span className="text-[#0a0a0a] font-display tabular-nums">
                              {item.moq_estimate.toLocaleString()}個
                            </span>
                          </div>
                        )}
                        {item.material_display && (
                          <div className="flex justify-between">
                            <span className="text-[#888]">素材</span>
                            <span className="text-[#0a0a0a]">{item.material_display}</span>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/portal/request?catalog_item_id=${item.id}`}
                        className="block w-full text-center bg-[#0a0a0a] text-white rounded-[8px] py-2 text-[12px] font-body font-medium no-underline"
                      >
                        この商品で見積もり依頼
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#888] font-body mb-4">
            カタログ商品はまだ登録されていません
          </p>
          <Link
            href="/portal/request"
            className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[12px] font-body font-medium no-underline"
          >
            自由入力で見積もり依頼
          </Link>
        </div>
      )}
    </div>
  )
}
