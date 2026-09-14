import type { Metadata } from 'next'
import { Manrope, M_PLUS_2 } from 'next/font/google'
import '@/styles/globals.css'

// F&C Design System: 英数 = Manrope / かなカナ漢字 = M PLUS 2(指定順で自動振り分け)
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

const mplus2 = M_PLUS_2({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-mplus',
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
    <html lang="ja" className={`${manrope.variable} ${mplus2.variable}`}>
      <body className="bg-[#EFEFEA] text-[#351E28] font-body">
        {children}
      </body>
    </html>
  )
}
