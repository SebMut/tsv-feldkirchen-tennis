import { supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime, setStatus } from '../lib/ui';

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
const localInput = (value: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  const n = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return n.toISOString().slice(0, 16);
};
const toIso = (value: string) => value ? new Date(value).toISOString() : null;

export async function loadClubNotices() {
  const root = el<HTMLElement>('club-notices');
  if (!root) return;
  try {
    const { data, error } = await supabase.from('club_notices').select('*')
      .eq('is_published', true).lte('starts_at', new Date().toISOString())
      .order('sort_order').order('starts_at', { ascending: false }).limit(12);
    if (error) throw error;
    const now = Date.now();
    const rows = (data ?? []).filter((row: Row) => !row.ends_at || new Date(row.ends_at).getTime() >= now).slice(0, 4);
    if (!rows.length) { root.classList.add('hidden'); root.innerHTML = ''; return; }
    root.classList.remove('hidden');
    root.innerHTML = `<div class="phase8-notice-heading"><p class="eyebrow">TSV Vereinsbrett</p><h2>Wichtig im Club</h2></div><div class="phase8-notice-grid">${rows.map((row: Row) => `
      <article class="phase8-notice phase8-notice--${row.kind === 'urgent' ? 'urgent' : row.kind === 'event' ? 'event' : 'info'}">
        <span class="phase8-notice-tag">${row.kind === 'urgent' ? 'Wichtige Information' : row.kind === 'event' ? 'Gemeinsam im Club' : 'Vereinsmitteilung'}</span>
        <h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.message)}</p>
        ${row.ends_at ? `<small>Hinweis gültig bis ${escapeHtml(formatDateTime(row.ends_at))}</small>` : ''}
      </article>`).join('')}</div>`;
  } catch {
    root.classList.add('hidden');
  }
}

function showNoticeStatus(message: string, tone: 'info' | 'success' | 'error' = 'info') {
  const target = el<HTMLElement>('notice-status');
  if (!target) return;
  target.classList.remove('hidden');
  setStatus(target, message, tone);
}

async function renderNotices() {
  const target = el<HTMLElement>('notice-admin-list');
  if (!target) return;
  const { data, error } = await supabase.from('club_notices').select('*').order('starts_at', { ascending: false }).limit(75);
  if (error) { showNoticeStatus(error.message, 'error'); return; }
  const notices = data ?? [];
  target.innerHTML = notices.length ? notices.map((row: Row) => `
    <article class="admin-edit-item" data-notice-id="${row.id}">
      <div><strong>${escapeHtml(row.title)}</strong><p class="muted">${row.is_published ? 'Freigegeben' : 'Entwurf'} · ${escapeHtml(formatDateTime(row.starts_at))}${row.ends_at ? ' bis ' + escapeHtml(formatDateTime(row.ends_at)) : ''}</p></div>
      <div class="actions"><button type="button" class="button ghost" data-notice-edit>Bearbeiten</button><button type="button" class="button ghost" data-notice-toggle>${row.is_published ? 'Ausblenden' : 'Freigeben'}</button></div>
    </article>`).join('') : '<p class="muted">Noch keine Vereinsmitteilungen. Neue Mitteilungen beginnen als Entwurf.</p>';
  target.querySelectorAll<HTMLElement>('[data-notice-id]').forEach(card => {
    const row = notices.find((item: Row) => item.id === card.dataset.noticeId);
    if (!row) return;
    card.querySelector<HTMLButtonElement>('[data-notice-edit]')?.addEventListener('click', () => {
      const ids: Record<string, string> = {
        'notice-id': row.id, 'notice-title': row.title, 'notice-message': row.message,
        'notice-kind': row.kind, 'notice-order': String(row.sort_order),
        'notice-start': localInput(row.starts_at), 'notice-end': localInput(row.ends_at),
      };
      for (const [id, value] of Object.entries(ids)) {
        const control = el<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id);
        if (control) control.value = value || '';
      }
      const check = el<HTMLInputElement>('notice-published');
      if (check) check.checked = !!row.is_published;
      el<HTMLFormElement>('notice-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    card.querySelector<HTMLButtonElement>('[data-notice-toggle]')?.addEventListener('click', async () => {
      const { error: toggleError } = await supabase.from('club_notices')
        .update({ is_published: !row.is_published, updated_by: (await supabase.auth.getUser()).data.user?.id, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (toggleError) return showNoticeStatus(toggleError.message, 'error');
      showNoticeStatus('Sichtbarkeit aktualisiert.', 'success');
      await Promise.all([renderNotices(), renderAudit()]);
    });
  });
}

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
    facility_status: 'Anlage', club_notices: 'Vereinsbrett',
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

export async function initPhase8Admin(base: AdminState) {
  renderPersonalNext(base);
  if (!base.isSuper) return;
  const form = el<HTMLFormElement>('notice-form');
  const reset = () => {
    form?.reset();
    if (el<HTMLInputElement>('notice-id')) el<HTMLInputElement>('notice-id')!.value = '';
    if (el<HTMLInputElement>('notice-start')) el<HTMLInputElement>('notice-start')!.value = localInput(new Date().toISOString());
    if (el<HTMLInputElement>('notice-published')) el<HTMLInputElement>('notice-published')!.checked = false;
  };
  reset();
  el<HTMLButtonElement>('notice-reset')?.addEventListener('click', reset);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const read = (id: string) => el<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id)?.value.trim() || '';
    const title = read('notice-title');
    const message = read('notice-message');
    const start = read('notice-start');
    const end = read('notice-end');
    if (title.length < 3 || message.length < 3 || !start) return showNoticeStatus('Titel, Mitteilung und Beginn sind erforderlich.', 'error');
    if (end && new Date(end).getTime() <= new Date(start).getTime()) return showNoticeStatus('Der Endzeitpunkt muss nach dem Beginn liegen.', 'error');
    const patch = {
      title, message, kind: read('notice-kind') || 'info',
      sort_order: Number(read('notice-order')) || 0,
      starts_at: toIso(start), ends_at: toIso(end),
      is_published: !!el<HTMLInputElement>('notice-published')?.checked,
      updated_at: new Date().toISOString(), updated_by: base.user?.id,
    };
    const id = read('notice-id');
    const result = id ? await supabase.from('club_notices').update(patch).eq('id', id)
      : await supabase.from('club_notices').insert({ ...patch, created_by: base.user?.id });
    if (result.error) return showNoticeStatus(result.error.message, 'error');
    reset();
    showNoticeStatus('Mitteilung gespeichert.', 'success');
    await Promise.all([renderNotices(), renderAudit()]);
  });
  el<HTMLButtonElement>('audit-refresh')?.addEventListener('click', renderAudit);
  await Promise.all([renderNotices(), renderAudit()]);
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
