import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// The Invite user email template sends TokenHash here. The server writes the
// verified session to cookies before showing the password form.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  let destination = '/login?error=auth_callback_error'

  if (type === 'invite' && hash && hash.length <= 512 && !/\s/.test(hash)) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: hash, type: 'invite' })
      if (!error && data.session) destination = '/reset-password'
    } catch {
      // Expired links and unavailable Auth both leave the user at login.
    }
  }

  const response = NextResponse.redirect(new URL(destination, url.origin))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
