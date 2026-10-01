'use client'
import { useUi } from '@/components/ui/ui-store'

export function StaffContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUi()
  return <div className={'flex-1 flex flex-col min-w-0 min-h-0 ' + (sidebarCollapsed ? '' : 'lg:ml-[236px]')}>{children}</div>
}
