import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeAuthDestination } from '@/lib/utils/auth-routing'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeAuthDestination(searchParams.get('next'))
  let destination = '/login?error=auth_callback_error'

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error && data.session) destination = next
    } catch {
      // Unavailable Auth leaves the user at the same error route as an expired code.
    }
  }

  const response = NextResponse.redirect(new URL(destination, origin))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
