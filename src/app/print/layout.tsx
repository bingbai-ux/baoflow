// Sprint 13: 印刷用レイアウト (サイドバーなし・白地・A4想定)。
// スタッフ専用 (middleware で保護)。

export const metadata = { robots: { index: false, follow: false } }

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#351E28] font-body">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
        @page { size: A4; margin: 18mm; }
      `}</style>
      <div className="max-w-[720px] mx-auto px-8 py-10">{children}</div>
    </div>
  )
}
