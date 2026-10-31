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
  let unrecognizedHeaders = 0;
  let unassignedRows = 0;
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
      continue;
    }
    const rank = Number(row[1]);
    if (!Number.isInteger(rank) || rank < 1 || rank > 400
      || (rankLast && rank < rankLast)) {
      malformedRows++;
      continue;
    }
    rankLast = rank;
    const fullName = (row[3] + ' ' + row[2]).normalize('NFKC').replace(/\s+/gu, ' ').trim();
    try {
      const [validName] = normalizeRosterNames([fullName]);
      classRows.get(activeClass).push(validName);
    } catch {
      malformedRows++;
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
      unassignedRows,
      unrecognizedHeaders,
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
