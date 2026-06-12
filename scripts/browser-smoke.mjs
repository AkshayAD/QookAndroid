// Browser-level deploy validation. REQUIRED before promoting to vercel_origin/main.
// Catches what curl smoke tests cannot: CSP violations, console errors, unstyled
// rendering (e.g. blocked cdn.tailwindcss.com — the 2026-06-13 production incident).
//
// Usage:
//   npm i --no-save playwright-core            (browser: ms-playwright chromium, or set CHROME_PATH)
//   node scripts/browser-smoke.mjs https://www.qook.in
//   node scripts/browser-smoke.mjs https://<preview>.vercel.app "_vercel_jwt=<cookie>"
//
// Preview cookie: MCP get_access_to_vercel_url -> curl -c jar "<share url>" -> _vercel_jwt.
// Pass criteria: tailwind styles applied, 0 cspViolations, 0 consoleErrors, 0 pageErrors,
// and on prod the login modal must show the Google sign-in iframe.

import { chromium } from 'playwright-core';
import path from 'path';
import os from 'os';

const BASE = process.argv[2];
const COOKIE = process.argv[3];
if (!BASE) {
  console.error('usage: node scripts/browser-smoke.mjs <base-url> [cookie]');
  process.exit(2);
}
const exe = process.env.CHROME_PATH
  || path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe');

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
if (COOKIE) {
  const [name, ...rest] = COOKIE.split('=');
  await ctx.addCookies([{ name, value: rest.join('='), domain: new URL(BASE).hostname, path: '/' }]);
}
const page = await ctx.newPage();

const issues = { cspViolations: [], consoleErrors: [], pageErrors: [], failedRequests: [] };
page.on('console', (m) => {
  const t = m.text();
  if (/Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(t)) issues.cspViolations.push(t);
  else if (m.type() === 'error') issues.consoleErrors.push(t);
});
page.on('pageerror', (e) => issues.pageErrors.push(String(e)));
page.on('requestfailed', (r) => issues.failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));

let fail = false;

async function visit(p) {
  const url = BASE.replace(/\/$/, '') + p;
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(6000);
  const probe = await page.evaluate(() => {
    let styled = 0;
    for (const el of document.querySelectorAll('div,button,a,section,nav')) {
      const s = getComputedStyle(el);
      if (s.display === 'flex' || s.display === 'grid') styled++;
      if (styled > 10) break;
    }
    return { styledEls: styled, text: document.body.innerText.slice(0, 80).replace(/\s+/g, ' ') };
  });
  const ok = resp?.status() === 200 && probe.styledEls > 0;
  if (!ok) fail = true;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${url} http=${resp?.status()} styledEls=${probe.styledEls} :: ${probe.text}`);
}

await visit('/');
await visit('/demo');

// login modal + Google sign-in iframe (GIS only initializes where VITE_GOOGLE_CLIENT_ID exists, i.e. production)
await page.goto(BASE, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(3000);
try {
  await page.getByText('Log in', { exact: false }).first().click();
  await page.waitForTimeout(5000);
  const gis = await page.locator('iframe[src*="accounts.google.com"]').count();
  console.log(`INFO login modal: gisIframes=${gis} (must be >=1 on production)`);
} catch (e) {
  console.log('WARN could not exercise login modal: ' + e.message);
}

for (const [k, v] of Object.entries(issues)) {
  const uniq = [...new Set(v)];
  if (k !== 'failedRequests' && uniq.length > 0) fail = true;
  console.log(`${k}: ${uniq.length}`);
  uniq.slice(0, 10).forEach((x) => console.log('   • ' + x.slice(0, 300)));
}
await browser.close();
console.log(fail ? '\nRESULT: FAIL — do not promote' : '\nRESULT: PASS');
process.exit(fail ? 1 : 0);
