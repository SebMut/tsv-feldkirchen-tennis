import { supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime } from '../lib/ui';

type Row = Record<string, any>;
type AdminState = {
  user: { id: string } | null;
  isSuper: boolean;
  teams: Row[];
  teamSeasons: Row[];
  memberships: Row[];
  matches: Row[];
};

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
async function renderAudit() {
  const root = el<HTMLElement>('audit-list');
  if (!root) return;
  const { data, error } = await supabase.from('club_change_log').select('*').order('occurred_at', { ascending: false }).limit(80);
  if (error) { root.textContent = 'Änderungsverlauf derzeit nicht verfügbar.'; return; }
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row: Row) => row.actor_id).filter(Boolean))];
  const profiles = actorIds.length ? (await supabase.from('profiles').select('id,display_name').in('id', actorIds)).data ?? [] : [];
  const names = new Map(profiles.map((profile: Row) => [profile.id, profile.display_name]));
  const labels: Record<string, string> = {
    matches: 'Spieltag', match_encounters: 'Einzel/Doppel', match_live_state: 'Spielstand',
    live_ticker_entries: 'Tickermeldung', events: 'Termin', news: 'Bericht/News',
    facility_status: 'Anlage',
  };
  root.innerHTML = rows.length ? `<table class="phase8-audit-table"><thead><tr><th>Zeitpunkt</th><th>Person</th><th>Bereich</th><th>Änderung</th></tr></thead><tbody>${rows.map((row: Row) => `
    <tr><td>${escapeHtml(formatDateTime(row.occurred_at))}</td><td>${escapeHtml(names.get(row.actor_id) || 'System / nicht zugeordnet')}</td>
    <td>${escapeHtml(labels[row.entity_type] || row.entity_type)}</td>
    <td>${row.operation === 'INSERT' ? 'Neu angelegt' : row.operation === 'DELETE' ? 'Entfernt' : 'Aktualisiert'}${(row.changed_fields || []).length ? ': ' + escapeHtml(row.changed_fields.join(', ')) : ''}<small>Datensatz: ${escapeHtml(String(row.entity_id).slice(0, 8))}</small></td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">Seit Aktivierung des Änderungsverlaufs wurden noch keine Änderungen erfasst. Frühere Änderungen lassen sich nicht nachträglich rekonstruieren.</p>';
}

