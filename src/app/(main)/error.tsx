'use client'

import Link from 'next/link'

export default function PageError() {
  return (
    <section role="alert" className="my-6 max-w-xl rounded-card border border-[#FF5C34] bg-[#FFD8C2] p-6">
      <h1 className="text-[21px] font-extrabold text-[#B03616]">画面を読み込めませんでした</h1>
      <p className="mt-2 text-[14px] text-[#B03616]">入力をやり直す前に、もう一度読み込んでください。保存した内容は各案件の履歴で確認できます。</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-[#351E28] px-5 text-[#C9A2B8] font-bold">もう一度読み込む</button>
        <Link href="/deals" className="min-h-11 inline-flex items-center rounded-full border border-[#E2E1DA] bg-white px-5 text-[#351E28]">案件一覧へ</Link>
      </div>
    </section>
  )
}
