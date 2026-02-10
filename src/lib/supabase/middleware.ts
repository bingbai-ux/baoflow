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

  // Public paths - no auth required
  if (pathname === '/login' || pathname === '/portal/login') {
    if (user) {
      // Already logged in - redirect based on role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'client') {
        if (pathname === '/login') {
          return NextResponse.redirect(new URL('/portal', request.url))
        }
      } else {
        if (pathname === '/portal/login') {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    }
    return supabaseResponse
  }

  // No user - redirect to login
  if (!user) {
    if (pathname.startsWith('/portal')) {
      return NextResponse.redirect(new URL('/portal/login', request.url))
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

  // Portal routes - only for clients
  if (pathname.startsWith('/portal')) {
    if (role !== 'client') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  // Sales/Admin routes - not for clients
  const salesRoutes = ['/', '/deals', '/clients', '/factories', '/analytics', '/payments', '/settings', '/registry', '/logistics']
  const isSalesRoute = salesRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )

  if (isSalesRoute) {
    if (role === 'client') {
      return NextResponse.redirect(new URL('/portal', request.url))
    }
    if (role !== 'admin' && role !== 'sales') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}
