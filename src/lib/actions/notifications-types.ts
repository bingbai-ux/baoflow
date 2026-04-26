// Pure types for notifications — kept outside 'use server' file.

export type NotifKind = 'urgent' | 'stale' | 'shipped' | 'paid' | 'mention'

export interface NotifItem {
  id: string
  kind: NotifKind
  icon: string
  title: string
  body: string
  when: string
  dealId?: string | null
}
