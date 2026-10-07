import {defineConfig} from '@playwright/test'
import base from './playwright.config'
export default defineConfig({...base, testMatch:['account-preparation.spec.ts','account-invite.spec.ts'],use:{...base.use,trace:'off',screenshot:'off',video:'off'}})
