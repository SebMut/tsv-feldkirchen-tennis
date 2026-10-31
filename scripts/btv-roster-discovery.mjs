// Discovery only: verify the authorized TSV Feldkirchen Downloads section.
// No PDF download, user data capture, screenshots, cookies, or external uploads.
// Output is restricted to fixed status flags, never private page content/URLs.
import { chromium } from 'playwright';

const ENTRY = 'https://www.btv.de/de/mein-verein/vereins-cockpit.html';
const LOGIN_HOST = 'tende-id.liga.nu';
const ALLOWED_HOSTS = new Set(['www.btv.de', 'btv.de', 'btv.liga.nu', LOGIN_HOST]);
const CLUB = /TSV\s+Feldkirchen/i;
const CLUB_NUMBER = /\b01012\b/;
const USERNAME = process.env.BTV_LOGIN_USERNAME;
const PASSWORD = process.env.BTV_LOGIN_PASSWORD;

class DiscoveryError extends Error {}
function fail(code) { throw new DiscoveryError(code); }

function trusted(page) {
  try {
    const url = new URL(page.url());
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
  } catch { return false; }
}
async function visiblePages(context) {
  const results = [];
  for (const page of context.pages()) {
    if (!trusted(page) || new URL(page.url()).hostname === LOGIN_HOST) continue;
    const text = await page.locator('body').innerText({ timeout: 12000 }).catch(() => '');
    results.push({ page, text });
  }
  return results;
}
async function startClubProcesses(page) {
  const start = page.getByRole('button', { name: /^start$/i }).first();
  if (await start.count() === 1 && await start.isVisible()) {
    await start.click();
    // BTV may open nuLiga in a new tab; let that tab finish loading.
    await page.waitForTimeout(1800);
  }
}
async function confirmClub(context) {
  let pages = await visiblePages(context);
  // If several clubs are offered, select only an explicit TSV Feldkirchen control.
  for (const { page, text } of pages) {
    if (CLUB.test(text) && CLUB_NUMBER.test(text)) return page;
  }
  for (const { page } of pages) {
    const clubLink = page.getByRole('link', { name: /TSV Feldkirchen(?:\s*\(01012\))?/i }).first();
    if (await clubLink.count() === 1 && await clubLink.isVisible()) {
      await clubLink.click();
      await page.waitForTimeout(750);
      pages = await visiblePages(context);
      const chosen = pages.find(({ text }) => CLUB.test(text) && CLUB_NUMBER.test(text));
      if (chosen) return chosen.page;
    }
  }
  fail('TSV_SCOPE_NOT_CONFIRMED');
}
async function openDownloads(page) {
  const anchor = page.getByRole('link', { name: /^Downloads$/i }).first();
  const button = page.getByRole('button', { name: /^Downloads$/i }).first();
  const control = await anchor.count() === 1 ? anchor : button;
  if (await control.count() !== 1 || !(await control.isVisible())) {
    fail('DOWNLOADS_MENU_NOT_FOUND');
  }
  const href = await control.getAttribute('href');
  if (href && /\.pdf(?:\?|#|$)/i.test(href)) fail('UNEXPECTED_PDF_LINK');
  await control.click();
  await page.waitForTimeout(700);
}
async function run() {
  if (!USERNAME || !PASSWORD) fail('SECRETS_MISSING');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      acceptDownloads: false,
      serviceWorkers: 'block',
      locale: 'de-DE',
    });
    await context.route('**/*', (route) => {
      try {
        const url = new URL(route.request().url());
        if (url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname)) {
          return route.continue();
        }
      } catch { /* malformed URL */ }
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(ENTRY, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (new URL(page.url()).hostname !== LOGIN_HOST) fail('LOGIN_PROVIDER_UNEXPECTED');

    const password = page.locator('input[type="password"]').first();
    await password.waitFor({ state: 'visible', timeout: 15000 });
    const form = password.locator('xpath=ancestor::form[1]');
    let username = form.locator('input[type="email"], input[autocomplete="username"], input[name*="username" i], input[placeholder*="E-Mail" i]').first();
    if (await username.count() === 0) username = form.locator('input[type="text"]').first();
    if (await username.count() !== 1 || !(await username.isVisible())) fail('LOGIN_FORM_UNAVAILABLE');
    await username.fill(USERNAME);
    await password.fill(PASSWORD);
    let submit = form.locator('button[type="submit"], input[type="submit"]').first();
    if (await submit.count() === 0) submit = form.getByRole('button', { name: /anmelden|login|einloggen/i }).first();
    if (await submit.count() !== 1) fail('LOGIN_BUTTON_UNAVAILABLE');

    // One login attempt only. No password retry and no CAPTCHA/MFA bypass.
    await submit.click();
    await page.waitForURL((url) => url.hostname !== LOGIN_HOST, { timeout: 25000 }).catch(() => {});
    if (new URL(page.url()).hostname === LOGIN_HOST) fail('LOGIN_NOT_CONFIRMED');
    if (!trusted(page)) fail('UNEXPECTED_REDIRECT');
    await page.goto(ENTRY, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (new URL(page.url()).hostname === LOGIN_HOST) fail('SESSION_NOT_CONFIRMED');
    await startClubProcesses(page);

    const clubPage = await confirmClub(context);
    if (!trusted(clubPage)) fail('UNEXPECTED_REDIRECT');
    console.log('BTV_TSV_SCOPE=CONFIRMED');
    await openDownloads(clubPage);
    const scanned = await visiblePages(context);
    const downloadPage = scanned.find(({ text }) => /Namentliche\s+Mannschaftsmeldung|Nam\.\s*Meldung/i.test(text));
    if (!downloadPage) fail('NMM_DOWNLOAD_NOT_DISCOVERED');

    // No PDF links are opened. Neither names nor generated document URLs are logged.
    const content = downloadPage.text;
    console.log('BTV_NMM_DOWNLOAD=AVAILABLE');
    console.log('BTV_SUMMER_2026_LISTED=' + (/Sommer\s*2026/i.test(content) ? 'YES' : 'UNCONFIRMED'));
    console.log('BTV_WINTER_2026_27_LISTED=' + (/Winter\s*2026\s*\/\s*2027/i.test(content) ? 'YES' : 'UNCONFIRMED'));
    console.log('BTV_ROSTER_TRANSFER=NONE');
    await context.close();
  } finally {
    await browser?.close().catch(() => {});
  }
}
try {
  await run();
  console.log('BTV_ROSTER_DISCOVERY=SUCCESS');
} catch (error) {
  // No exception stack/message: browser errors can contain secret-bearing URLs.
  const code = error instanceof DiscoveryError ? error.message : 'BROWSER_OR_PAGE_ERROR';
  console.error('BTV_ROSTER_DISCOVERY=' + code);
  process.exitCode = 1;
}
