import { Sidebar } from '@/components/sidebar'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <Sidebar />
      <main className="ml-[220px] p-6">
        {children}
      </main>
    </div>
  )
}