function renderPersonalNext(base: AdminState) {
  const target = el<HTMLElement>('phase8-my-next');
  if (!target) return;
  const available = new Set(base.isSuper ? base.teams.map((t: Row) => t.id) : base.memberships
    .filter((m: Row) => m.active && m.user_id === base.user?.id).map((m: Row) => m.team_id));
  const now = Date.now();
  const matches = base.matches.filter((m: Row) => {
    const season = base.teamSeasons.find((ts: Row) => ts.id === m.team_season_id);
    return !!season && available.has(season.team_id) && new Date(m.starts_at).getTime() >= now - 3 * 3600000;
  }).sort((a: Row, b: Row) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const next = matches[0];
  if (!next) {
    target.innerHTML = '<p class="eyebrow">Mein TSV</p><h2>Mein nächster Spieltag</h2><p class="muted">Für deine Mannschaften ist momentan kein nächster Spieltag hinterlegt. Über die Übersicht kannst du weiterhin alle zugewiesenen Mannschaften öffnen.</p>';
    return;
  }
  const season = base.teamSeasons.find((ts: Row) => ts.id === next.team_season_id);
  const team = base.teams.find((row: Row) => row.id === season?.team_id);
  target.innerHTML = `<p class="eyebrow">Mein TSV · Nächstes Spiel</p><div class="phase8-next-content">
    <div><h2>${escapeHtml(team?.name || 'Mannschaft')} gegen ${escapeHtml(next.opponent)}</h2>
    <p class="muted">${escapeHtml(formatDateTime(next.starts_at))} · ${next.is_home ? 'Heimspiel' : 'Auswärtsspiel'}</p></div>
    <button type="button" class="button button--hot" id="phase8-open-next">Spieltags-Cockpit öffnen</button>
    </div>`;
  target.querySelector<HTMLButtonElement>('#phase8-open-next')?.addEventListener('click', () => {
    document.querySelector<HTMLButtonElement>('[data-panel="matches"]')?.click();
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-match-card="${next.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });
}


async function renderBtvScheduleStatus() {
  const status = el<HTMLElement>('btv-sync-status');
  const changes = el<HTMLElement>('btv-sync-changes');
  if (!status || !changes) return;
  const [{ data: runs, error: runError }, { data: records, error: changesError }] = await Promise.all([
    supabase.from('btv_import_runs').select('started_at,completed_at,status,season_year,source_fixture_count,existing_count,inserted_count,rescheduled_count,news_count,conflicts_count,error_message')
      .order('started_at', { ascending: false }).limit(8),
    supabase.from('btv_schedule_changes').select('detected_at,status,reason,old_starts_at,new_starts_at,match_id')
      .order('detected_at', { ascending: false }).limit(30),
  ]);
  if (runError || changesError) {
    status.innerHTML = '<p class="muted">Die BTV-Protokolle können momentan nicht geladen werden.</p>';
    changes.innerHTML = '';
    return;
  }
  const latest = runs?.[0];
  if (!latest) {
    status.innerHTML = '<p class="muted">Noch kein automatischer Schreibabgleich durchgeführt. Die sechs-Stunden-Prüfung ist vorbereitet, aber noch nicht aktiviert. Der erste bestätigte Abruf erstellt nur die Vergleichsbasis.</p>';
  } else {
    status.innerHTML = `<div class="phase8-btv-last">
      <strong>Letzter Lauf: ${escapeHtml(formatDateTime(latest.started_at))}</strong>
      <p>Status: ${escapeHtml(latest.status)} · Saison ${latest.season_year} · ${latest.source_fixture_count} BTV-Begegnungen</p>
      <p>Neue Spiele: ${latest.inserted_count} · Erkannte Verschiebungen: ${latest.rescheduled_count} · Veröffentlichte News: ${latest.news_count} · Konflikte: ${latest.conflicts_count}</p>
      ${latest.error_message ? `<p class="muted">Hinweis: ${escapeHtml(latest.error_message)}</p>` : ''}
      </div>`;
  }
  changes.innerHTML = records?.length ? `<div class="admin-edit-list">${records.map((change: Row) =>
    `<article class="admin-edit-item">
      <div><strong>${change.status === 'published' ? 'Spielverlegung veröffentlicht' : change.status === 'protected' ? 'Manuell geschützt' : change.status === 'historical' ? 'Historischer Termin' : 'Nicht eindeutig zugeordnet'}</strong>
      <p class="muted">${escapeHtml(formatDateTime(change.detected_at))}</p>
      <p>Bisher: ${escapeHtml(formatDateTime(change.old_starts_at))} · Neu: ${escapeHtml(formatDateTime(change.new_starts_at))}</p>
      ${change.reason ? `<p class="muted">${escapeHtml(change.reason)}</p>` : ''}</div>
      </article>`).join('')}</div>` :
    '<p class="muted">Noch keine Verschiebungen erkannt. Die Erstaufnahme ist eine stumme Vergleichsbasis.</p>';
}

export async function initPhase8Admin(base: AdminState) {
  renderPersonalNext(base);
  if (!base.isSuper) return;
  el<HTMLButtonElement>('audit-refresh')?.addEventListener('click', renderAudit);
  el<HTMLButtonElement>('btv-sync-refresh')?.addEventListener('click', renderBtvScheduleStatus);
  await Promise.all([renderAudit(), renderBtvScheduleStatus()]);
}


type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function initInstallPrompt() {
  const root = el<HTMLElement>('phase8-install');
  if (!root) return;
  const installed = window.matchMedia('(display-mode: standalone)').matches;
  if (installed) { root.classList.add('hidden'); return; }
  const button = root.querySelector<HTMLButtonElement>('[data-install-app]');
  const text = root.querySelector<HTMLElement>('[data-install-hint]');
  let request: InstallEvent | null = null;
  if (button) button.hidden = true;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    request = event as InstallEvent;
    if (button) button.hidden = false;
    if (text) text.textContent = 'Diese Website kann als App auf deinem Startbildschirm installiert werden.';
  });
  button?.addEventListener('click', async () => {
    const current = request;
    if (!current) return;
    request = null;
    await current.prompt();
    const decision = await current.userChoice;
    if (text) text.textContent = decision.outcome === 'accepted' ? 'Die Installation wurde gestartet.' : 'Du kannst die Website weiterhin normal nutzen.';
    button.hidden = true;
  });
}
