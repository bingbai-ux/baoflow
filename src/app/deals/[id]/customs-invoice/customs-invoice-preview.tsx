'use client'

interface InvoiceData {
  sellerName: string
  sellerAddress: string
  buyerName: string
  buyerAddress: string
  importerName: string
  importerAddress: string
  productName: string
  productCategory: string
  material: string
  usage: string
  quantity: number
  unitPriceUsd: number
  totalUsd: number
  cartonCount: number
  weightKg: number
  cbm: number
  hsCode: string
  tariffRate: number
  dealCode: string
  invoiceDate: string
}

interface CustomsInvoicePreviewProps {
  data: InvoiceData
}

export function CustomsInvoicePreview({ data }: CustomsInvoicePreviewProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[12px] font-body font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          印刷
        </button>
      </div>

      {/* Invoice Preview */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-8 print:rounded-none print:border-none print:p-0">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-[24px] font-display font-bold text-[#0a0a0a] mb-1">
            COMMERCIAL INVOICE
          </h2>
          <p className="text-[12px] text-[#888] font-body">
            通関用インボイス
          </p>
        </div>

        {/* Invoice Info */}
        <div className="flex justify-between mb-6 text-[12px] font-body">
          <div>
            <span className="text-[#888]">Invoice No:</span>
            <span className="ml-2 text-[#0a0a0a] font-display tabular-nums">{data.dealCode}</span>
          </div>
          <div>
            <span className="text-[#888]">Date:</span>
            <span className="ml-2 text-[#0a0a0a]">{data.invoiceDate}</span>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Seller */}
          <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-4">
            <p className="text-[10px] text-[#888] font-body mb-1">SELLER / EXPORTER</p>
            <p className="text-[13px] font-body text-[#0a0a0a] font-medium">
              {data.sellerName || '-'}
            </p>
            <p className="text-[11px] text-[#555] font-body mt-1">
              {data.sellerAddress || '-'}
            </p>
          </div>

          {/* Buyer */}
          <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-4">
            <p className="text-[10px] text-[#888] font-body mb-1">BUYER / CONSIGNEE</p>
            <p className="text-[13px] font-body text-[#0a0a0a] font-medium">
              {data.buyerName}
            </p>
            <p className="text-[11px] text-[#555] font-body mt-1">
              {data.buyerAddress || '-'}
            </p>
          </div>
        </div>

        {/* Importer */}
        <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-4 mb-6">
          <p className="text-[10px] text-[#888] font-body mb-1">IMPORTER</p>
          <p className="text-[13px] font-body text-[#0a0a0a] font-medium">
            {data.importerName}
          </p>
          <p className="text-[11px] text-[#555] font-body mt-1">
            {data.importerAddress || '-'}
          </p>
        </div>

        {/* Product Table */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-[#0a0a0a]">
              <th className="text-left text-[10px] font-medium text-[#888] font-body py-2">
                DESCRIPTION
              </th>
              <th className="text-left text-[10px] font-medium text-[#888] font-body py-2">
                MATERIAL
              </th>
              <th className="text-left text-[10px] font-medium text-[#888] font-body py-2">
                HS CODE
              </th>
              <th className="text-right text-[10px] font-medium text-[#888] font-body py-2">
                QTY
              </th>
              <th className="text-right text-[10px] font-medium text-[#888] font-body py-2">
                UNIT PRICE
              </th>
              <th className="text-right text-[10px] font-medium text-[#888] font-body py-2">
                AMOUNT
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[rgba(0,0,0,0.06)]">
              <td className="py-3">
                <p className="text-[12px] font-body text-[#0a0a0a]">
                  {data.productName || '-'}
                </p>
                <p className="text-[10px] text-[#888] font-body">
                  {data.productCategory}
                </p>
              </td>
              <td className="py-3 text-[12px] font-body text-[#0a0a0a]">
                {data.material || '-'}
              </td>
              <td className="py-3 text-[12px] font-display tabular-nums text-[#0a0a0a]">
                {data.hsCode || '-'}
              </td>
              <td className="py-3 text-right text-[12px] font-display tabular-nums text-[#0a0a0a]">
                {data.quantity.toLocaleString()} PCS
              </td>
              <td className="py-3 text-right text-[12px] font-display tabular-nums text-[#0a0a0a]">
                ${Number(data.unitPriceUsd).toFixed(4)}
              </td>
              <td className="py-3 text-right text-[12px] font-display tabular-nums text-[#0a0a0a] font-semibold">
                ${Number(data.totalUsd).toFixed(2)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#0a0a0a]">
              <td colSpan={5} className="py-3 text-right text-[12px] font-body text-[#0a0a0a] font-medium">
                TOTAL (USD)
              </td>
              <td className="py-3 text-right text-[14px] font-display tabular-nums text-[#0a0a0a] font-bold">
                ${Number(data.totalUsd).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Packing Info */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#f2f2f0] rounded-[10px] p-4">
            <p className="text-[10px] text-[#888] font-body mb-1">CARTONS</p>
            <p className="text-[16px] font-display tabular-nums font-semibold text-[#0a0a0a]">
              {data.cartonCount || '-'}
            </p>
          </div>
          <div className="bg-[#f2f2f0] rounded-[10px] p-4">
            <p className="text-[10px] text-[#888] font-body mb-1">GROSS WEIGHT</p>
            <p className="text-[16px] font-display tabular-nums font-semibold text-[#0a0a0a]">
              {data.weightKg ? `${data.weightKg} KG` : '-'}
            </p>
          </div>
          <div className="bg-[#f2f2f0] rounded-[10px] p-4">
            <p className="text-[10px] text-[#888] font-body mb-1">CBM</p>
            <p className="text-[16px] font-display tabular-nums font-semibold text-[#0a0a0a]">
              {data.cbm ? data.cbm.toFixed(3) : '-'}
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
          <p className="text-[10px] text-[#888] font-body mb-2">REMARKS</p>
          <ul className="text-[11px] text-[#555] font-body space-y-1">
            <li>Country of Origin: CHINA</li>
            <li>Terms of Payment: T/T</li>
            <li>Incoterm: EXW / FOB</li>
            {data.hsCode && (
              <li>HS Code: {data.hsCode} (Tariff Rate: {data.tariffRate}%)</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
