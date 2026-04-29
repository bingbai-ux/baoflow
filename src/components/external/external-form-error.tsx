// Sprint 8-2: 外部フォームのエラー画面 (期限切れ / 既に送信済 / 無効化 等)。

import { AlertCircle } from 'lucide-react'

export function ExternalFormError({ message }: { message: string }) {
  return (
    <div className="bg-white border rounded-[12px] p-8 text-center" style={{ borderColor: 'rgba(229,163,46,0.3)' }}>
      <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#c0392b' }} />
      <p className="font-display text-[18px] font-semibold mb-2">フォームを表示できません</p>
      <p className="text-[13px] text-[#555]">{message}</p>
      <p className="text-[11px] text-[#888] mt-4">
        URL に誤りがある可能性があります。kokon のご担当者にお問い合わせください。
      </p>
    </div>
  )
}

export function ExternalFormSuccess({ message }: { message: string }) {
  return (
    <div className="bg-white border rounded-[12px] p-8 text-center" style={{ borderColor: 'rgba(34,197,94,0.3)' }}>
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#e7f0e6] text-[#15803d] text-[24px] mb-3">
        ✓
      </span>
      <p className="font-display text-[18px] font-semibold mb-2">送信ありがとうございました</p>
      <p className="text-[13px] text-[#555]">{message}</p>
      <p className="text-[11px] text-[#888] mt-4">このフォームを閉じても問題ありません。</p>
    </div>
  )
}
