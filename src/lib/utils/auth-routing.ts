/** Match a route segment, not an arbitrary string prefix (e.g. /externality). */
export function isRoute(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`)
}

export function isPublicAuthPath(path: string): boolean {
  return ['/external', '/account-invite', '/auth/callback', '/auth/confirm'].some(root => isRoute(path, root)) ||
    path === '/forgot-password' || path === '/reset-password'
}

/** OAuth redirect destinations must stay on this application. */
export function safeAuthDestination(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\x00-\x20]/.test(next)) return '/'
  return next
}
