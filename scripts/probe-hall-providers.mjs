import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const outputPath = 'artifacts/hall-provider-probe/report.json';
const timeout = 20_000;
const attemptLogin = process.env.HALL_PROBE_ATTEMPT_LOGIN === 'true';

const providers = [
  {
    id: 'sporttraum',
    name: 'SPORTTRAUM Heimstetten',
    kind: 'eversports',
    bookingUrl: 'https://www.eversports.de/widget/w/6yi8rm',
    usernameKey: 'HALL_SPORTTRAUM_EVERSPORTS_EMAIL',
    passwordKey: 'HALL_SPORTTRAUM_EVERSPORTS_PASSWORD',
  },
  {
    id: 'rothof',
    name: 'Rothof München',
    kind: 'eversports',
    bookingUrl: 'https://www.eversports.de/widget/w/jmjffr',
    usernameKey: 'HALL_ROTHOF_EVERSPORTS_EMAIL',
    passwordKey: 'HALL_ROTHOF_EVERSPORTS_PASSWORD',
  },
  {
    id: 'haar',
    name: 'Racket-Park TSV Haar',
    kind: 'eversports',
    bookingUrl: 'https://www.eversports.de/s/racket-park-tsv-haar',
    usernameKey: 'HALL_HAAR_EVERSPORTS_EMAIL',
    passwordKey: 'HALL_HAAR_EVERSPORTS_PASSWORD',
  },
  {
    id: 'aschheim',
    name: 'TC Aschheim',
    kind: 'ebusy',
    bookingUrl: 'https://tcaschheim.ebusy.de/court-module/372',
    usernameKey: 'HALL_ASCHHEIM_EBUSY_USERNAME',
    passwordKey: 'HALL_ASCHHEIM_EBUSY_PASSWORD',
  },
  {
    id: 'kirchheim',
    name: 'TC Kirchheim',
    kind: 'etennis',
    bookingUrl: 'https://tckirchheim.tennisplatz.info/reservierung?c=2015',
    usernameKey: 'HALL_KIRCHHEIM_ETENNIS_USERNAME',
    passwordKey: 'HALL_KIRCHHEIM_ETENNIS_PASSWORD',
  },
];

function credentials(provider) {
  const username = process.env[provider.usernameKey]?.trim() ?? '';
  const password = process.env[provider.passwordKey] ?? '';
  if (!username || !password) throw new Error(`Missing protected credentials for ${provider.id}`);
  return { username, password };
}

function safeAvailability(text) {
  const times = [...new Set(text.match(/(?:[01]?\d|2[0-3]):[0-5]\d/g) ?? [])].slice(0, 24);
  const prices = [...new Set(text.match(/(?:€\s?\d{1,3}|\d{1,3}(?:[,.]\d{2})?\s?€)/g) ?? [])].slice(0, 12);
  return { times, prices };
}

async function isHumanCheck(page) {
  if (/Just a moment|Nur einen Moment/i.test(await page.title().catch(() => ''))) return true;
  return page.getByText(/Sicherheitsüberprüfung|Checking your Browser|Bestätigen Sie, dass Sie ein Mensch sind/i).first().isVisible().catch(() => false);
}

async function probeEversports(browser, provider) {
  if (attemptLogin) credentials(provider);
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  try {
    await page.goto(provider.bookingUrl, { waitUntil: 'domcontentloaded', timeout });
    if (await isHumanCheck(page)) {
      return {
        login: 'blocked_by_provider_security',
        availability: 'blocked_by_provider_security',
        note: 'Cloudflare human verification shown before login; no bypass attempted.',
      };
    }
    const publicText = await page.locator('body').innerText({ timeout: 5_000 });
    return {
      login: 'not_attempted_without_supported_login_form',
      availability: 'public_page_reached',
      values: safeAvailability(publicText),
      note: 'No stable supported login form was exposed to the automated browser.',
    };
  } finally {
    await context.close();
  }
}

async function probeEbusy(browser, provider) {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  try {
    let login = 'not_attempted';
    if (attemptLogin) {
      const { username, password } = credentials(provider);
      await page.goto('https://tcaschheim.ebusy.de/login', { waitUntil: 'domcontentloaded', timeout });
      await page.getByRole('textbox', { name: 'Benutzername' }).fill(username);
      await page.getByRole('textbox', { name: 'Passwort' }).fill(password);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.waitForTimeout(2_000);
      const loginFailed = await page.getByText(/fehlgeschlagen|ungültig|nicht korrekt|falsch/i).first().isVisible().catch(() => false);
      const loginFormVisible = await page.getByRole('button', { name: 'Login', exact: true }).isVisible().catch(() => false);
      login = !loginFailed && !loginFormVisible ? 'success' : 'failed';
    }

    await page.goto(provider.bookingUrl, { waitUntil: 'domcontentloaded', timeout });
    const body = await page.locator('body').innerText({ timeout: 5_000 });
    const maintenance = /Wartungsarbeiten|Maintenance/i.test(body);
    return {
      login: maintenance && login === 'failed' ? 'indeterminate_provider_maintenance' : login,
      availability: maintenance ? 'provider_maintenance' : 'page_reached',
      values: maintenance ? { times: [], prices: [] } : safeAvailability(body),
      note: maintenance ? 'Official eBuSy maintenance page is active.' : undefined,
    };
  } finally {
    await context.close();
  }
}

