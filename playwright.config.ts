import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defineConfig, devices} from '@playwright/test';

// Workers inherit this value, so evaluating the config in a worker does not
// create another database. Never use the author's local development database.
const databaseDirectory=process.env.WTF_BROWSER_TEST_DIRECTORY ||= mkdtempSync(join(tmpdir(),'wtf-browser-'));
const port=process.env.WTF_BROWSER_TEST_PORT||'4175';

export default defineConfig({
 testDir:'./tests/browser',
 fullyParallel:true,
 workers:2,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 timeout:30_000,
 expect:{timeout:10_000},
 reporter:'list',
 globalTeardown:'./tests/browser/global-teardown.ts',
 use:{
  baseURL:'http://127.0.0.1:'+port,
  trace:'retain-on-failure',
  screenshot:'only-on-failure',
 },
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:{
  command:'npm run build && node scripts/dev.mjs',
  url:'http://127.0.0.1:'+port+'/api/lore',
  reuseExistingServer:false,
  timeout:120_000,
  env:{PORT:port,WTF_DATABASE_PATH:join(databaseDirectory,'browser.sqlite')},
 },
});
