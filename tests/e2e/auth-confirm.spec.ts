import { test, expect } from '@playwright/test'
const fixture = 'http://127.0.0.1:55442'
test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await request.post(fixture + '/__reset')
})

test('server verifies invite and carries session cookies to the human password form', async ({ page, context, request }) => {
  const response = await page.goto('/auth/confirm?token_hash=' + 'a'.repeat(64) + '&type=invite&next=https://outside.example.test')
  await expect(page).toHaveURL('http://localhost:3201/reset-password')
  await expect(page.getByText('新しいパスワードを設定', { exact: true })).toBeVisible()
  expect(response?.request().redirectedFrom()?.url()).toContain('/auth/confirm?')
  expect((await context.cookies()).some(c => c.name.startsWith('sb-127-auth-token'))).toBe(true)
  let state = await (await request.get(fixture + '/__state')).json()
  expect(state).toMatchObject({ verified: 1, updates: 0 })
  await page.getByLabel('新しいパスワード', { exact: true }).fill('synthetic-password-only')
  await page.getByLabel('確認用パスワード', { exact: true }).fill('different-synthetic')
  await page.getByRole('button', { name: 'この内容で設定する' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '確認用パスワードが一致しません' })).toBeVisible()
  state = await (await request.get(fixture + '/__state')).json()
  expect(state.updates).toBe(0)
  await page.getByLabel('確認用パスワード', { exact: true }).fill('synthetic-password-only')
  await page.getByRole('button', { name: 'この内容で設定する' }).click()
  await expect.poll(async () => (await (await request.get(fixture + '/__state')).json()).updates).toBe(1)
})

test('expired invitation cannot reach password form or create session cookies', async ({ request, context }) => {
  const response = await request.get('/auth/confirm?token_hash=' + 'e'.repeat(64) + '&type=invite', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe('http://localhost:3201/login?error=auth_callback_error')
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(response.headers()['referrer-policy']).toBe('no-referrer')
  expect((await context.cookies()).filter(c => c.name.startsWith('sb-127-auth-token'))).toHaveLength(0)
})

test('missing hash and unsupported types never call Auth verification', async ({ request }) => {
  for (const query of ['type=invite', 'token_hash=' + 'a'.repeat(64) + '&type=recovery', 'token_hash=' + 'a'.repeat(64) + '&type=signup']) {
    const response = await request.get('/auth/confirm?' + query, { maxRedirects: 0 })
    expect(response.headers().location).toBe('http://localhost:3201/login?error=auth_callback_error')
  }
  expect((await (await request.get(fixture + '/__state')).json()).verified).toBe(0)
})

test('used invitation cannot be accepted again', async ({ request }) => {
  const url = '/auth/confirm?token_hash=' + 'a'.repeat(64) + '&type=invite'
  const first = await request.get(url, { maxRedirects: 0 })
  expect(first.headers().location).toBe('http://localhost:3201/reset-password')
  const second = await request.get(url, { maxRedirects: 0 })
  expect(second.headers().location).toBe('http://localhost:3201/login?error=auth_callback_error')
})
