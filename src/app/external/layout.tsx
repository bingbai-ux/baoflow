// Sprint 8-2 (§0.5-2): 外部公開フォーム用レイアウト。
// 認証なし・サイドバーなし。社内と同じF&Cトークンを使う。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '(bao) — フォーム',
  description: 'パッケージ製作のための情報をお伺いします',
  robots: { index: false, follow: false },
}

export default function ExternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full font-body"
      style={{
        background: '#FBFAF6', // (bao) クリーム背景
        color: '#351E28',
      }}
    >
      <a href="#external-content" className="sr-only focus:not-sr-only">本文へ移動</a>
      <header
        className="border-b"
        style={{ borderColor: '#E2E1DA', background: '#FBFAF6' }}
      >
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bao-logo.png" alt="(bao)" className="h-[30px] w-auto" />
          <span className="text-[11px] text-[#84787D] mt-2 hidden sm:inline">
            Packaging procurement service
          </span>
        </div>
      </header>
      <main id="external-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-5">{children}</main>
      <footer className="max-w-3xl mx-auto px-6 py-6 mt-8 text-[10px] text-[#84787D]">
        <p>このフォームは BAO Flow を通じて発行されました。送信内容は (bao) のスタッフのみが確認します。</p>
      </footer>
    </div>
  )
}
