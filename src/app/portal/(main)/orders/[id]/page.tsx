import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ClientProgressBar, mapStatusToStep } from '@/components/portal/progress-bar'
import { OrderActions } from './order-actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PortalOrderDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/portal/login')
  }

  // Get client_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    redirect('/portal')
  }

  // Get deal with all related data (excluding factory/cost info)
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      master_status,
      client_id,
      created_at,
      updated_at,
      specifications:deal_specifications(
        product_category,
        product_name,
        height_mm,
        width_mm,
        depth_mm,
        diameter_mm,
        capacity_ml,
        size_notes,
        material_category,
        material_thickness,
        material_notes,
        processing_list,
        lamination,
        processing_notes,
        attachments_list,
        attachment_notes,
        reference_images,
        specification_memo
      ),
      quotes:deal_quotes(
        id,
        quantity,
        selling_price_jpy,
        total_billing_jpy,
        total_billing_tax_jpy,
        status
      ),
      design_files:deal_design_files(
        id,
        file_url,
        file_name,
        version_number,
        is_final,
        created_at
      ),
      shipping:deal_shipping(
        tracking_number,
        tracking_url,
        delivery_address
      ),
      documents:documents(
        id,
        document_type,
        file_url,
        created_at
      ),
      chat_rooms:chat_rooms(
        id,
        room_type
      )
    `)
    .eq('id', id)
    .eq('client_id', profile.client_id)
    .single()

  if (!deal) {
    notFound()
  }

  const spec = deal.specifications?.[0]
  const quote = deal.quotes?.find((q) => q.status === 'approved') || deal.quotes?.[0]
  const shipping = deal.shipping?.[0]
  const finalDesign = deal.design_files?.find((d) => d.is_final)
  const chatRoom = deal.chat_rooms?.find((r) => r.room_type === 'client_sales')

  const currentStep = mapStatusToStep(deal.master_status)

  // Get documents by type
  const quotationDoc = deal.documents?.find((d) => d.document_type === 'quotation')
  const invoiceDoc = deal.documents?.find((d) => d.document_type === 'invoice')
  const deliveryNoteDoc = deal.documents?.find((d) => d.document_type === 'delivery_note')

  // Check if in quote confirmation stage (M06-M10)
  const isQuoteStage = ['M06', 'M07', 'M08', 'M09', 'M10'].includes(deal.master_status)
  const isCompleted = deal.master_status === 'M25'

  return (
    <div className="space-y-5">
      {/* Back Link */}
      <Link
        href="/portal/orders"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        注文一覧に戻る
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
            {spec?.product_name || deal.deal_name || '商品名未設定'}
          </h1>
          <p className="text-[13px] font-display tabular-nums text-[#888] mt-1">
            {deal.deal_code}
          </p>
        </div>
        {quote?.total_billing_tax_jpy && (
          <div className="text-right">
            <p className="text-[11px] text-[#888] font-body">合計金額（税込）</p>
            <p className="text-[24px] font-display tabular-nums font-semibold text-[#0a0a0a]">
              {Math.round(quote.total_billing_tax_jpy).toLocaleString()}円
            </p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-6">
        <ClientProgressBar status={deal.master_status} size="large" />
      </div>

      {/* Action Buttons */}
      <OrderActions
        dealId={deal.id}
        masterStatus={deal.master_status}
        isQuoteStage={isQuoteStage}
        isCompleted={isCompleted}
        chatRoomId={chatRoom?.id}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left Column */}
        <div className="space-y-2">
          {/* Product Specifications */}
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              商品仕様
            </h2>
            {spec ? (
              <div className="space-y-3 text-[12px] font-body">
                {spec.product_category && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">カテゴリ</span>
                    <span className="text-[#0a0a0a]">{spec.product_category}</span>
                  </div>
                )}
                {(spec.height_mm || spec.width_mm || spec.depth_mm) && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">サイズ</span>
                    <span className="text-[#0a0a0a]">
                      {[
                        spec.height_mm && `H${spec.height_mm}`,
                        spec.width_mm && `W${spec.width_mm}`,
                        spec.depth_mm && `D${spec.depth_mm}`,
                      ]
                        .filter(Boolean)
                        .join(' x ')}
                      mm
                    </span>
                  </div>
                )}
                {spec.diameter_mm && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">口径</span>
                    <span className="text-[#0a0a0a]">{spec.diameter_mm}mm</span>
                  </div>
                )}
                {spec.capacity_ml && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">容量</span>
                    <span className="text-[#0a0a0a]">{spec.capacity_ml}ml</span>
                  </div>
                )}
                {spec.material_category && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">素材</span>
                    <span className="text-[#0a0a0a]">{spec.material_category}</span>
                  </div>
                )}
                {spec.material_thickness && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">素材厚み</span>
                    <span className="text-[#0a0a0a]">{spec.material_thickness}</span>
                  </div>
                )}
                {spec.processing_list && spec.processing_list.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">加工</span>
                    <span className="text-[#0a0a0a]">{spec.processing_list.join(', ')}</span>
                  </div>
                )}
                {spec.lamination && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">ラミネーション</span>
                    <span className="text-[#0a0a0a]">{spec.lamination}</span>
                  </div>
                )}
                {spec.attachments_list && spec.attachments_list.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">付属</span>
                    <span className="text-[#0a0a0a]">{spec.attachments_list.join(', ')}</span>
                  </div>
                )}
                {spec.specification_memo && (
                  <div className="pt-2 border-t border-[rgba(0,0,0,0.06)]">
                    <span className="text-[#888] block mb-1">備考</span>
                    <span className="text-[#0a0a0a] whitespace-pre-wrap">{spec.specification_memo}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-[#888] font-body">仕様情報がありません</p>
            )}
          </div>

          {/* Order Info */}
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              注文情報
            </h2>
            <div className="space-y-3 text-[12px] font-body">
              {quote?.quantity && (
                <div className="flex justify-between">
                  <span className="text-[#888]">数量</span>
                  <span className="text-[#0a0a0a] font-display tabular-nums">
                    {quote.quantity.toLocaleString()}個
                  </span>
                </div>
              )}
              {quote?.selling_price_jpy && (
                <div className="flex justify-between">
                  <span className="text-[#888]">単価</span>
                  <span className="text-[#0a0a0a] font-display tabular-nums">
                    {Number(quote.selling_price_jpy).toLocaleString()}円
                  </span>
                </div>
              )}
              {quote?.total_billing_jpy && (
                <div className="flex justify-between">
                  <span className="text-[#888]">小計</span>
                  <span className="text-[#0a0a0a] font-display tabular-nums">
                    {Math.round(quote.total_billing_jpy).toLocaleString()}円
                  </span>
                </div>
              )}
              {quote?.total_billing_tax_jpy && (
                <div className="flex justify-between pt-2 border-t border-[rgba(0,0,0,0.06)]">
                  <span className="text-[#888] font-medium">合計（税込）</span>
                  <span className="text-[#0a0a0a] font-display tabular-nums font-semibold">
                    {Math.round(quote.total_billing_tax_jpy).toLocaleString()}円
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[rgba(0,0,0,0.06)]">
                <span className="text-[#888]">依頼日</span>
                <span className="text-[#0a0a0a]">
                  {new Date(deal.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-2">
          {/* Design Files */}
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              デザインデータ
            </h2>
            {finalDesign ? (
              <div className="space-y-3">
                <div className="p-3 bg-[#f2f2f0] rounded-[10px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-body text-[#0a0a0a]">
                        {finalDesign.file_name || '最終確定版'}
                      </p>
                      <p className="text-[10px] text-[#888] font-body">
                        v{finalDesign.version_number} - 最終確定
                      </p>
                    </div>
                    {finalDesign.file_url && (
                      <a
                        href={finalDesign.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#0a0a0a] font-body underline"
                      >
                        ダウンロード
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : deal.design_files && deal.design_files.length > 0 ? (
              <div className="space-y-2">
                {deal.design_files.map((file) => (
                  <div key={file.id} className="p-3 bg-[#f2f2f0] rounded-[10px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[12px] font-body text-[#0a0a0a]">
                          {file.file_name || `v${file.version_number}`}
                        </p>
                        <p className="text-[10px] text-[#888] font-body">
                          v{file.version_number}
                        </p>
                      </div>
                      {file.file_url && (
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#0a0a0a] font-body underline"
                        >
                          ダウンロード
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#888] font-body">デザインデータはまだありません</p>
            )}
          </div>

          {/* Tracking Info */}
          {currentStep >= 5 && (
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
              <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
                配送情報
              </h2>
              {shipping?.tracking_number ? (
                <div className="space-y-3 text-[12px] font-body">
                  <div className="flex justify-between">
                    <span className="text-[#888]">トラッキング番号</span>
                    <span className="text-[#0a0a0a] font-display tabular-nums">
                      {shipping.tracking_number}
                    </span>
                  </div>
                  {shipping.tracking_url && (
                    <a
                      href={shipping.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-[#0a0a0a] text-white rounded-[8px] py-2 text-[12px] font-body no-underline"
                    >
                      配送状況を確認
                    </a>
                  )}
                  {shipping.delivery_address && (
                    <div className="pt-2 border-t border-[rgba(0,0,0,0.06)]">
                      <span className="text-[#888] block mb-1">配送先</span>
                      <span className="text-[#0a0a0a]">{shipping.delivery_address}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-[#888] font-body">配送情報は準備中です</p>
              )}
            </div>
          )}

          {/* Documents */}
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              帳票ダウンロード
            </h2>
            <div className="space-y-2">
              {/* Quotation - show at step 2+ */}
              {currentStep >= 2 && (
                <a
                  href={quotationDoc?.file_url || `/portal/orders/${deal.id}/pdf?type=quotation`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between p-3 rounded-[10px] no-underline ${
                    quotationDoc ? 'bg-[#f2f2f0] hover:bg-[#e8e8e6]' : 'bg-[#f2f2f0] opacity-50 pointer-events-none'
                  }`}
                >
                  <span className="text-[12px] font-body text-[#0a0a0a]">見積書</span>
                  <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}

              {/* Invoice - show at step 3+ */}
              {currentStep >= 3 && (
                <a
                  href={invoiceDoc?.file_url || `/portal/orders/${deal.id}/pdf?type=invoice`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between p-3 rounded-[10px] no-underline ${
                    invoiceDoc ? 'bg-[#f2f2f0] hover:bg-[#e8e8e6]' : 'bg-[#f2f2f0] opacity-50 pointer-events-none'
                  }`}
                >
                  <span className="text-[12px] font-body text-[#0a0a0a]">請求書</span>
                  <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}

              {/* Delivery Note - show at step 7 */}
              {currentStep >= 7 && (
                <a
                  href={deliveryNoteDoc?.file_url || `/portal/orders/${deal.id}/pdf?type=delivery_note`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between p-3 rounded-[10px] no-underline ${
                    deliveryNoteDoc ? 'bg-[#f2f2f0] hover:bg-[#e8e8e6]' : 'bg-[#f2f2f0] opacity-50 pointer-events-none'
                  }`}
                >
                  <span className="text-[12px] font-body text-[#0a0a0a]">納品書</span>
                  <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}

              {currentStep < 2 && (
                <p className="text-[12px] text-[#888] font-body text-center py-2">
                  帳票は見積もり確定後にダウンロードできます
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
