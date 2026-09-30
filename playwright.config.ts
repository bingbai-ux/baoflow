import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./tests/e2e', workers:1, timeout:60000,
  use:{baseURL:'http://127.0.0.1:3100',headless:true,channel:'chrome',trace:'retain-on-failure'},
  webServer:[
    {command:'node tests/fixtures/supabase.mjs',url:'http://127.0.0.1:55440/__state',reuseExistingServer:false},
    {command:'npm run dev -- --hostname 127.0.0.1 --port 3100',url:'http://127.0.0.1:3100/login',timeout:120000,reuseExistingServer:false,env:{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55440',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-placeholder-no-secret'}},
  ],
})
