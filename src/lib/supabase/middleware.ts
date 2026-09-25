import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 外部フォーム (トークン制の自己登録/RFQ回答) は認証不要 — トークン検証はページ側で行う
  // /account-invite はログイン前後どちらでも開ける (サインアップ→招待受け取り)
  if (
    pathname.startsWith('/external') ||
    pathname.startsWith('/account-invite') ||
    pathname === '/forgot-password'
  ) {
    return supabaseResponse
  }

  // 外部ロールごとのホーム画面 (Sprint 11: logistics = 物流パートナー)
  const ROLE_HOME: Record<string, string> = {
    client: '/portal',
    factory: '/factory',
    logistics: '/logistics',
  }
  const LOGIN_PATHS = ['/login', '/portal/login', '/factory/login', '/logistics/login']

  // Public paths - no auth required
  if (LOGIN_PATHS.includes(pathname)) {
    if (user) {
      // Already logged in - redirect based on role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'sales'
      const home = ROLE_HOME[role] || '/'
      const ownLogin = role in ROLE_HOME ? `${ROLE_HOME[role]}/login` : '/login'
      if (pathname !== ownLogin) {
        return NextResponse.redirect(new URL(home, request.url))
      }
    }
    return supabaseResponse
  }

  // No user - redirect to the matching login
  if (!user) {
    if (pathname.startsWith('/portal')) {
      return NextResponse.redirect(new URL('/portal/login', request.url))
    }
    if (pathname.startsWith('/factory')) {
      return NextResponse.redirect(new URL('/factory/login', request.url))
    }
    if (pathname.startsWith('/logistics')) {
      return NextResponse.redirect(new URL('/logistics/login', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'sales'
  const externalHome = ROLE_HOME[role]

  // Portal routes - only for clients
  if (pathname.startsWith('/portal')) {
    if (role !== 'client') {
      return NextResponse.redirect(new URL(externalHome || '/', request.url))
    }
    return supabaseResponse
  }

  // Factory routes - only for factory users
  if (pathname.startsWith('/factory')) {
    if (role !== 'factory') {
      return NextResponse.redirect(new URL(externalHome || '/', request.url))
    }
    return supabaseResponse
  }

  // Logistics routes - only for logistics partners
  if (pathname.startsWith('/logistics')) {
    if (role !== 'logistics') {
      return NextResponse.redirect(new URL(externalHome || '/', request.url))
    }
    return supabaseResponse
  }

  // 印刷帳票 (在庫証明書・出荷指示書) - スタッフとロジ会社のみ
  if (pathname.startsWith('/print')) {
    if (role === 'admin' || role === 'sales' || role === 'logistics') {
      return supabaseResponse
    }
    return NextResponse.redirect(new URL(externalHome || '/login', request.url))
  }

  // Sales/Admin routes - not for external roles
  const salesRoutes = ['/', '/deals', '/clients', '/factories', '/analytics', '/payments', '/settings', '/registry', '/inventory', '/smart-quote', '/shipments', '/master', '/archive', '/docs']
  const isSalesRoute = salesRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )

  if (isSalesRoute) {
    if (externalHome) {
      return NextResponse.redirect(new URL(externalHome, request.url))
    }
    if (role !== 'admin' && role !== 'sales') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}
