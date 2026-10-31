// TSV Feldkirchen nMM PDF audit including all youth age-classes.
// One authenticated download, validation and age-class counts only. No names in logs,
// GitHub artifacts, commits, or Supabase. No edit in BTV. Ephemeral runner only.
// Discovery only: verify the authorized TSV Feldkirchen Downloads section.
// No PDF download, user data capture, screenshots, cookies, or external uploads.
// Output is restricted to fixed status flags, never private page content/URLs.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

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
async function selectTsvIfRequired(page) {
  // If several clubs are offered, select only an exact TSV Feldkirchen (01012) option.
  for (const select of await page.locator('select').all()) {
    const found = [];
    for (const option of await select.locator('option').all()) {
      const label = (await option.textContent()) || '';
      if (CLUB.test(label) && CLUB_NUMBER.test(label)) {
        const value = await option.getAttribute('value');
        if (value) found.push(value);
      }
    }
    if (found.length === 1) {
      await select.selectOption(found[0]);
      return true;
    }
  }
  return false;
}
async function startClubProcesses(page) {
  const button = page.getByRole('button', { name: /^start$/i }).first();
  const link = page.getByRole('link', { name: /^start$/i }).first();
  const control = await button.count() === 1 ? button : link;
  if (await control.count() === 1 && await control.isVisible()) {
    await control.click();
    // BTV may open nuLiga in a new tab; let that tab finish loading.
    await page.waitForTimeout(1800);
    return true;
  }
  return false;
}
async function reportScopeDiagnostics(context) {
  const pages = await visiblePages(context);
  const body = pages.map((row) => row.text).join('\n');
  const yesNo = (value) => value ? 'YES' : 'NO';
  console.log('BTV_DIAG_PAGE_COUNT=' + Math.min(pages.length, 9));
  console.log('BTV_DIAG_TSV_NAME=' + yesNo(CLUB.test(body)));
  console.log('BTV_DIAG_TSV_NUMBER=' + yesNo(CLUB_NUMBER.test(body)));
  console.log('BTV_DIAG_NULIGA_PAGE=' + yesNo(pages.some(({ page }) => new URL(page.url()).hostname === 'btv.liga.nu')));
  console.log('BTV_DIAG_DOWNLOADS_TEXT=' + yesNo(/Downloads/i.test(body)));
  console.log('BTV_DIAG_START_TEXT=' + yesNo(/\bSTART\b/i.test(body)));
}
async function confirmClub(context, explicitlySelected) {
  let pages = await visiblePages(context);
  // If several clubs are offered, select only an explicit TSV Feldkirchen control.
  for (const { page, text } of pages) {
    // A multi-club chooser may list TSV without selecting it.\n    if (CLUB.test(text) && CLUB_NUMBER.test(text)\n        && !/Vereinsauswahl|Verein auswählen|Bitte.*Verein.*wählen/i.test(text)) return page;
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
  if (explicitlySelected) {
    const selected = pages.find(({ text }) => /Vereinsprozesse bearbeiten|Downloads/i.test(text));
    if (selected) return selected.page;
  }
  await reportScopeDiagnostics(context);
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

// The nMM includes adult AND youth age-class lists in one club PDF.
// No player names or birth dates are emitted; downloaded bytes remain in the ephemeral runner.
async function inspectVerifiedWinterPdf(context, downloadsPage) {
  const overview = downloadsPage.getByRole('link', { name: /Download.?Übersicht/i }).first();
  if (await overview.count() !== 1) fail('WINTER_DOWNLOAD_OVERVIEW_NOT_FOUND');
  await overview.click();
  await downloadsPage.waitForTimeout(850);

  const season = /Winter\s*2026\s*\/\s*(?:20)?27/i;
  const nmmName = /Namentliche\s+Mannschaftsmeldung|Nam\.?\s*Meldung/i;
  let pages = await visiblePages(context);
  let chosen = null;

  async function findVerifiedWinterRow() {
    for (const { page } of pages) {
      const rows = page.locator('tr').filter({ hasText: season });
      for (const row of await rows.all()) {
        const links = row.getByRole('link', { name: nmmName });
        if (await links.count() === 1) {
          if (chosen) fail('WINTER_NMM_MULTIPLE_LINKS');
          chosen = { page, link: links.first() };
        }
      }
    }
  }

  await findVerifiedWinterRow();
  if (!chosen) {
    // Exact winter season selector only, no guesswork and no alternative club.
    for (const { page } of pages) {
      let selected = false;
      for (const select of await page.locator('select').all()) {
        const options = await select.locator('option').all();
        const matches = [];
        for (const option of options) {
          const label = (await option.textContent() || '').trim();
          if (/^Winter\s*2026\s*\/\s*(?:20)?27$/i.test(label)) {
            const value = await option.getAttribute('value');
            if (value) matches.push(value);
          }
        }
        if (matches.length === 1) {
          await select.selectOption(matches[0]);
          await page.waitForTimeout(950);
          selected = true;
          break;
        }
      }
      if (selected) break;
    }
    pages = await visiblePages(context);
    await findVerifiedWinterRow();
    if (!chosen) {
      const options = [];
      for (const { page, text } of pages) {
        if (!season.test(text)) continue;
        const links = page.getByRole('link', { name: nmmName });
        if (await links.count() === 1) options.push({ page, link: links.first() });
      }
      if (options.length === 1) chosen = options[0];
    }
  }
  if (!chosen) fail('WINTER_NMM_LINK_NOT_FOUND');
  const href = await chosen.link.getAttribute('href');
  if (!href) fail('WINTER_NMM_HREF_MISSING');
  const url = new URL(href, chosen.page.url());
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    fail('WINTER_NMM_ORIGIN_NOT_ALLOWED');
  }
  const downloadPromise = chosen.page.waitForEvent('download', { timeout: 25000 });
  await chosen.link.click();
  const download = await downloadPromise;
  const local = await download.path();
  if (!local) fail('WINTER_NMM_DOWNLOAD_MISSING');
  const raw = readFileSync(local);
  if (raw.length < 1000 || raw.length > 12000000 ||
      raw.subarray(0,4).toString('ascii') !== '%PDF') fail('WINTER_NMM_INVALID_PDF');
  const info = execFileSync('pdfinfo',[local],{encoding:'utf8',timeout:12000});
  const numberOfPages = Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
  if (!numberOfPages || numberOfPages > 50) fail('WINTER_NMM_PDF_PAGES_INVALID');
  const text = execFileSync('pdftotext',['-layout',local,'-'],{
    encoding:'utf8',timeout:25000,maxBuffer:8*1024*1024,
  });
  if (!/TSV\s+Feldkirchen/i.test(text) || !/\b01012\b/.test(text) ||
      !season.test(text)) fail('WINTER_NMM_CLUB_OR_SEASON_MISMATCH');

  // Aggregate diagnostics only. Never log names, rows, birth dates or PDF URLs.
  const lines = text.split(/\r?\n/u);
  const sectionLabels = ['Herren', 'Herren II', 'Herren 50'];
  for (const label of sectionLabels) {
    const matches = lines.filter(line =>
      line.trim().startsWith(label + ' |') ||
      line.trim().startsWith(label + ' (4er) |') ||
      line.trim().startsWith(label + ' -'));
    console.log('BTV_WINTER_NMM_' + label.replace(/\s/g,'_').toUpperCase() + '_SECTIONS=' + matches.length);
  }
  console.log('BTV_WINTER_NMM_PDF=VERIFIED');
  console.log('BTV_WINTER_NMM_PAGES=' + numberOfPages);
  console.log('BTV_WINTER_NMM_NUMBERED_ROWS=' + lines.filter(line =>
    /^\s*\d{1,3}[.)]?\s+\p{L}/u.test(line)).length);
  console.log('BTV_WINTER_NMM_DATA_TRANSFER=NONE');
}

