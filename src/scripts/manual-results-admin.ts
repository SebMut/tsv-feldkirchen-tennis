import { supabase } from '../lib/supabase';
import { setStatus } from '../lib/ui';
import { officialBtvTeamDestination } from '../lib/btv-group-url';

type Entry = {
  match_id: string;
  team_season_id: string;
  starts_at: string;
  is_home: boolean;
  opponent: string;
  btv_result_text: string | null;
  team_name: string;
  season_code: string;
  season_name: string;
  btv_url: string | null;
  tennis_de_portrait_url: string | null;
};
type WithdrawalFlag = {
  match_id: string;
  affected_side: 'home' | 'away' | 'unknown';
  source_kind: 'club_report' | 'btv_group_schedule';
  verification_status: 'reported' | 'official_verified';
  evidence_url: string | null;
};
type Manual = {
  match_id: string;
  result_status: string;
  home_points: number | null;
  away_points: number | null;
  source_type: string;
  source_url: string | null;
  notes: string | null;
  review_status: string;
};

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
const localDate = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
const localTime = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false });
let fixtures: Entry[] = [];
let manual = new Map<string, Manual>();
let withdrawalFlags = new Map<string, WithdrawalFlag>();
let verifiedBtv = new Map<string, string>();
let selected: Entry | null = null;
let initialized = false;

function showStatus(message: string, tone: 'info' | 'error' | 'success' = 'info') {
  const el = byId<HTMLElement>('manual-results-feedback');
  if (!el) return;
  el.classList.remove('hidden');
  setStatus(el, message, tone);
}

function teamHome(m: Entry) { return m.is_home ? 'TSV Feldkirchen ' + m.team_name : m.opponent; }
function teamAway(m: Entry) { return m.is_home ? m.opponent : 'TSV Feldkirchen ' + m.team_name; }
function matchLabel(m: Entry) { return teamHome(m) + ' – ' + teamAway(m); }
function isOfficial(m: Entry) { return !!m.btv_result_text?.trim(); }
// Ein bestätigter manueller Nachtrag zählt für die Aufgabenliste als bereits erfasst,
// bleibt aber bis zum offiziellen Quellenabgleich ausdrücklich ungeprüft.
function isNotYetRecorded(m: Entry) { return !isOfficial(m) && !manual.has(m.match_id) && !withdrawalFlags.has(m.match_id); }
function option(value: string, title: string): HTMLOptionElement {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = title;
  return element;
}

