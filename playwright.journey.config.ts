import {defineConfig} from '@playwright/test'
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'invite-journey.spec.ts',workers:1,timeout:60000,
 use:{baseURL:'http://localhost:3202',headless:true,channel:'chrome',trace:'off',screenshot:'off',video:'off'},
 webServer:[
  {command:'node tests/fixtures/invite-journey.mjs',url:'http://127.0.0.1:55443/__state',reuseExistingServer:false},
  {command:'npm run dev -- --hostname 127.0.0.1 --port 3202',url:'http://localhost:3202/login',timeout:120000,reuseExistingServer:false,env:{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55443',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-placeholder-no-secret',NEXT_PUBLIC_APP_URL:'http://localhost:3202',RESEND_API_KEY:''}},
 ],
})
