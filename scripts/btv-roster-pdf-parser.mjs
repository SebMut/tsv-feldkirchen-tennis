// Extract ONLY name columns from an already verified TSV nMM PDF.
// Names stay in the ephemeral GitHub runner and are never sent to logs/artifacts.
import { AGE_CLASSES, ageClassFromPdfHeading, normalizeRosterNames } from './btv-roster-age-classes.mjs';

const knownClasses = Object.keys(AGE_CLASSES);

export function parseBtvRosterPdfText(text) {
  if (typeof text !== 'string' || text.length < 100) throw Error('PDF_TEXT_MISSING');
  const classRows = new Map(knownClasses.map(label => [label, []]));
  const headings = new Map(knownClasses.map(label => [label, 0]));
  let activeClass = null;
  let numberedRows = 0;
  let malformedRows = 0;
  let invalidFormat = 0;
  let invalidRank = 0;
  let invalidName = 0;
  let rankResets = 0;
  let unrecognizedHeaders = 0;
  let unassignedRows = 0;
  let unknownSections = 0;
  let rankLast = 0;

  for (const line of text.split(/\r?\n/u)) {
    const heading = ageClassFromPdfHeading(line);
    if (heading) {
      activeClass = heading;
      headings.set(heading, headings.get(heading) + 1);
      rankLast = 0;
      continue;
    }
    // If a team/age-class heading is not understood, stop assigning all
    // following players to the preceding section.
    if (/^\s*(?:Herren|Damen|Junioren|Knaben|Mädchen|Bambini|Kleinfeld)\b/iu.test(line)
        && line.includes('|')) {
      unrecognizedHeaders++;
      activeClass = null;
      continue;
    }
    // Any other section-like heading ("<words> [age] | league") is unknown to
    // the mapping. Only counted (parsing itself is unchanged); the
    // later-season plausibility gate rejects any such heading.
    if (line.includes('|') && line.length <= 110
        && /^\s*\p{L}[\p{L} .-]*?(?:\s\d{1,2})?(?:\s*\((?:4|6)er\))?(?:\s+(?:I|II|III))?\s*\|/u.test(line)
        && !/^\s*(?:Seite|Stand|Druck|Datum|Erstellt)\b/iu.test(line)) {
      unknownSections++;
    }
    if (!/^\s*\d{1,3}[.)]?\s+\p{L}/u.test(line)) continue;
    numberedRows++;
    if (!activeClass) {
      unassignedRows++;
      continue;
    }
    const firstColumn = line.trim().split(/\s{2,}/u)[0];
    const row = /^(\d{1,3})[.)]?\s+([^,]{2,70}),\s*(.{2,70})$/u.exec(firstColumn);
    if (!row) {
      malformedRows++;
      invalidFormat++;
      continue;
    }
    const rank = Number(row[1]);
    if (!Number.isInteger(rank) || rank < 1 || rank > 400) {
      malformedRows++;
      invalidRank++;
      continue;
    }
    if (rankLast && rank < rankLast) {
      // nuLiga can restart numbering inside the same age-class block.
      // Count resets and validate their frequency with the club PDF snapshot.
      rankResets++;
    }
    rankLast = rank;
    const fullName = (row[3] + ' ' + row[2]).normalize('NFKC').replace(/\s+/gu, ' ').trim();
    try {
      const [validName] = normalizeRosterNames([fullName]);
      classRows.get(activeClass).push(validName);
    } catch {
      malformedRows++;
      invalidName++;
    }
  }
  const parsedRows = [...classRows.values()].reduce((sum, names) => sum + names.length, 0);
  const counts = Object.fromEntries(knownClasses.map(label => [
    label, new Set(classRows.get(label).map(name => name.toLocaleLowerCase('de-DE'))).size,
  ]));
  const rows = Object.fromEntries(knownClasses.map(label => [
    label, normalizeRosterNamesMaybeEmpty(classRows.get(label)),
  ]));
  return {
    // Safe to publish counters and class labels, never the rows object.
    diagnostics: {
      numberedRows,
      parsedRows,
      malformedRows,
      invalidFormat,
      invalidRank,
      invalidName,
      rankResets,
      unassignedRows,
      unrecognizedHeaders,
      unknownSections,
      classCount: knownClasses.filter(label => headings.get(label) > 0).length,
      headingCount: [...headings.values()].reduce((sum, n) => sum + n, 0),
      classCounts: counts,
    },
    rows,
  };
}
function normalizeRosterNamesMaybeEmpty(names) {
  if (names.length === 0) return [];
  return normalizeRosterNames(names);
}

