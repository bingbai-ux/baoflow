// Sprint 8-2: 外部フォームのエラー画面 (期限切れ / 既に送信済 / 無効化 等)。

import { AlertCircle } from 'lucide-react'

export function ExternalFormError({ message }: { message: string }) {
  return (
    <div role="alert" className="bg-white border rounded-card p-8 text-center" style={{ borderColor: '#FF5C34' }}>
      <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#B03616' }} />
      <h1 className="font-display text-[21px] font-bold mb-2">フォームを表示できません</h1>
      <p className="text-[13px] text-[#351E28]">{message}</p>
      <p className="text-[11px] text-[#84787D] mt-4">
        リンクを送った (bao) の担当者に、表示された理由を伝えて新しいリンクを依頼してください。
      </p>
    </div>
  )
}

export function ExternalFormSuccess({ message }: { message: string }) {
  return (
    <div className="bg-white border rounded-card p-8 text-center" style={{ borderColor: '#E2E1DA' }}>
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#D7EFFF] text-[#33566F] text-[24px] mb-3">
        ✓
      </span>
      <h2 className="font-display text-[21px] font-bold mb-2">送信ありがとうございました</h2>
      <p className="text-[13px] text-[#351E28]">{message}</p>
      <p className="text-[11px] text-[#84787D] mt-4">担当者が内容を確認します。再送は不要です。このフォームを閉じても問題ありません。</p>
    </div>
  )
}