function renderList() {
  const list = byId<HTMLElement>('manual-results-list');
  const season = byId<HTMLSelectElement>('manual-results-season')?.value;
  const search = byId<HTMLInputElement>('manual-results-search')?.value.trim().toLocaleLowerCase('de-DE') || '';
  const openOnly = byId<HTMLInputElement>('manual-results-open-only')?.checked;
  if (!list) return;
  list.replaceChildren();

  const rows = fixtures.filter(m =>
    m.season_code === season &&
    (!openOnly || isNotYetRecorded(m)) &&
    (!search || matchLabel(m).toLocaleLowerCase('de-DE').includes(search))
  );
  // Form nicht für ein Spiel offen lassen, das im aktiven Filter nicht mehr sichtbar ist.
  if (selected && !rows.some(m => m.match_id === selected?.match_id)) {
    selected = null;
    byId<HTMLFormElement>('manual-result-form')?.classList.add('hidden');
    byId<HTMLElement>('manual-results-empty')?.classList.remove('hidden');
  }
  const count = byId<HTMLElement>('manual-results-count');
  if (count) count.textContent = String(rows.length);

  if (!rows.length) {
    const notice = document.createElement('p');
    notice.className = 'muted';
    notice.textContent = 'Keine passenden Begegnungen.';
    list.append(notice);
    return;
  }

  for (const m of rows) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary manual-result-item';
    button.setAttribute('aria-pressed', String(selected?.match_id === m.match_id));
    const when = new Date(m.starts_at);
    const heading = document.createElement('strong');
    heading.textContent = matchLabel(m);
    const metadata = document.createElement('small');
    metadata.className = 'muted';
    metadata.textContent = `${localDate.format(when)} · ${localTime.format(when)} Uhr · ${m.team_name}`;
    const tag = document.createElement('span');
    tag.className = 'muted';
    tag.textContent = isOfficial(m)
      ? 'BTV-Ergebnis bereits gespeichert: ' + m.btv_result_text
      : manual.has(m.match_id) ? 'Manuell erfasst · amtliche Prüfung offen'
      : withdrawalFlags.has(m.match_id) ? (withdrawalFlags.get(m.match_id)?.verification_status === 'official_verified'
        ? 'Mannschaft zurückgezogen · durch BTV bestätigt' : 'Rückzug gemeldet · BTV-Bestätigung offen') : 'Ergebnis offen';
    button.append(heading, metadata, tag);
    button.addEventListener('click', () => selectMatch(m.match_id));
    const item = document.createElement('div');
    item.className = 'manual-result-item-wrap';
    item.append(button);
    const btv = officialBtvTeamDestination(verifiedBtv.get(m.team_season_id));
    if (btv.href) {
      const link = document.createElement('a');
      link.href = btv.href;
      link.className = 'text-link';
      link.textContent = (btv.isDirect ? 'BTV-Tabelle ' : 'BTV-Vereinsübersicht ') + m.team_name + ' ↗';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', (btv.isDirect ? 'BTV-Tabelle und Spielplan ' : 'BTV-Vereinsübersicht für ') + m.team_name + ' öffnen');
      item.append(link);
    } else {
      const missing = document.createElement('span');
      missing.className = 'muted';
      missing.textContent = 'Offizieller Gruppenlink noch nicht bestätigt';
      item.append(missing);
    }
    list.append(item);
  }
}

function selectMatch(id: string) {
  selected = fixtures.find(m => m.match_id === id) || null;
  if (!selected) return;
  const saved = manual.get(id);
  const withdrawal = withdrawalFlags.get(id);
  const form = byId<HTMLFormElement>('manual-result-form');
  if (form) form.classList.remove('hidden');
  const noSelection = byId<HTMLElement>('manual-results-empty');
  noSelection?.classList.add('hidden');

  const specialNotice = byId<HTMLElement>('manual-results-withdrawal');
  if (specialNotice) {
    specialNotice.classList.toggle('hidden', !withdrawal);
    if (withdrawal) specialNotice.textContent =
      (withdrawal.affected_side === 'away' ? 'Gastmannschaft' : withdrawal.affected_side === 'home' ? 'Heimmannschaft' : 'Mannschaft') +
      ' zurückgezogen · ' + (withdrawal.verification_status === 'official_verified' ? 'amtlich von BTV bestätigt' : 'gemeldet, offizielle Prüfung ausstehend') +
      '. Kein reguläres Match-Ergebnis erfinden.';
  }
  const label = byId<HTMLElement>('manual-results-selected');
  const date = byId<HTMLElement>('manual-results-date');
  if (label) label.textContent = matchLabel(selected);
  if (date) {
    const when = new Date(selected.starts_at);
    date.textContent = `${localDate.format(when)} · ${localTime.format(when)} Uhr · ${selected.season_name}`;
  }
  const assign = (id: string, value: string) => { const el = byId<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id); if (el) el.value = value; };
  assign('manual-result-status', saved?.result_status || 'played');
  assign('manual-result-home', saved?.home_points == null ? '' : String(saved.home_points));
  assign('manual-result-away', saved?.away_points == null ? '' : String(saved.away_points));
  assign('manual-result-source', saved?.source_type || 'club_confirmation');
  assign('manual-result-url', saved?.source_url || '');
  assign('manual-result-notes', saved?.notes || '');
  const confirmation = byId<HTMLInputElement>('manual-result-confirm');
  if (confirmation) confirmation.checked = false;
  const save = byId<HTMLButtonElement>('manual-result-save');
  if (save) save.disabled = isOfficial(selected);

  const link = byId<HTMLAnchorElement>('manual-result-official-link');
  if (link) {
    const btv = officialBtvTeamDestination(verifiedBtv.get(selected.team_season_id));
    link.href = btv.href;
    link.classList.remove('hidden');
    link.textContent = btv.isDirect ? 'Offiziellen BTV-Spielplan öffnen ↗' : 'BTV-Vereinsübersicht öffnen (Gruppenlink ungeprüft) ↗';
  }
  if (isOfficial(selected)) showStatus('Ein offizielles BTV-Ergebnis ist bereits hinterlegt. Manuelle Änderungen sind für dieses Spiel gesperrt.', 'info');
  renderList();
}

