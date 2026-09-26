import { Suspense } from 'react'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { UiProvider } from '@/components/ui/ui-store'
import { ToastHost } from '@/components/ui/toast-host'
import { CmdK } from '@/components/shell/cmdk'
import { NotifPopover } from '@/components/shell/notif-popover'
export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CmdK / 通知のデータは「開いた瞬間」にクライアント側から取得する。
  // 以前はここで毎ページ事前フェッチしており、全ページの表示を遅くしていた。
  return (
    <UiProvider>
      <div className="flex h-screen w-full bg-[#EFEFEA] overflow-hidden">
        {/* useSearchParams (タブ判定) を使うため Suspense が必要 */}
        <Suspense fallback={<aside className="fixed left-0 top-0 h-screen w-[236px] bg-[#351E28] z-50" />}>
          <Sidebar />
        </Suspense>
        <div className="ml-[236px] flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto px-5 pb-6">{children}</main>
        </div>
      </div>
      <ToastHost />
      <CmdK />
      <NotifPopover />
    </UiProvider>
  )
}
