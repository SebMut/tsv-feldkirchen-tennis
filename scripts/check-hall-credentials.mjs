import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const credentialGroups = [
  {
    provider: 'SPORTTRAUM Heimstetten (Eversports)',
    fields: ['HALL_SPORTTRAUM_EVERSPORTS_EMAIL', 'HALL_SPORTTRAUM_EVERSPORTS_PASSWORD'],
  },
  {
    provider: 'Rothof München (Eversports)',
    fields: ['HALL_ROTHOF_EVERSPORTS_EMAIL', 'HALL_ROTHOF_EVERSPORTS_PASSWORD'],
  },
  {
    provider: 'Racket-Park TSV Haar (Eversports)',
    fields: ['HALL_HAAR_EVERSPORTS_EMAIL', 'HALL_HAAR_EVERSPORTS_PASSWORD'],
  },
  {
    provider: 'Tennishalle Aschheim (eBuSy)',
    fields: ['HALL_ASCHHEIM_EBUSY_USERNAME', 'HALL_ASCHHEIM_EBUSY_PASSWORD'],
  },
  {
    provider: 'Tennishalle Kirchheim (eTennis)',
    fields: ['HALL_KIRCHHEIM_ETENNIS_USERNAME', 'HALL_KIRCHHEIM_ETENNIS_PASSWORD'],
  },
];

const placeholderValues = new Set([
  'change-me',
  'changeme',
  'password',
  'placeholder',
  'todo',
]);

export function credentialStatus(environment = process.env) {
  return credentialGroups.map((group) => {
    const missing = group.fields.filter((field) => {
      const value = environment[field]?.trim() ?? '';
      return !value || placeholderValues.has(value.toLowerCase());
    });
    return { ...group, missing, ready: missing.length === 0 };
  });
}

export function summaryMarkdown(status) {
  const rows = status.map(({ provider, ready }) =>
    `| ${provider} | ${ready ? 'Bereit' : 'Fehlt'} |`,
  );
  return [
    '## Hallenfinder-Zugangsdaten',
    '',
    '| Anbieter | Status |',
    '| --- | --- |',
    ...rows,
    '',
    '> Es wurden ausschließlich Vorhandensein und Platzhalter geprüft. Zugangsdaten wurden nicht ausgegeben.',
    '',
  ].join('\n');
}

async function main() {
  const status = credentialStatus();
  const summary = summaryMarkdown(status);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
  }

  const ready = status.filter((entry) => entry.ready).length;
  console.log(`Hallenfinder-Zugänge: ${ready}/${status.length} Anbietergruppen konfiguriert.`);

  const missing = status.flatMap((entry) => entry.missing);
  if (missing.length > 0) {
    console.error(`::error title=Hallenfinder-Secrets fehlen::Bitte diese Environment-Secrets ergänzen: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) await main();
