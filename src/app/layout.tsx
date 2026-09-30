import type { Metadata } from 'next'
import localFont from 'next/font/local'
import '@/styles/globals.css'

// F&C Design System: 英数 = Manrope / かなカナ漢字 = M PLUS 2(指定順で自動振り分け)
const manrope = localFont({
  src: '../../public/fonts/Manrope-Variable.woff2',
  weight: '200 800',
  variable: '--font-manrope',
  display: 'swap',
})

const mplus2 = localFont({
  src: '../../public/fonts/MPLUS2-Variable.woff2',
  weight: '100 900',
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
