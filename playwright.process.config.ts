import { defineConfig } from '@playwright/test'
// 再設計（工程1〜）の画面確認用。ローカルの代役DB（tests/fixtures/supabase.mjs）だけに接続する。
export default defineConfig({
  testDir: './tests/e2e', testMatch: /process-stage\d+\.spec\.ts/, workers: 1, timeout: 90000,
  outputDir: 'test-results/process', expect: { timeout: 30000 }, // dev サーバーの初回コンパイル待ち
  use: { baseURL: 'http://127.0.0.1:3100', headless: true, trace: 'off' },
  webServer: [
    { command: 'node tests/fixtures/supabase.mjs', url: 'http://127.0.0.1:55440/__state', reuseExistingServer: false },
    { command: 'npm run dev -- --hostname 127.0.0.1 --port 3100', url: 'http://127.0.0.1:3100/login', timeout: 180000, reuseExistingServer: false, env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55440', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-test-placeholder-no-secret', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100', RESEND_API_KEY: '', ANTHROPIC_API_KEY: 'local-test-placeholder-no-secret', ANTHROPIC_BASE_URL: 'http://127.0.0.1:55440/anthropic', SUPABASE_SERVICE_ROLE_KEY: 'local-test-placeholder-no-secret' } }, // AIは代役（tests/fixtures/supabase.mjs）が決まった返事を返す。外部には接続しない
  ],
})
