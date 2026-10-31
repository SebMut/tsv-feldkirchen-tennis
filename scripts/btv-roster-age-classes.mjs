// Official namentliche Mannschaftsmeldung (nMM) is an AGE-CLASS roster,
// not always a single-team squad. Every eligible same-age TSV team can use it.
// Import only names after the source PDF's club and competition are verified.
export const AGE_CLASSES = Object.freeze({
  'Herren': ['herren', 'herren-ii', 'herren-iii'],
  'Herren 40': ['herren-40', 'herren-40-ii'],
  'Herren 50': ['herren-50', 'herren-50-ii'],
  'Damen': ['damen'],
  'Damen 30': ['damen-30'],
  'Damen 40': ['damen-40'],
  'Damen 50': ['damen-50'],
  'Junioren 18': ['junioren-18', 'junioren-18-ii'],
  'Knaben 15': ['knaben-15', 'knaben-15-ii'],
  'Mädchen 15': ['maedchen-15'],
  'Bambini 12': ['bambini-12', 'bambini-12-ii', 'bambini-12-iii'],
  'Kleinfeld U9': ['kleinfeld-u9'],
});
export const YOUTH_CLASSES = Object.freeze([
  'Junioren 18', 'Knaben 15', 'Mädchen 15', 'Bambini 12', 'Kleinfeld U9',
]);
export const YOUTH_TEAM_SLUGS = Object.freeze(YOUTH_CLASSES.flatMap(name => AGE_CLASSES[name]));
export const SUMMER_2026_TEAM_SLUGS = Object.freeze(Object.values(AGE_CLASSES).flat());
export const WINTER_2026_27_TEAM_SLUGS = Object.freeze(['herren', 'herren-ii', 'herren-50']);

const normalized = (value) => String(value).normalize('NFKC')
  .toLocaleLowerCase('de-DE').replace(/\s+/gu, ' ').trim();
function classKey(raw) {
  return normalized(raw).replace(/\b(?:u\s*)?(9|12|15|18)\b/g, '$1')
    .replace(/\b(4er|6er)\b/g, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}
const AGE_ALIASES = new Map();
for (const canonical of Object.keys(AGE_CLASSES)) {
  AGE_ALIASES.set(classKey(canonical), canonical);
}
for (const [alias, canonical] of [
  ['Junioren U18', 'Junioren 18'],
  ['Knaben U15', 'Knaben 15'], ['Mädchen U15', 'Mädchen 15'],
  ['Bambini U12', 'Bambini 12'], ['Kleinfeld 9', 'Kleinfeld U9'],
  ['Kleinfeld U9', 'Kleinfeld U9'],
]) AGE_ALIASES.set(classKey(alias), canonical);

// No fuzzy names, no guessing; spelling differences in a live PDF must be reviewed.
export function canonicalAgeClass(label) {
  return AGE_ALIASES.get(classKey(label)) || null;
}

// PDF headings can contain leagues, additional I/II/III squads and '(4er)'.
// Accept ONLY a recognized club age-class heading followed by a '| league' marker.
export function ageClassFromPdfHeading(line) {
  if (typeof line !== 'string' || !line.includes('|')) return null;
  const heading = line.split('|', 1)[0].trim()
    .replace(/\\s*\\((?:4|6)er\\)\\s*/giu, ' ')
    .replace(/\\s+\\b(?:II|III)\\b$/iu, '')
    .replace(/\\s+/gu, ' ').trim();
  return canonicalAgeClass(heading);
}

export function rosterTeams(ageClass, seasonCode) {
  const canonical = canonicalAgeClass(ageClass);
  if (!canonical) return [];
  const selected = AGE_CLASSES[canonical];
  if (seasonCode === 'sommer-2026') return [...selected];
  if (seasonCode === 'winter-2026-2027') {
    return selected.filter(slug => WINTER_2026_27_TEAM_SLUGS.includes(slug));
  }
  return [];
}

export function isYouthClass(ageClass) {
  return YOUTH_CLASSES.includes(canonicalAgeClass(ageClass));
}

export function normalizeRosterNames(names) {
  if (!Array.isArray(names) || !names.length || names.length > 100) {
    throw new Error('ROSTER_COUNT_INVALID');
  }
  const unique = new Map();
  for (const raw of names) {
    if (typeof raw !== 'string') throw new Error('ROSTER_NAME_INVALID');
    const name = raw.normalize('NFKC').replace(/\s+/gu, ' ').trim();
    // Strictly exclude birth years, rankings, ID numbers and contact fields.
    if (name.length < 3 || name.length > 90 || /[0-9@<>\t\r\n]/u.test(raw)
       || /\d|@|https?:|\+\d|\//iu.test(name)
       || !/\p{L}/u.test(name)) throw new Error('ROSTER_NAME_INVALID');
    const key = normalized(name);
    if (!unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()];
}

export function planPrivateRosterImport({ seasonCode, ageClass, names, existingTeams }) {
  const teamSlugs = rosterTeams(ageClass, seasonCode);
  if (!teamSlugs.length) throw new Error('UNRECOGNIZED_SEASON_OR_CLASS');
  if (!Array.isArray(existingTeams) || teamSlugs.some(slug => !existingTeams.includes(slug))) {
    throw new Error('TEAM_SEASON_MAPPING_INCOMPLETE');
  }
  return {
    seasonCode,
    ageClass: canonicalAgeClass(ageClass),
    isYouth: isYouthClass(ageClass),
    // Never assume a parental consent to participate implies public publishing.
    publicVisible: false,
    teamSlugs,
    names: normalizeRosterNames(names),
  };
}
