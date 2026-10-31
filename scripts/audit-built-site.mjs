// Static Astro build audit. No production deployment or private credentials are needed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const preview = process.env.PUBLIC_PREVIEW_MODE === 'true';
const basePath = (process.env.PREVIEW_BASE || '/').replace(/\/$/, '');
const required = [
  '/', '/aktuelles/', '/mannschaften/', '/termine/', '/spieltag/', '/training/',
  '/mitglied-werden/', '/sponsoren/', '/funktionaere/', '/kontakt/', '/admin/', '/spiel/', '/live/'
];
const errors = [];

for (const route of required) {
  const file = join(dist, route.replace(/^\//, ''), 'index.html');
  if (!existsSync(file)) errors.push('Fehlende öffentliche Route: ' + route);
}

const htmlFiles = [];
function walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const name = join(folder, entry.name);
    if (entry.isDirectory()) walk(name);
    else if (entry.name.endsWith('.html')) htmlFiles.push(name);
  }
}
walk(dist);
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const name = relative(dist, file).split(sep).join('/');
  if (!/<html\s+lang="de"/.test(html)) errors.push(name + ': lang=de fehlt');
  if (!/<meta\s+name="description"/.test(html)) errors.push(name + ': Beschreibung fehlt');
  if (!/<link\s+rel="canonical"/.test(html)) errors.push(name + ': Canonical fehlt');
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(name + ': Titel fehlt');
  if (preview && !/<meta\s+name="robots"\s+content="noindex,nofollow"/.test(html)) {
    errors.push(name + ': Preview darf nicht indexierbar sein');
  }
  const protectedPage = name === 'admin/index.html' || name === 'impressum/index.html' || name === 'datenschutz/index.html';
  if (protectedPage && !/<meta\s+name="robots"\s+content="noindex,nofollow"/.test(html)) {
    errors.push(name + ': geschützte/Brückenseite muss noindex sein');
  }
  if (/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|SFTP_PASSWORD/.test(html)) errors.push(name + ': möglicher geheimer Schlüssel im HTML');
  const localLinks = [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"/g)];
  for (const [, href] of localLinks) {
    if (href.startsWith('//')) continue;
    const path = decodeURIComponent(href.split(/[?#]/)[0]);
    const cleanPath = basePath && path.startsWith(basePath + '/') ? path.slice(basePath.length) : path;
    if (/\.[a-z0-9]+$/i.test(cleanPath)) continue;
    const linked = join(dist, cleanPath.replace(/^\//, ''), 'index.html');
    if (!existsSync(linked)) errors.push(name + ': kaputter interner Link ' + href);
  }
}
if (!htmlFiles.length) errors.push('Keine HTML-Seiten im Build');
const sitemap = join(dist, 'sitemap.xml');
if (!existsSync(sitemap)) errors.push('Sitemap fehlt');
else if (!readFileSync(sitemap, 'utf8').includes('<urlset')) errors.push('Sitemap ungültig');
const manifestPath = join(dist, 'manifest.webmanifest');
const workerPath = join(dist, 'sw.js');
const iconPath = join(dist, 'app-icon.svg');
if (!existsSync(manifestPath)) errors.push('PWA Manifest fehlt');
else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const expected = (basePath || '') + '/';
    if (manifest.start_url !== expected || manifest.scope !== expected) errors.push('PWA Start/Scope passt nicht zum Basis-Pfad');
    if (manifest.name !== 'TSV Feldkirchen Tennis') errors.push('PWA App-Name fehlt');
    if (!manifest.icons?.length) errors.push('PWA Icon fehlt im Manifest');
  } catch { errors.push('PWA Manifest ist kein gültiges JSON'); }
}
if (!existsSync(workerPath)) errors.push('Service Worker fehlt');
if (!existsSync(iconPath)) errors.push('PWA Icon-Datei fehlt');

console.log(`Static site audit: ${htmlFiles.length} HTML-Seiten, ${required.length} Hauptrouten, preview=${preview}`);
if (errors.length) {
  for (const error of errors) console.error('FEHLER:', error);
  process.exitCode = 1;
} else console.log('OK: Seitentitel, Metadaten, interne Links, Sitemap und Preview-Noindex');
