'use client'

export function PrintToolbar() {
  return (
    <div className="no-print flex justify-end gap-2 mb-6">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 hover:brightness-95"
      >
        印刷 / PDF保存
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="rounded-full bg-white border border-[#E2E1DA] text-[#84787D] text-[12px] font-bold px-3 py-2"
      >
        閉じる
      </button>
    </div>
  )
}