async function loadMatches() {
  showStatus('Begegnungen werden geladen …');
  const [matchRes, manualRes, flagsRes, verifiedRes] = await Promise.all([
    supabase.from('manual_editable_matches')
      .select('match_id,team_season_id,starts_at,is_home,opponent,btv_result_text,team_name,season_code,season_name,btv_url,tennis_de_portrait_url')
      .order('starts_at', { ascending: true }).limit(1000),
    supabase.from('manual_match_results')
      .select('match_id,result_status,home_points,away_points,source_type,source_url,notes,review_status')
      .limit(1000),
    supabase.from('match_withdrawal_flags')
      .select('match_id,affected_side,source_kind,verification_status,evidence_url')
      .limit(1000),
    supabase.from('verified_team_btv_links')
      .select('team_season_id,btv_url').limit(1000),
  ]);
  if (matchRes.error) throw matchRes.error;
  if (manualRes.error) throw manualRes.error;
  if (flagsRes.error) throw flagsRes.error;
  fixtures = (matchRes.data || []) as Entry[];
  manual = new Map(((manualRes.data || []) as Manual[]).map(m => [m.match_id, m]));
  withdrawalFlags = new Map(((flagsRes.data || []) as WithdrawalFlag[]).map(m => [m.match_id, m]));
  // On a failed verification lookup, never present an unverified legacy ID as official.
  verifiedBtv = new Map((verifiedRes.data || []).map(m => [m.team_season_id, m.btv_url]));
  const seasons = new Map(fixtures.map(m => [m.season_code, m.season_name]));
  const seasonSelect = byId<HTMLSelectElement>('manual-results-season');
  if (seasonSelect) {
    const previous = seasonSelect.value;
    seasonSelect.replaceChildren();
    for (const [code, name] of seasons) seasonSelect.append(option(code, name));
    if (seasons.has(previous)) seasonSelect.value = previous;
    else if (seasons.has('sommer-2026')) seasonSelect.value = 'sommer-2026';
  }
  if (selected) {
    if (fixtures.some(m => m.match_id === selected?.match_id)) selectMatch(selected.match_id);
    else {
      selected = null;
      byId<HTMLFormElement>('manual-result-form')?.classList.add('hidden');
      byId<HTMLElement>('manual-results-empty')?.classList.remove('hidden');
    }
  }
  renderList();
  showStatus(fixtures.length ? 'Begegnungen aktualisiert.' : 'Keine berechtigten Mannschaftsbegegnungen gefunden.', fixtures.length ? 'success' : 'error');
}

