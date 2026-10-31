// One-time, read-only check for the official BTV club cockpit.
// No roster data, screenshots, cookies, HTML, tokens or passwords are persisted or printed.
// No CAPTCHA / MFA workaround, no retries, no modification to BTV or Supabase.
import { chromium } from 'playwright';

const CLUB_COCKPIT = 'https://www.btv.de/de/mein-verein/vereins-cockpit.html';
const AUTH_HOST = 'tende-id.liga.nu';
const ALLOWED_HOSTS = new Set(['www.btv.de', 'btv.de', 'btv.liga.nu', AUTH_HOST]);
const username = process.env.BTV_LOGIN_USERNAME;
const password = process.env.BTV_LOGIN_PASSWORD;

function stop(code) {
  // Fixed status codes only; never include third-party response bodies or URLs.
  console.error('BTV_AUTH_CHECK=' + code);
  process.exitCode = 1;
}

if (!username || !password) {
  stop('SECRETS_MISSING');
} else {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      acceptDownloads: false,
      serviceWorkers: 'block',
      locale: 'de-DE',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    // Allow BTV/nuLiga navigation only. Third-party analytics and embeds are not needed.
    await page.route('**/*', (route) => {
      try {
        const url = new URL(route.request().url());
        if (url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname)) {
          return route.continue();
        }
      } catch { /* malformed URL */ }
      return route.abort();
    });

    await page.goto(CLUB_COCKPIT, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // The login provider is documented and must be the exact known HTTPS origin.
    if (new URL(page.url()).hostname !== AUTH_HOST) {
      stop('LOGIN_PROVIDER_NOT_CONFIRMED');
    } else {
      const pw = page.locator('input[type="password"]').first();
      await pw.waitFor({ state: 'visible', timeout: 15000 });
      const form = pw.locator('xpath=ancestor::form[1]');
      let email = form.locator('input[type="email"], input[autocomplete="username"], input[name*="username" i], input[placeholder*="E-Mail" i]').first();
      if (await email.count() === 0) {
        email = form.locator('input[type="text"]').first();
      }
      if (await email.count() !== 1 || !(await email.isVisible())) {
        stop('USERNAME_FIELD_NOT_FOUND');
      } else {
        await email.fill(username);
        await pw.fill(password);

        let submit = form.locator('button[type="submit"], input[type="submit"]').first();
        if (await submit.count() === 0) {
          submit = form.getByRole('button', { name: /anmelden|login|einloggen/i }).first();
        }
        // Exactly one login attempt. No retry, bypass or CAPTCHA handling.
        if (await submit.count() !== 1) {
          stop('SUBMIT_NOT_FOUND');
        } else {
          await submit.click();
          await page.waitForURL((url) => url.hostname !== AUTH_HOST, { timeout: 25000 }).catch(() => {});

          const currentHost = new URL(page.url()).hostname;
          if (currentHost === AUTH_HOST) {
            stop('LOGIN_NOT_CONFIRMED');
          } else if (!ALLOWED_HOSTS.has(currentHost)) {
            stop('UNEXPECTED_REDIRECT');
          } else {
            // Only inspect the cockpit in memory; never emit personal data.
            await page.goto(CLUB_COCKPIT, { waitUntil: 'domcontentloaded', timeout: 30000 });
            if (new URL(page.url()).hostname === AUTH_HOST) {
              stop('SESSION_NOT_CONFIRMED');
            } else {
              const start = page.getByRole('button', { name: /^start$/i }).first();
              if (await start.count() === 1 && await start.isVisible()) {
                await start.click();
                await page.waitForLoadState('domcontentloaded').catch(() => {});
              }

              const body = await page.locator('body').innerText({ timeout: 12000 });
              const hasCockpit = /Vereinsprozesse bearbeiten|Vereinsprofil bearbeiten/i.test(body);
              const hasDownloads = /Downloads/i.test(body);
              if (!hasCockpit) {
                stop('COCKPIT_NOT_CONFIRMED');
              } else {
                console.log('BTV_AUTH_CHECK=SUCCESS');
                console.log('BTV_DOWNLOADS_VISIBLE=' + (hasDownloads ? 'YES' : 'NOT_YET'));
                console.log('BTV_DATA_TRANSFER=NONE');
              }
            }
          }
        }
      }
    }
    await context.close();
  } catch {
    stop('BROWSER_OR_AUTH_ERROR');
  } finally {
    await browser?.close().catch(() => {});
  }
}