async function extractEtennisAvailability(page, bookingUrl) {
  return page.evaluate((baseUrl) => {
    const prices = Object.fromEntries(
      [...document.querySelectorAll('.price[class*=price]')].flatMap((element) => {
        const priceClass = [...element.classList].find((name) => /^price\d+$/.test(name));
        const value = element.textContent?.trim().replace(/\s+/g, ' ') ?? '';
        return priceClass && value ? [[priceClass, value]] : [];
      }),
    );
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const slots = [...document.querySelectorAll('.slot.av[data-begin]')].slice(0, 200).map((element) => {
      const epoch = Number(element.getAttribute('data-begin'));
      const parts = Object.fromEntries(formatter.formatToParts(new Date(epoch * 1000)).map((part) => [part.type, part.value]));
      const priceClass = [...element.classList].find((name) => /^price\d+$/.test(name));
      const courtElement = element.closest('.court');
      const courts = courtElement?.parentElement
        ? [...courtElement.parentElement.children].filter((child) => child.classList.contains('court'))
        : [];
      const court = Math.max(0, courts.indexOf(courtElement)) + 7;
      const day = element.closest('.day');
      const dayStarts = day
        ? [...day.querySelectorAll('.slot[data-begin]')]
          .map((slot) => Number(slot.getAttribute('data-begin')))
          .filter(Number.isFinite)
        : [];
      const dayStart = dayStarts.length ? Math.min(...dayStarts) : null;
      return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        start: `${parts.hour}:${parts.minute}`,
        durationMinutes: Number(element.getAttribute('data-size') || '1') * 60,
        court: `Platz ${court}`,
        price: priceClass ? prices[priceClass] ?? null : null,
        bookingUrl: dayStart ? `${baseUrl}&d=${dayStart}` : baseUrl,
      };
    });
    return { slots, prices: [...new Set(Object.values(prices))] };
  }, bookingUrl);
}

async function probeEtennis(browser, provider) {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  try {
    let login = 'not_attempted';
    if (attemptLogin) {
      const { username, password } = credentials(provider);
      await page.goto(`${provider.bookingUrl}#login`, { waitUntil: 'domcontentloaded', timeout });
      await page.getByRole('button', { name: 'Alle ablehnen' }).click().catch(() => {});
      await page.locator('#login-username').fill(username, { timeout: 8_000 });
      await page.locator('#login-password').fill(password, { timeout: 8_000 });
      await page.locator('form[name="login"]').evaluate((form) => form.requestSubmit());
      await page.waitForTimeout(2_500);
      const loginFailed = await page.getByText(/fehlgeschlagen|ungültig|nicht korrekt|falsch/i).first().isVisible().catch(() => false);
      const loginFormVisible = await page.locator('#login-password').isVisible().catch(() => false);
      login = !loginFailed && !loginFormVisible ? 'success' : 'failed';
    }

    await page.goto(provider.bookingUrl, { waitUntil: 'domcontentloaded', timeout });
    const values = await extractEtennisAvailability(page, provider.bookingUrl);
    return { login, availability: 'public_slots_extracted', values };
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const provider of providers) {
      try {
        const probe = provider.kind === 'eversports'
          ? await probeEversports(browser, provider)
          : provider.kind === 'ebusy'
            ? await probeEbusy(browser, provider)
            : await probeEtennis(browser, provider);
        results.push({ id: provider.id, name: provider.name, bookingUrl: provider.bookingUrl, ...probe });
      } catch (error) {
        results.push({
          id: provider.id,
          name: provider.name,
          bookingUrl: provider.bookingUrl,
          login: 'probe_error',
          availability: 'probe_error',
          note: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
  } finally {
    await browser.close();
  }

  const report = { checkedAt: new Date().toISOString(), loginAttempted: attemptLogin, bookingAttempted: false, results };
  await mkdir('artifacts/hall-provider-probe', { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  for (const result of results) {
    console.log(`[hall-probe] ${result.id}: login=${result.login}, availability=${result.availability}`);
  }
}

await main();
