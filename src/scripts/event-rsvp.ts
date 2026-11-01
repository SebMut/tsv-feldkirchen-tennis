import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/ui';

type RsvpChoice = 'yes' | 'no' | 'maybe';
type EventRow = { id: string; slug: string; title: string; description: string | null; starts_at: string; location_name: string | null };
type Summary = { yes: number; no: number; maybe: number; persons: number };

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

export async function initEventRsvp() {
  const form = byId<HTMLFormElement>('rsvp-form');
  const feedback = byId<HTMLElement>('rsvp-form-feedback');
  const nameInput = byId<HTMLInputElement>('rsvp-member-name');
  const countInput = byId<HTMLInputElement>('rsvp-person-count');
  const countWrap = byId<HTMLElement>('rsvp-count-wrap');
  const submit = byId<HTMLButtonElement>('rsvp-submit');
  if (!form || !feedback || !nameInput || !countInput || !countWrap || !submit) return;

  const choice = () => form.querySelector<HTMLInputElement>('input[name="attendance"]:checked')?.value as RsvpChoice || 'yes';
  const updateChoice = () => {
    countWrap.hidden = choice() !== 'yes';
    countInput.required = choice() === 'yes';
    form.querySelectorAll<HTMLElement>('.rsvp-choice').forEach(label => {
      label.classList.toggle('is-chosen', !!label.querySelector<HTMLInputElement>('input')?.checked);
    });
  };
  form.querySelectorAll<HTMLInputElement>('input[name="attendance"]').forEach(input => input.addEventListener('change', updateChoice));
  byId<HTMLButtonElement>('rsvp-count-minus')?.addEventListener('click', () => {
    countInput.value = String(Math.max(1, Math.min(20, Number(countInput.value) - 1 || 1)));
  });
  byId<HTMLButtonElement>('rsvp-count-plus')?.addEventListener('click', () => {
    countInput.value = String(Math.max(1, Math.min(20, Number(countInput.value) + 1 || 1)));
  });
  updateChoice();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug')?.trim() || 'sommerfest';
  // Demo is the safe fallback: it does not create a fictional public event.
  let active: EventRow | null = null;
  const response = await supabase.from('events')
    .select('id,slug,title,description,starts_at,location_name')
    .eq('slug', slug).eq('status', 'published').eq('rsvp_enabled', true).maybeSingle();
  if (response.data) active = response.data as EventRow;
  const event = active;
  if (event) {
    byId<HTMLElement>('rsvp-heading')!.textContent = event.title;
    byId<HTMLElement>('rsvp-description')!.textContent = event.description || 'Wir freuen uns über deine Rückmeldung.';
    byId<HTMLElement>('rsvp-date')!.textContent = formatDateTime(event.starts_at);
    byId<HTMLElement>('rsvp-location')!.textContent = event.location_name || 'Ort wird bekannt gegeben';
    byId<HTMLElement>('rsvp-mode-label')!.textContent = 'Anmeldung zur Veranstaltung';
    byId<HTMLElement>('rsvp-demo-note')!.textContent = 'Deine Antwort wird sicher für die Vereinsplanung gespeichert. Namen sind nicht öffentlich sichtbar.';
  } else {
    byId<HTMLElement>('rsvp-mode-label')!.textContent = 'Sommerfest · Demo';
    byId<HTMLElement>('rsvp-demo-note')!.textContent = response.error
      ? 'Die Veranstaltung konnte nicht geladen werden. Der Demo-Modus speichert keine Antwort.'
      : 'Das Sommerfest ist aktuell nur eine Vorschau. Hier kannst du die Anmeldung ausprobieren; es wird noch nichts an den Verein übermittelt.';
    byId<HTMLElement>('rsvp-summary')?.classList.add('is-demo');
    const summaryLabel = byId<HTMLElement>('rsvp-stat-yes');
    if (summaryLabel) summaryLabel.textContent = '–';
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

  if (event && new Date(event.starts_at).getTime() <= Date.now()) {
    submit.disabled = true;
    feedback.classList.remove('hidden');
    feedback.textContent = 'Die Anmeldung für diese Veranstaltung ist bereits geschlossen.';
    return;
  }

  const keyName = event ? `tsv-event-rsvp-token:${event.id}` : '';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberName = nameInput.value.trim();
    const selected = choice();
    const partySize = selected === 'yes' ? Number(countInput.value) : 0;
    feedback.classList.remove('hidden');
    if (memberName.length < 2 || memberName.length > 100
      || (selected === 'yes' && (!Number.isInteger(partySize) || partySize < 1 || partySize > 20))) {
      feedback.textContent = 'Bitte deinen Namen und eine gültige Personenzahl (1 bis 20) angeben.';
      feedback.classList.add('is-error');
      return;
    }
    feedback.classList.remove('is-error');
    if (!event) {
      feedback.textContent = `Beispiel: ${selected === 'yes' ? `Zusage für ${partySize} ${partySize === 1 ? 'Person' : 'Personen'}` : selected === 'maybe' ? 'Vielleicht' : 'Absage'} – diese Demo-Antwort wurde nicht gespeichert.`;
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
        p_event_id: event.id, p_edit_key: editKey,
        p_member_name: memberName, p_attendance: selected, p_party_size: partySize,
      });
      if (error) {
        feedback.textContent = 'Die Rückmeldung konnte nicht gespeichert werden: ' + error.message;
        feedback.classList.add('is-error');
        return;
      }
      localStorage.setItem(keyName, editKey);
      feedback.textContent = selected === 'yes'
        ? `Danke! Deine Zusage für ${partySize} ${partySize === 1 ? 'Person' : 'Personen'} ist gespeichert.`
        : selected === 'maybe'
          ? 'Danke! Dein „Vielleicht“ ist gespeichert.'
          : 'Danke! Deine Absage ist gespeichert.';
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
