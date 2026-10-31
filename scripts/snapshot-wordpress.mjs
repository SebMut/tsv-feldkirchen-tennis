import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://www.tennis-tsvfeldkirchen.de';
const outDir = 'migration/wordpress-export';
const now = new Date().toISOString();

await mkdir(outDir, { recursive: true });

async function getJson(path) {
  const url = new URL(path, base);
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'user-agent': 'TSV-Feldkirchen-Migration/1.0',
    },
    redirect: 'follow',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 300)}`);
  }
}

async function getPagedWp(resource) {
  const rows = [];
  let page = 1;

  while (page <= 100) {
    const url = `/wp-json/wp/v2/${resource}?per_page=100&page=${page}&_embed=1`;
    try {
      const data = await getJson(url);
      if (!Array.isArray(data) || data.length === 0) break;
      rows.push(...data);
      if (data.length < 100) break;
      page += 1;
    } catch (error) {
      if (page === 1) throw error;
      break;
    }
  }

  return rows;
}

async function getTribeEvents() {
  const rows = [];
  let page = 1;

  while (page <= 100) {
    const data = await getJson(
      `/wp-json/tribe/events/v1/events?per_page=50&page=${page}&start_date=2025-01-01&end_date=2027-12-31`,
    );

    if (!Array.isArray(data.events) || data.events.length === 0) break;
    rows.push(...data.events);

    if (!data.next_rest_url) break;
    page += 1;
  }

  return rows;
}

const jobs = {
  pages: () => getPagedWp('pages'),
  posts: () => getPagedWp('posts'),
  media: () => getPagedWp('media'),
  categories: () => getPagedWp('categories'),
  events: () => getTribeEvents(),
};

const manifest = {
  source: base,
  created_at: now,
  resources: {},
};

for (const [name, loader] of Object.entries(jobs)) {
  try {
    const data = await loader();
    await writeFile(`${outDir}/${name}.json`, JSON.stringify(data, null, 2) + '\n');
    manifest.resources[name] = { ok: true, count: Array.isArray(data) ? data.length : 0 };
    console.log(`${name}: ${manifest.resources[name].count}`);
  } catch (error) {
    manifest.resources[name] = { ok: false, error: String(error) };
    console.error(`${name}: ${error}`);
  }
}

await writeFile(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');

if (!Object.values(manifest.resources).some((item) => item.ok)) {
  process.exitCode = 1;
}
