// TSV Feldkirchen nMM PDF audit including all youth age-classes.
// One authenticated download, validation and age-class counts only. No names in logs,
// GitHub artifacts, commits, or Supabase. No edit in BTV. Ephemeral runner only.
// Discovery only: verify the authorized TSV Feldkirchen Downloads section.
// No PDF download, user data capture, screenshots, cookies, or external uploads.
// Output is restricted to fixed status flags, never private page content/URLs.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ageClassFromPdfHeading, isYouthClass } from './btv-roster-age-classes.mjs';
import { parseBtvRosterPdfText, assertCompleteSummerRoster } from './btv-roster-pdf-parser.mjs';

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
async function inspectVerifiedSummerPdf(context, downloadsPage) {
  const overview = downloadsPage.getByRole('link', { name: /Download.?Übersicht/i }).first();
  if (await overview.count() !== 1) fail('DOWNLOAD_OVERVIEW_NOT_FOUND');
  await overview.click();
  await downloadsPage.waitForTimeout(900);
  let pages = await visiblePages(context);
  let chosen = null;
  const nmmName = /Namentliche\s+Mannschaftsmeldung|Nam\.?\s*Meldung/i;
  async function findSummerRowLinks() {
    for (const { page } of pages) {
      const rows = page.locator('tr').filter({ hasText: /Sommer\s*2026/i });
      for (const row of await rows.all()) {
        const links = row.getByRole('link', { name: nmmName });
        if (await links.count() === 1) {
          if (chosen) fail('SUMMER_NMM_AMBIGUOUS');
          chosen = { page, link: links.first() };
        }
      }
    }
  }
  await findSummerRowLinks();
  let openedSummer = false;
  let archiveLinkFound = false;
  let archiveSelectorFound = false;
  if (!chosen) {
    // Some BTV archive pages first require selection of an older competition.
    // Do not select an arbitrary document from a multi-season page.
    for (const { page } of pages) {
      if (openedSummer) break;
      for (const select of await page.locator('select').all()) {
        const options = await select.locator('option').all();
        const matches = [];
        for (const option of options) {
          const label = (await option.textContent()) || '';
          if (/^\s*Sommer\s*2026\s*$/i.test(label)) {
            const value = await option.getAttribute('value');
            if (value) matches.push(value);
          }
        }
        if (matches.length === 1) {
          archiveSelectorFound = true;
          await select.selectOption(matches[0]);
          await page.waitForTimeout(900);
          openedSummer = true;
          break;
        }
      }
      if (!openedSummer) {
        const link = page.getByRole('link', { name: /^\s*Sommer\s*2026\s*$/i }).first();
        if (await link.count() === 1 && await link.isVisible()) {
          const href = await link.getAttribute('href');
          if (href && !/\.pdf(?:\?|#|$)/i.test(href)) {
            archiveLinkFound = true;
            await link.click();
            await page.waitForTimeout(900);
            openedSummer = true;
          }
        }
      }
    }
    pages = await visiblePages(context);
    await findSummerRowLinks();
    if (!chosen && openedSummer) {
      const options = [];
      for (const { page, text } of pages) {
        if (!/Sommer\s*2026/i.test(text)) continue;
        const links = page.getByRole('link', { name: nmmName });
        if (await links.count() === 1) options.push({ page, link: links.first() });
      }
      if (options.length === 1) chosen = options[0];
    }
  }
  if (!chosen) {
    console.log('BTV_ARCHIVE_SUMMER_TEXT=' + (pages.some(({ text }) => /Sommer\s*2026/i.test(text)) ? 'YES' : 'NO'));
    console.log('BTV_ARCHIVE_SUMMER_LINK=' + (archiveLinkFound ? 'YES' : 'NO'));
    console.log('BTV_ARCHIVE_SUMMER_SELECTOR=' + (archiveSelectorFound ? 'YES' : 'NO'));
    console.log('BTV_ARCHIVE_SEASON_VIEW=' + (openedSummer ? 'YES' : 'NO'));
    fail('SUMMER_NMM_LINK_NOT_FOUND');
  }
  const href = await chosen.link.getAttribute('href');
  if (!href) fail('NMM_DOWNLOAD_LINK_NOT_FOUND');
  const destination = new URL(href, chosen.page.url());
  if (destination.protocol !== 'https:' || !ALLOWED_HOSTS.has(destination.hostname)) {
    fail('NMM_DOWNLOAD_ORIGIN_NOT_ALLOWED');
  }
  const downloadPromise = chosen.page.waitForEvent('download', { timeout: 25000 });
  await chosen.link.click();
  const download = await downloadPromise;
  const file = await download.path();
  if (!file) fail('NMM_DOWNLOAD_FILE_NOT_FOUND');
  const pdf = readFileSync(file);
  if (pdf.length < 1000 || pdf.length > 12000000 || pdf.subarray(0, 4).toString('ascii') !== '%PDF') {
    fail('NMM_NOT_A_VALID_PDF');
  }
  const pdfinfo = execFileSync('pdfinfo', [file], { encoding: 'utf8', timeout: 12000 });
  const pagesCount = Number(pdfinfo.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!(pagesCount >= 1 && pagesCount <= 50)) fail('NMM_PAGE_COUNT_INVALID');
  const text = execFileSync('pdftotext', ['-layout', file, '-'], {
    encoding: 'utf8', timeout: 25000, maxBuffer: 8 * 1024 * 1024,
  });
  if (!/TSV\s+Feldkirchen/i.test(text) || !/01012/.test(text) || !/Sommer\s+2026/i.test(text)) {
    fail('NMM_PDF_CLUB_OR_SEASON_NOT_CONFIRMED');
  }
  // Print only redacted typographic shapes (never names, dates or IDs).
  const classNames = [
    'Junioren 18', 'Knaben 15', 'Mädchen 15', 'Bambini 12', 'Kleinfeld U9',
    'Herren 40', 'Herren 50', 'Damen 30', 'Damen 40', 'Damen 50', 'Herren', 'Damen',
  ];
  const lines = text.split(/\r?\n/);
  for (const className of classNames) {
    const hits = lines.filter(line => line.toLocaleLowerCase('de-DE').includes(className.toLocaleLowerCase('de-DE')));
    if (!hits.length) continue;
    const redacted = hits[0].slice(0, 85)
      .replace(/\p{L}/gu, 'X').replace(/[0-9]/g, '9')
      .replace(/[^X9\s()|:;.,\/-]/g, '?').replace(/\s+/g, ' ').trim();
    const tag = className.toLocaleUpperCase('de-DE').replace(/[^A-Z0-9]/g, '_');
    console.log('BTV_LAYOUT_' + tag + '_LINES=' + hits.length);
    console.log('BTV_LAYOUT_' + tag + '_SHAPE=' + redacted);
  }
  console.log('BTV_LAYOUT_LINE_COUNT=' + lines.length);
  console.log('BTV_LAYOUT_NUMBER_PREFIX_LINES=' + lines.filter(line => /^\s*\d+[.)]?\s+\p{L}/u.test(line)).length);
  console.log('BTV_LAYOUT_LK_LINES=' + lines.filter(line => /\bLK\s*\d/i.test(line)).length);

  // Structure-only samples: every alphabetic character and number is replaced.
  // Do not print any raw PDF lines, player names, birth years or document links.
  const numbered = lines.filter(line => /^\s*\d{1,3}[.)]?\s+\p{L}/u.test(line));
  console.log('BTV_LAYOUT_NUMBERED_ROWS=' + numbered.length);
  const nameColumnCount = numbered.filter(line => {
    const first = line.trim().split(/\s{2,}/)[0];
    return /^\d{1,3}[.)]?\s+\p{L}[^,]{2,70},\s*\p{L}/u.test(first);
  }).length;
  console.log('BTV_LAYOUT_NAME_COLUMNS=' + nameColumnCount);
  for (const [i, line] of numbered.slice(0, 7).entries()) {
    const columns = line.trim().split(/\s{2,}/);
    const first = columns[0].slice(0, 100).replace(/\p{L}/gu, 'X')
      .replace(/\d/g, '9').replace(/[^X9\s()|:;.,\/-]/g, '?');
    console.log('BTV_LAYOUT_COLUMN_COUNT_' + (i + 1) + '=' + columns.length);
    console.log('BTV_LAYOUT_NAME_COLUMN_' + (i + 1) + '=' + first);
  }
  for (const [i, line] of numbered.slice(0, 7).entries()) {
    const masked = line.slice(0, 110).replace(/\p{L}/gu, 'X')
      .replace(/\d/g, '9').replace(/[^X9\s()|:;.,\/-]/g, '?')
      .replace(/\s+/g, ' ').trim();
    console.log('BTV_LAYOUT_NUMBERED_ROW_' + (i + 1) + '=' + masked);
  }
  const headingRx = /^\s*(?:Junioren\s+18|Knaben\s+15|Mädchen\s+15|Bambini\s+12|Kleinfeld\s+U9|Herren(?:\s+(?:40|50))?|Damen(?:\s+(?:30|40|50))?)(?:\s+\(\d+er\))?\s*\|/iu;
  console.log('BTV_LAYOUT_TABLE_HEADINGS=' + lines.filter(line => headingRx.test(line)).length);

  const headings = new Set();
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (clean.length > 110) continue;
    const canonical = ageClassFromPdfHeading(clean);
    if (canonical) headings.add(canonical);
  }
  const youth = [...headings].filter(isYouthClass).length;
  console.log('BTV_NMM_PDF_CLUB=TSV_01012');
  console.log('BTV_NMM_PDF_SEASON=SOMMER_2026');
  console.log('BTV_NMM_PDF_PAGES=' + pagesCount);
  console.log('BTV_NMM_AGE_CLASSES=' + headings.size);
  console.log('BTV_NMM_YOUTH_AGE_CLASSES=' + youth);
  console.log('BTV_NMM_ADULT_AGE_CLASSES=' + (headings.size - youth));
  console.log('BTV_NMM_PLAYERS_STORED=0');
  const parsed = parseBtvRosterPdfText(text);
  const d = parsed.diagnostics;
  console.log('BTV_PARSE_HEADINGS=' + d.headingCount);
  console.log('BTV_PARSE_AGE_CLASSES=' + d.classCount);
  console.log('BTV_PARSE_ROWS=' + d.parsedRows);
  console.log('BTV_PARSE_MALFORMED_ROWS=' + d.malformedRows);
  console.log('BTV_PARSE_UNASSIGNED_ROWS=' + d.unassignedRows);
  console.log('BTV_PARSE_UNKNOWN_HEADERS=' + d.unrecognizedHeaders);
  for (const [name, count] of Object.entries(d.classCounts)) {
    const label = name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    console.log('BTV_PARSE_CLASS_' + label + '=' + count);
  }
  try {
    assertCompleteSummerRoster(parsed);
    console.log('BTV_PARSE_COMPLETE=YES');
  } catch {
    console.log('BTV_PARSE_COMPLETE=NO');
    fail('PDF_ROSTER_LAYOUT_INCOMPLETE');
  }

  if (!youth) fail('NMM_YOUTH_HEADINGS_NOT_FOUND');
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
    await inspectVerifiedSummerPdf(context, downloadPage.page);
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
