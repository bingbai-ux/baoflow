import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { UiProvider } from '@/components/ui/ui-store'
import { ToastHost } from '@/components/ui/toast-host'
import { CmdK } from '@/components/shell/cmdk'
import { NotifPopover } from '@/components/shell/notif-popover'
import { searchAll } from '@/lib/actions/search'
import { listNotifications } from '@/lib/actions/notifications'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Pre-fetch initial data for CmdK + Notifications so they appear instantly
  const [searchSeed, notifications] = await Promise.all([
    searchAll(''),
    listNotifications(),
  ])

  return (
    <UiProvider>
      <div className="flex h-screen w-full bg-[#f6f5f2] overflow-hidden">
        <Sidebar />
        <div className="ml-[64px] flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto px-5 pb-6">{children}</main>
        </div>
      </div>
      <ToastHost />
      <CmdK initial={searchSeed} />
      <NotifPopover initial={notifications} />
    </UiProvider>
  )
}
