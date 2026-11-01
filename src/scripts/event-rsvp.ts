import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/ui';

type RsvpChoice = 'yes' | 'no' | 'maybe';
type EventRow = {
  id: string; slug: string; title: string; description: string | null;
  starts_at: string; location_name: string | null; rsvp_deadline: string | null;
  rsvp_details: { fee_note?: string; setup_note?: string; cleanup_note?: string; youth_note?: string } | null;
};
type Summary = { yes: number; no: number; maybe: number; persons: number; adults: number; children: number };
type YouthRegistration = { name: string; category: string };

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const YOUTH_CATEGORIES = [
  { value: 'u10-mixed', label: 'U10 · Mädchen & Jungen gemischt' },
  { value: 'u12-m', label: 'U12 · männlich' },
  { value: 'u15-m', label: 'U15 · männlich' },
  { value: 'u18-m', label: 'U18 · männlich' },
  { value: 'u18-w', label: 'U18 · weiblich' },
] as const;

export async function initEventRsvp() {
  const form = byId<HTMLFormElement>('rsvp-form');
  const feedback = byId<HTMLElement>('rsvp-form-feedback');
  const nameInput = byId<HTMLInputElement>('rsvp-member-name');
  const adultsInput = byId<HTMLInputElement>('rsvp-adults-count');
  const childrenInput = byId<HTMLInputElement>('rsvp-children-count');
  const countWrap = byId<HTMLElement>('rsvp-count-wrap');
  const submit = byId<HTMLButtonElement>('rsvp-submit');
  const youthRows = byId<HTMLElement>('rsvp-youth-rows');
  if (!form || !feedback || !nameInput || !adultsInput || !childrenInput || !countWrap || !submit || !youthRows) return;

  const choice = () => (form.querySelector<HTMLInputElement>('input[name="attendance"]:checked')?.value || 'yes') as RsvpChoice;
  const updateChoice = () => {
    countWrap.hidden = choice() !== 'yes';
    adultsInput.required = choice() === 'yes';
    childrenInput.required = choice() === 'yes';
    form.querySelectorAll<HTMLElement>('.rsvp-choice').forEach(label => {
      label.classList.toggle('is-chosen', !!label.querySelector<HTMLInputElement>('input')?.checked);
    });
  };
  form.querySelectorAll<HTMLInputElement>('input[name="attendance"]').forEach(input => input.addEventListener('change', updateChoice));
  updateChoice();

  // Nur die Kategorien der PDF-Vorlage von 2024; reale Turnierklassen
  // können Veranstalter vor der nächsten Saison neu festlegen.
  const appendYouthRow = () => {
    if (youthRows.querySelectorAll('.rsvp-youth-row').length >= 12) return;
    const row = document.createElement('div');
    row.className = 'rsvp-youth-row';
    row.innerHTML = `
      <label>Name der jugendlichen Person
        <input type="text" data-youth-name maxlength="100" placeholder="Vor- und Nachname" autocomplete="off"/>
      </label>
      <label>Altersklasse
        <select data-youth-category>${YOUTH_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}</select>
      </label>
      <button class="button ghost" type="button" data-youth-remove aria-label="Anmeldung entfernen">Entfernen</button>`;
    youthRows.append(row);
    row.querySelector<HTMLInputElement>('[data-youth-name]')?.focus();
  };
  byId<HTMLButtonElement>('rsvp-add-youth')?.addEventListener('click', appendYouthRow);
  youthRows.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    event.target.closest('[data-youth-remove]')?.closest('.rsvp-youth-row')?.remove();
  });
  const youthValues = (): YouthRegistration[] | null => {
    const values: YouthRegistration[] = [];
    for (const row of youthRows.querySelectorAll<HTMLElement>('.rsvp-youth-row')) {
      const name = row.querySelector<HTMLInputElement>('[data-youth-name]')?.value.trim() || '';
      const category = row.querySelector<HTMLSelectElement>('[data-youth-category]')?.value || '';
      if (name.length < 2 || name.length > 100 || !YOUTH_CATEGORIES.some(c => c.value === category)) return null;
      values.push({ name, category });
    }
    return values;
  };

  const slug = new URLSearchParams(window.location.search).get('slug')?.trim() || 'sommerfest';
  let active: EventRow | null = null;
  const response = await supabase.from('events')
    .select('id,slug,title,description,starts_at,location_name,rsvp_deadline,rsvp_details')
    .eq('slug', slug).eq('status', 'published').eq('rsvp_enabled', true).maybeSingle();
  if (response.data) active = response.data as EventRow;
  const event = active;
  if (event) {
    byId<HTMLElement>('rsvp-heading')!.textContent = event.title;
    byId<HTMLElement>('rsvp-description')!.textContent = event.description || 'Liebe Tennisfreunde, wir laden euch herzlich zum gemeinsamen Sommerfest ein!';
    byId<HTMLElement>('rsvp-date')!.textContent = formatDateTime(event.starts_at);
    byId<HTMLElement>('rsvp-location')!.textContent = event.location_name || 'Ort wird bekannt gegeben';
    byId<HTMLElement>('rsvp-deadline')!.textContent = event.rsvp_deadline ? formatDateTime(event.rsvp_deadline) : 'Bis zum Veranstaltungstag';
    byId<HTMLElement>('rsvp-mode-label')!.textContent = 'Einladung & Rückmeldung';
    byId<HTMLElement>('rsvp-demo-note')!.textContent = 'Antworten werden zur Veranstaltungsplanung gespeichert. Namen und Jugendanmeldungen sind nicht öffentlich einsehbar.';
    byId<HTMLElement>('rsvp-source-note')?.classList.add('hidden');
    const details = event.rsvp_details || {};
    if (details.fee_note) byId<HTMLElement>('rsvp-fees-note')!.textContent = details.fee_note;
    if (details.setup_note || details.cleanup_note) {
      byId<HTMLElement>('rsvp-helper-note')!.textContent = [details.setup_note, details.cleanup_note].filter(Boolean).join(' ');
    }
    if (details.youth_note) byId<HTMLElement>('rsvp-youth-note')!.textContent = details.youth_note;
  } else {
    byId<HTMLElement>('rsvp-mode-label')!.textContent = 'Vorlage 2024 · Demo';
    byId<HTMLElement>('rsvp-demo-note')!.textContent = response.error
      ? 'Die Veranstaltungsdaten konnten nicht geladen werden. Der Demo-Modus speichert keine Antwort.'
      : 'Diese Einladung ist eine unverbindliche Vorlage nach dem Sommerfest 2024. Bitte noch keine verbindlichen Anmeldungen abgeben.';
    byId<HTMLElement>('rsvp-summary')?.classList.add('is-demo');
  }

  async function loadSummary() {
    if (!event) return;
    const { data, error } = await supabase.rpc('event_rsvp_summary', { p_event_id: event.id });
    if (error || !data) return;
    const stats = data as Summary;
    byId<HTMLElement>('rsvp-stat-yes')!.textContent = String(stats.yes ?? 0);
    byId<HTMLElement>('rsvp-stat-people')!.textContent = String(stats.persons ?? 0);
    byId<HTMLElement>('rsvp-stat-maybe')!.textContent = String(stats.maybe ?? 0);
  }
  await loadSummary();

  const deadline = event?.rsvp_deadline ? new Date(event.rsvp_deadline).getTime() : Infinity;
  if (event && (new Date(event.starts_at).getTime() <= Date.now() || deadline <= Date.now())) {
    submit.disabled = true;
    feedback.classList.remove('hidden');
    feedback.textContent = 'Die Rückmeldefrist für diese Veranstaltung ist bereits abgelaufen.';
    return;
  }

  const keyName = event ? `tsv-event-rsvp-token:${event.id}` : '';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const memberName = nameInput.value.trim();
    const selected = choice();
    const adults = selected === 'yes' ? Number(adultsInput.value) : 0;
    const children = selected === 'yes' ? Number(childrenInput.value) : 0;
    const partySize = adults + children;
    const youth = youthValues();
    feedback.classList.remove('hidden', 'is-error');
    if (memberName.length < 2 || memberName.length > 100
      || !Number.isInteger(adults) || !Number.isInteger(children)
      || adults < 0 || children < 0 || partySize > 20
      || (selected === 'yes' && partySize < 1)) {
      feedback.textContent = 'Bitte Namen und gültige Personenanzahlen angeben (mindestens eine Person bei Zusage, maximal 20).';
      feedback.classList.add('is-error');
      return;
    }
    if (!youth) {
      feedback.textContent = 'Bitte für jede Jugendanmeldung einen vollständigen Namen und eine Altersklasse auswählen.';
      feedback.classList.add('is-error');
      return;
    }
    const dessert = byId<HTMLInputElement>('rsvp-dessert')?.value.trim() || '';
    const salad = byId<HTMLInputElement>('rsvp-salad')?.value.trim() || '';
    if (dessert.length > 180 || salad.length > 180) {
      feedback.textContent = 'Bitte die Buffetbeiträge kürzer beschreiben.';
      feedback.classList.add('is-error');
      return;
    }
    if (!event) {
      feedback.textContent = `Demo: ${selected === 'yes' ? `${adults} Erwachsene und ${children} Kinder/Jugendliche` : selected === 'maybe' ? 'Vielleicht' : 'Absage'}, ${youth.length} Jugendanmeldungen. Nichts gespeichert.`;
      return;
    }

    let editKey: string;
    try {
      editKey = localStorage.getItem(keyName) || crypto.randomUUID();
    } catch {
      feedback.textContent = 'Dein Browser verhindert die Speicherung der Änderungskennung. Bitte die Website ohne privaten Speicherschutz öffnen.';
      feedback.classList.add('is-error');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Wird gespeichert …';
    try {
      const { error } = await supabase.rpc('submit_event_rsvp', {
        p_event_id: event.id,
        p_edit_key: editKey,
        p_member_name: memberName,
        p_attendance: selected,
        p_adults: adults,
        p_children: children,
        p_dessert: dessert,
        p_salad: salad,
        p_help_setup: !!byId<HTMLInputElement>('rsvp-help-setup')?.checked,
        p_help_cleanup: !!byId<HTMLInputElement>('rsvp-help-cleanup')?.checked,
        p_youth: youth,
      });
      if (error) {
        feedback.textContent = 'Die Rückmeldung konnte nicht gespeichert werden: ' + error.message;
        feedback.classList.add('is-error');
        return;
      }
      localStorage.setItem(keyName, editKey);
      feedback.textContent = 'Danke! Deine Rückmeldung zum Sommerfest und den Jugendvereinsmeisterschaften wurde gespeichert.';
      await loadSummary();
    } catch {
      feedback.textContent = 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
      feedback.classList.add('is-error');
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Rückmeldung aktualisieren <span aria-hidden="true">›</span>';
    }
  });
}
