import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPublicAuthPath, safeAuthDestination } from '../src/lib/utils/auth-routing'

test('recovery callback and reset page are reachable before a session exists', () => {
  for (const path of ['/auth/callback', '/auth/confirm', '/reset-password', '/forgot-password', '/external/rfq-response/token']) assert.equal(isPublicAuthPath(path), true)
  for (const path of ['/deals', '/externality', '/account-invites', '/auth/confirmation', '/master']) assert.equal(isPublicAuthPath(path), false)
})

test('callback accepts local deep links and rejects external or backslash destinations', () => {
  assert.equal(safeAuthDestination('/reset-password'), '/reset-password')
  assert.equal(safeAuthDestination('/deals?a=b'), '/deals?a=b')
  for (const path of [null, '//evil.test', 'https://evil.test', '/\\evil.test', '/\n/evil.test']) assert.equal(safeAuthDestination(path), '/')
})
