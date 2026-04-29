// Sprint 8-2 (§0.5-2): 外部公開フォーム用レイアウト。
// 認証なし・サイドバーなし・kokon ブランド (オレンジ + クリーム背景)。
// CLAUDE.md のモノクロ + 緑デザインから意図的に離れて、外部に対する温かみを演出。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'kokon — フォーム',
  description: 'パッケージ製作のための情報をお伺いします',
  robots: { index: false, follow: false },
}

export default function ExternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full font-body"
      style={{
        background: '#fefdf8', // kokon クリーム背景
        color: '#1a1a1a',
      }}
    >
      <header
        className="border-b"
        style={{ borderColor: 'rgba(229,163,46,0.2)', background: '#fefdf8' }}
      >
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <span
            className="font-display font-bold text-[28px] tracking-tight"
            style={{ color: '#e5a32e' }}
          >
            kokon
          </span>
          <span className="text-[11px] text-[#888] mt-2 hidden sm:inline">
            Packaging procurement service
          </span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
      <footer className="max-w-3xl mx-auto px-6 py-6 mt-8 text-[10px] text-[#888]">
        <p>このフォームは BAO Flow を通じて発行されました。送信内容は kokon のスタッフのみが確認します。</p>
      </footer>
    </div>
  )
}
