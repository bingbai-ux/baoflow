import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'auth-confirm.spec.ts', workers: 1, timeout: 60000,
  use: { baseURL: 'http://localhost:3201', headless: true, channel: 'chrome', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    { command: 'node tests/fixtures/auth-invite.mjs', url: 'http://127.0.0.1:55442/__state', reuseExistingServer: false },
    { command: 'npm run dev -- --hostname 127.0.0.1 --port 3201', url: 'http://localhost:3201/login', timeout: 120000, reuseExistingServer: false,
      env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55442', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-placeholder-no-secret', NEXT_PUBLIC_APP_URL: 'http://localhost:3201', RESEND_API_KEY: '' } },
  ],
})
