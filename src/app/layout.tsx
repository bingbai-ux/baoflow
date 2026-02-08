import type { Metadata } from 'next'
import { Fraunces, Zen_Kaku_Gothic_New } from 'next/font/google'
import '@/styles/globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-zen-kaku',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BAO Flow',
  description: 'パッケージ受発注管理プラットフォーム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className={`${fraunces.variable} ${zenKaku.variable}`}>
      <body className="bg-[#f2f2f0] text-[#0a0a0a] font-body">
        {children}
      </body>
    </html>
  )
}
