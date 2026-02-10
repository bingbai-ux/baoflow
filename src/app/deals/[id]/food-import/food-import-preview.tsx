'use client'

interface TestReport {
  report_number: string
  testing_agency: string
  test_date: string
  conclusion: string
}

interface ImportData {
  applicantName: string
  applicantAddress: string
  productName: string
  productCategory: string
  material: string
  manufacturerName: string
  manufacturerAddress: string
  quantity: number
  weightKg: number
  registryStatus: 'registered' | 'not_registered' | 'unknown'
  testReport: TestReport | null
  estimatedInspectionCost: number
  dealCode: string
}

interface FoodImportPreviewProps {
  data: ImportData
}

export function FoodImportPreview({ data }: FoodImportPreviewProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div
        className={`rounded-[12px] p-4 ${
          data.registryStatus === 'registered'
            ? 'bg-[#e8f5e9] border border-[#22c55e]'
            : data.registryStatus === 'not_registered'
            ? 'bg-[rgba(229,163,46,0.1)] border border-[#e5a32e]'
            : 'bg-[#f2f2f0] border border-[rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="flex items-center gap-3">
          {data.registryStatus === 'registered' ? (
            <>
              <div className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-body font-medium text-[#0a0a0a]">
                  品目登録済み（検査不要）
                </p>
                <p className="text-[12px] text-[#555] font-body">
                  この製品は品目登録済みです。検査なしで輸入届出が可能です。
                </p>
              </div>
            </>
          ) : data.registryStatus === 'not_registered' ? (
            <>
              <div className="w-8 h-8 rounded-full bg-[#e5a32e] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-body font-medium text-[#0a0a0a]">
                  要検査
                </p>
                <p className="text-[12px] text-[#555] font-body">
                  この製品は品目登録されていません。初回輸入時に検査が必要です。
                </p>
                <p className="text-[12px] text-[#e5a32e] font-body font-medium mt-1">
                  推定検査費用: {data.estimatedInspectionCost.toLocaleString()}円
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-[#888] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-body font-medium text-[#0a0a0a]">
                  確認中
                </p>
                <p className="text-[12px] text-[#555] font-body">
                  品目登録状況を確認中です。
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Test Report Info */}
      {data.testReport && (
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h3 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-3">
            試験成績書
          </h3>
          <div className="grid grid-cols-2 gap-4 text-[12px] font-body">
            <div>
              <span className="text-[#888]">成績書番号</span>
              <p className="text-[#0a0a0a]">{data.testReport.report_number}</p>
            </div>
            <div>
              <span className="text-[#888]">検査機関</span>
              <p className="text-[#0a0a0a]">{data.testReport.testing_agency}</p>
            </div>
            <div>
              <span className="text-[#888]">検査日</span>
              <p className="text-[#0a0a0a]">{data.testReport.test_date}</p>
            </div>
            <div>
              <span className="text-[#888]">結果</span>
              <p className={data.testReport.conclusion === 'pass' ? 'text-[#22c55e]' : 'text-[#e5a32e]'}>
                {data.testReport.conclusion === 'pass' ? '適合' : '不適合'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[12px] font-body font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          届出書を印刷
        </button>
      </div>

      {/* FAINS Document Preview */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-8 print:rounded-none print:border-none print:p-0">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-[20px] font-display font-bold text-[#0a0a0a] mb-1">
            食品等輸入届出書
          </h2>
          <p className="text-[12px] text-[#888] font-body">
            Food Import Notification (FAINS)
          </p>
        </div>

        {/* Applicant */}
        <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-4 mb-4">
          <p className="text-[10px] text-[#888] font-body mb-1">届出者</p>
          <p className="text-[13px] font-body text-[#0a0a0a] font-medium">
            {data.applicantName}
          </p>
          <p className="text-[11px] text-[#555] font-body mt-1">
            {data.applicantAddress || '-'}
          </p>
        </div>

        {/* Product Info */}
        <div className="space-y-3 mb-6">
          <h3 className="text-[12px] font-display font-semibold text-[#0a0a0a]">
            届出品目
          </h3>
          <div className="grid grid-cols-2 gap-4 text-[12px] font-body">
            <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-3">
              <span className="text-[10px] text-[#888] block mb-1">品名</span>
              <span className="text-[#0a0a0a]">{data.productName || '-'}</span>
            </div>
            <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-3">
              <span className="text-[10px] text-[#888] block mb-1">種類</span>
              <span className="text-[#0a0a0a]">{data.productCategory || '-'}</span>
            </div>
            <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-3">
              <span className="text-[10px] text-[#888] block mb-1">材質</span>
              <span className="text-[#0a0a0a]">{data.material || '-'}</span>
            </div>
            <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-3">
              <span className="text-[10px] text-[#888] block mb-1">数量</span>
              <span className="text-[#0a0a0a] font-display tabular-nums">
                {data.quantity.toLocaleString()} 個
              </span>
            </div>
            <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-3">
              <span className="text-[10px] text-[#888] block mb-1">重量</span>
              <span className="text-[#0a0a0a] font-display tabular-nums">
                {data.weightKg ? `${data.weightKg} kg` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Manufacturer */}
        <div className="border border-[rgba(0,0,0,0.06)] rounded-[10px] p-4 mb-6">
          <p className="text-[10px] text-[#888] font-body mb-1">製造者</p>
          <p className="text-[13px] font-body text-[#0a0a0a] font-medium">
            {data.manufacturerName || '-'}
          </p>
          <p className="text-[11px] text-[#555] font-body mt-1">
            {data.manufacturerAddress || '-'}
          </p>
          <p className="text-[10px] text-[#888] font-body mt-2">
            製造国: 中華人民共和国
          </p>
        </div>

        {/* Notes */}
        <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
          <p className="text-[10px] text-[#888] font-body mb-2">備考</p>
          <ul className="text-[11px] text-[#555] font-body space-y-1">
            <li>届出番号: {data.dealCode}</li>
            <li>用途: 食品の容器包装</li>
            <li>輸入港: 未定</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
