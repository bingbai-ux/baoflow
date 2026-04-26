// Pure types for search action — kept out of 'use server' file so client components
// can import them without confusing the RSC client manifest.

export type SearchKind = 'deal' | 'client' | 'factory'

export interface SearchHit {
  kind: SearchKind
  id: string
  title: string
  sub: string
  badge: string
  href: string
}