async function run() {
  if (!USERNAME || !PASSWORD) fail('SECRETS_MISSING');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      acceptDownloads: true,
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
    const explicitlySelected = await selectTsvIfRequired(page);
    const startClicked = await startClubProcesses(page);
    console.log('BTV_DIAG_START_CLICKED=' + (startClicked ? 'YES' : 'NO'));

    const clubPage = await confirmClub(context, explicitlySelected && startClicked);
    if (!trusted(clubPage)) fail('UNEXPECTED_REDIRECT');
    console.log('BTV_TSV_SCOPE=CONFIRMED');
    await openDownloads(clubPage);
    // BTV renders the Downloads panel asynchronously after navigation.
    // Poll only the already authorized page; never repeat a login request.
    let downloadPage = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scanned = await visiblePages(context);
      downloadPage = scanned.find(({ text }) => /Namentliche\s+Mannschaftsmeldung|Nam\.\s*Meldung/i.test(text));
      if (downloadPage) break;
      await page.waitForTimeout(1200);
    }
    if (!downloadPage) fail('NMM_DOWNLOAD_NOT_DISCOVERED');

    // No PDF links are opened. Neither names nor generated document URLs are logged.
    const content = downloadPage.text;
    console.log('BTV_NMM_DOWNLOAD=AVAILABLE');
    console.log('BTV_SUMMER_2026_LISTED=' + (/Sommer\s*2026/i.test(content) ? 'YES' : 'UNCONFIRMED'));
    console.log('BTV_WINTER_2026_27_LISTED=' + (/Winter\s*2026\s*\/\s*2027/i.test(content) ? 'YES' : 'UNCONFIRMED'));
    // Winter mode deliberately has no importer; reject any --apply flag.
    if (process.argv.includes('--apply')) fail('WINTER_IMPORT_NOT_ENABLED');
    await inspectVerifiedWinterPdf(context, downloadPage.page);
    await context.close();
  } finally {
    await browser?.close().catch(() => {});
  }
}
try {
  await run();
  console.log('BTV_WINTER_ROSTER_DISCOVERY=SUCCESS');
} catch (error) {
  // No exception stack/message: browser errors can contain secret-bearing URLs.
  const code = error instanceof DiscoveryError ? error.message : 'BROWSER_OR_PAGE_ERROR';
  console.error('BTV_WINTER_ROSTER_DISCOVERY=' + code);
  process.exitCode = 1;
}
