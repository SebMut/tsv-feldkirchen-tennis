import { calendarFeedUrl, supabase } from './supabase';

export type IcsEntry = {
  uid: string;
  title: string;
  start: string;
  end: string;
  kind: 'event' | 'match';
};

export type IcsInspection = {
  entries: IcsEntry[];
  etag: string | null;
  lastModified: string | null;
  checkedAt: string;
  url: string;
};

/** Only public, published events are inspected. Draft details are never returned to visitors. */
export async function inspectCalendarFeed(params: Record<string, string> = {}): Promise<IcsInspection> {
  const url = calendarFeedUrl(params);
  const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'text/calendar' } });
  if (!response.ok) throw Error('Kalenderfeed nicht erreichbar (HTTP ' + response.status + ').');
  if (!(response.headers.get('content-type') || '').includes('text/calendar')) throw Error('Kalenderfeed liefert kein gültiges ICS-Format.');
  const source = await response.text();
  const unfolded = source.replace(/\r?\n[ \t]/g, '').replace(/\r\n/g, '\n');
  if (!unfolded.startsWith('BEGIN:VCALENDAR\n') || !unfolded.includes('\nEND:VCALENDAR')) {
    throw Error('Kalenderfeed ist unvollständig.');
  }
  const unescape = (value: string) => value.replace(/\\([nN,;\\])/g, (_, char: string) =>
    char === 'n' || char === 'N' ? '\n' : char);
  const entries = unfolded.split('BEGIN:VEVENT\n').slice(1).map(section => {
    const body = section.split('\nEND:VEVENT')[0] || '';
    const fields = new Map<string, string>();
    for (const line of body.split('\n')) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      fields.set(line.slice(0, colon).split(';')[0].toUpperCase(), line.slice(colon + 1));
    }
    const uid = fields.get('UID') || '';
    return {
      uid,
      title: unescape(fields.get('SUMMARY') || ''),
      start: fields.get('DTSTART') || '',
      end: fields.get('DTEND') || '',
      kind: uid.startsWith('event-') ? 'event' as const : 'match' as const,
    };
  }).filter(entry => entry.uid);
  return {
    entries,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    checkedAt: new Date().toISOString(),
    url,
  };
}

export function formatIcsTime(value: string): string {
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const timestamp = value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(timestamp));
  }
  if (/^\d{8}$/.test(value)) return value.slice(6, 8) + '.' + value.slice(4, 6) + '.' + value.slice(0, 4) + ' (ganztägig)';
  return value || 'Keine Endzeit';
}

type EventSnapshot = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  all_day: boolean;
};

const icsStamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsDay = (value: string) => value.slice(0, 10).replaceAll('-', '');

export async function verifyEventCalendarPublication(id: string, expectedStatus?: string): Promise<{
  event: EventSnapshot;
  message: string;
  inspection: IcsInspection;
}> {
  // Readback runs as the signed-in admin. Database RLS remains the source of role permissions.
  const { data, error } = await supabase.from('events')
    .select('id,title,starts_at,ends_at,status,all_day').eq('id', id).maybeSingle();
  if (error || !data) throw Error('Gespeicherten Veranstaltungsstatus nicht lesbar: ' + (error?.message || 'Kein Datensatz'));
  const event = data as EventSnapshot;
  if (expectedStatus && event.status !== expectedStatus) {
    throw Error('Freigabe weicht nach dem Speichern ab: erwartet „' + expectedStatus + '“, gespeichert „' + event.status + '“.');
  }

  const inspection = await inspectCalendarFeed({ type: 'events', include_events: '1' });
  const entry = inspection.entries.find(item => item.uid === 'event-' + id + '@tennis-tsvfeldkirchen.de');
  if (event.status !== 'published') {
    if (entry) throw Error('Entwurf/Archiv ist fälschlich öffentlich im ICS-Abo enthalten.');
    return { event, inspection, message: 'Nicht öffentlich (' + (event.status === 'draft' ? 'Entwurf' : 'archiviert') + '); entsprechend nicht im Abo.' };
  }
  if (!entry) throw Error('Veranstaltung ist veröffentlicht, fehlt aber im öffentlichen ICS-Feed.');
  const start = event.all_day ? icsDay(event.starts_at) : icsStamp(event.starts_at);
  const end = event.ends_at ? (event.all_day ? icsDay(event.ends_at) : icsStamp(event.ends_at)) : '';
  if (entry.start !== start || entry.end !== end || entry.title !== event.title) {
    throw Error('ICS-Abweichung: Titel, Beginn oder Ende stimmt nicht mit der gespeicherten Veranstaltung überein.');
  }
  return { event, inspection, message: 'Veröffentlicht und im ICS-Abo geprüft: ' + formatIcsTime(entry.start) +
    (entry.end ? ' bis ' + formatIcsTime(entry.end) : ' (ohne Endzeit)') + '.' };
}