export function assertCompleteSummerRoster(parsed) {
  const d = parsed?.diagnostics;
  if (!d || d.classCount !== knownClasses.length || d.headingCount < 20
    || d.unrecognizedHeaders !== 0 || d.unassignedRows !== 0
    || d.malformedRows !== 0 || d.numberedRows !== d.parsedRows
    || d.numberedRows < 60 || d.numberedRows > 800
    || knownClasses.some(label => !d.classCounts[label])) {
    throw Error('PDF_ROSTER_LAYOUT_INCOMPLETE');
  }
  return parsed;
}


// Exact one-time snapshot gate for the currently verified 7-page PDF.
// Other clubs, seasons and unexpected changes cannot trigger a write.
export const CONFIRMED_SUMMER_CLASSES = Object.freeze([
  'Herren', 'Herren 40', 'Junioren 18', 'Knaben 15', 'Bambini 12',
]);
export function assertVerifiedSummerSnapshot(parsed) {
  const d = parsed?.diagnostics;
  const actual = Object.keys(d?.classCounts || {}).filter(name => d.classCounts[name] > 0);
  if (!d || d.classCount !== 6 || d.headingCount !== 10 || d.numberedRows !== 173
    || d.parsedRows !== 172 || d.unassignedRows !== 0 || d.malformedRows !== 1
    || d.invalidName !== 1 || d.invalidFormat !== 0 || d.invalidRank !== 0
    || d.unrecognizedHeaders !== 0 || d.rankResets > 20
    // Exactly these five classes contain names; the sixth heading (Damen 40)
    // is present but has no player rows in the verified seven-page source.
    || d.classCounts['Damen 40'] !== 0
    || d.classCounts['Herren'] !== 49
    || d.classCounts['Herren 40'] !== 54
    || d.classCounts['Junioren 18'] !== 23
    || d.classCounts['Knaben 15'] !== 25
    || d.classCounts['Bambini 12'] !== 21
    || actual.length !== CONFIRMED_SUMMER_CLASSES.length
    || CONFIRMED_SUMMER_CLASSES.some(name => !actual.includes(name))) {
    throw Error('UNVERIFIED_NMM_SNAPSHOT');
  }
  return parsed;
}

// Plausibility gate for later summer seasons (sommer-2027 onwards), whose
// exact snapshot cannot be known in advance. Any structural doubt stops the
// import before the database is touched.
export function assertPlausibleSeasonRoster(parsed) {
  const d = parsed?.diagnostics;
  const nonEmpty = Object.keys(d?.classCounts || {}).filter(name => d.classCounts[name] > 0);
  if (!d || d.unassignedRows !== 0 || d.unrecognizedHeaders !== 0 || d.unknownSections !== 0
    || d.invalidFormat !== 0 || d.invalidRank !== 0 || d.invalidName > 3
    || d.malformedRows !== d.invalidName
    || d.numberedRows !== d.parsedRows + d.malformedRows
    || d.parsedRows < 60 || d.parsedRows > 400 || d.rankResets > 30
    || nonEmpty.length < 3 || nonEmpty.some(name => d.classCounts[name] > 100)) {
    throw Error('UNVERIFIED_NMM_ROSTER');
  }
  return parsed;
}