async function saveMatch(event: SubmitEvent) {
  event.preventDefault();
  if (!selected || isOfficial(selected)) return showStatus('Dieses Ergebnis kann nicht manuell geändert werden.', 'error');
  const form = byId<HTMLFormElement>('manual-result-form');
  if (!form?.reportValidity()) return;
  const status = byId<HTMLSelectElement>('manual-result-status')?.value || 'played';
  const rawHome = byId<HTMLInputElement>('manual-result-home')?.value.trim() || '';
  const rawAway = byId<HTMLInputElement>('manual-result-away')?.value.trim() || '';
  if ((rawHome === '') !== (rawAway === '')) return showStatus('Heim- und Gastpunkte müssen beide ausgefüllt oder beide leer sein.', 'error');
  const home = rawHome === '' ? null : Number(rawHome);
  const away = rawAway === '' ? null : Number(rawAway);
  if ((home !== null && (!Number.isInteger(home) || home < 0 || home > 99)) ||
      (away !== null && (!Number.isInteger(away) || away < 0 || away > 99))) {
    return showStatus('Nur ganze Punkte zwischen 0 und 99 eingeben.', 'error');
  }
  if (status === 'played' && (home === null || away === null || home + away === 0)) {
    return showStatus('Für regulär gespielte Begegnungen einen gültigen Endstand Heim : Gast eingeben.', 'error');
  }
  const sourceUrl = byId<HTMLInputElement>('manual-result-url')?.value.trim() || '';
  if (sourceUrl) {
    try { if (new URL(sourceUrl).protocol !== 'https:') throw new Error('Ungültig'); }
    catch { return showStatus('Der Quellenlink muss eine gültige HTTPS-Adresse sein.', 'error'); }
  }
  if (!byId<HTMLInputElement>('manual-result-confirm')?.checked) return showStatus('Bitte die Überprüfung bestätigen.', 'error');
  const payload = {
    result_status: status,
    home_points: home,
    away_points: away,
    source_type: byId<HTMLSelectElement>('manual-result-source')?.value || 'club_confirmation',
    source_url: sourceUrl || null,
    notes: byId<HTMLTextAreaElement>('manual-result-notes')?.value.trim() || null,
  };
  const save = byId<HTMLButtonElement>('manual-result-save');
  if (save) save.disabled = true;
  try {
    const request = manual.has(selected.match_id)
      ? supabase.from('manual_match_results').update(payload).eq('match_id', selected.match_id)
      : supabase.from('manual_match_results').insert({ match_id: selected.match_id, ...payload });
    const { data, error } = await request
      .select('match_id,result_status,home_points,away_points,source_type,source_url,notes,review_status')
      .single();
    if (error) throw error;
    if (data) manual.set(selected.match_id, data as Manual);
    const recordedMatch = matchLabel(selected);
    renderList();
    showStatus('Nachtrag für ' + recordedMatch + ' gespeichert. Bei aktivierter Auswahl „Nur noch nicht erfasste Spiele“ ist die Begegnung jetzt ausgeblendet. Für spätere Korrekturen das Häkchen bei „Nur noch nicht erfasste Spiele“ entfernen. Amtliche Prüfung ausstehend.', 'success');
  } catch (e) {
    showStatus('Nachtrag konnte nicht gespeichert werden: ' + (e instanceof Error ? e.message : 'Zugriff verweigert'), 'error');
  } finally {
    if (save) save.disabled = false;
  }
}

export function initManualResultsPanel() {
  if (initialized) return;
  const panel = byId<HTMLElement>('panel-manual-results');
  if (!panel) return;
  initialized = true;
  byId<HTMLFormElement>('manual-result-form')?.addEventListener('submit', saveMatch);
  byId<HTMLSelectElement>('manual-results-season')?.addEventListener('change', () => {
    selected = null;
    byId<HTMLFormElement>('manual-result-form')?.classList.add('hidden');
    byId<HTMLElement>('manual-results-empty')?.classList.remove('hidden');
    renderList();
  });
  byId<HTMLInputElement>('manual-results-search')?.addEventListener('input', renderList);
  byId<HTMLInputElement>('manual-results-open-only')?.addEventListener('change', renderList);
  byId<HTMLButtonElement>('manual-results-refresh')?.addEventListener('click', () => {
    void loadMatches().catch(e => showStatus('Laden fehlgeschlagen: ' + String(e?.message || e), 'error'));
  });
  void loadMatches().catch(e => showStatus('Laden fehlgeschlagen: ' + String(e?.message || e), 'error'));
}
