import { supabase } from '../lib/supabase';
import { escapeHtml } from '../lib/ui';

type CountRow = { name?: string; path?: string; target?: string; event?: string; views: number; day?: string; hour?: number; opponent?: string; starts_at?: string };
type Result = {
  summary: { page_views: number; previous_page_views: number; ticker_views: number; ticker_detail_views: number; tv_views: number; interactions: number };
  daily: CountRow[]; pages: CountRow[]; actions: CountRow[]; devices: CountRow[]; sources: CountRow[];
  hours: CountRow[]; ticker_matches: CountRow[]; ticker_channels: CountRow[]; started_at: string | null;
};
const n = (value: unknown) => Number(value || 0);
const fmt = (value: unknown) => new Intl.NumberFormat('de-DE').format(n(value));
const label: Record<string,string> = {
  '/': 'Startseite', '/spieltag/': 'Liveticker-Übersicht', '/spieltag/live-ticker/': 'TV-Liveticker',
  '/live/': 'Liveticker · Begegnung', '/aktuelles/': 'Aktuelles', '/termine/': 'Kalender',
  '/mannschaften/': 'Mannschaften', '/sponsoren/': 'Sponsoren', '/training/': 'Training',
  '/mitglied-werden/': 'Mitglied werden', '/kontakt/': 'Kontakt', '/ueber-uns/': 'Über uns',
  '/funktionaere/': 'Funktionäre', '/spiel/': 'Spiel', '/veranstaltung/': 'Veranstaltung',
  '/datenschutz/': 'Datenschutz', '/impressum/': 'Impressum',
  mobile: 'Smartphone', tablet: 'Tablet', desktop: 'Desktop',
  direct: 'Direkter Aufruf', internal: 'Interner Link', search: 'Suchmaschine',
  social: 'Soziale Netzwerke', external: 'Andere Website',
  page_view: 'Seitenaufruf', ticker_view: 'Liveticker', nav_click: 'Navigation',
  action_click: 'Aktion', calendar_click: 'Kalender', route_click: 'Route', content_click: 'Inhalt',
  spielort: 'Route zum Spielort', platz_buchen: 'Platz buchen',
  tv_vollbild: 'TV: Vollbild', tv_ansicht: 'TV: Ansicht wechseln', tag_oeffnen: 'Kalendertag öffnen',
};
const named = (value: unknown) => label[String(value)] || (String(value).startsWith('/mannschaften/') ? 'Mannschaft · ' + String(value).split('/')[2] : String(value || 'Unbekannt').replace(/_/g,' '));
const el = (id: string) => document.getElementById(id);
let initialized = false;
let cached: Result | null = null;
let lastDays = 30;
let inFlight = false;

function metric(title: string, value: unknown, sub = '') {
  return `<div class="analytics-metric"><span>${escapeHtml(title)}</span><strong>${fmt(value)}</strong><small>${escapeHtml(sub)}</small></div>`;
}

function rankings(rows: CountRow[], key: 'name'|'path'|'target', total?: number, maxRows = 12) {
  if (!rows?.length) return '<p class="muted">Für diesen Zeitraum noch keine Daten.</p>';
  const max = Math.max(...rows.map(r => n(r.views)), 1);
  return `<ol class="analytics-ranking">${rows.slice(0,maxRows).map((r) => `
    <li><div class="analytics-ranking__caption"><span title="${escapeHtml(String(r[key] || ''))}">${escapeHtml(named(r[key]))}</span>
      <strong>${fmt(r.views)}${total ? ` <small>(${(n(r.views)/total*100).toFixed(1).replace('.',',')} %)</small>` : ''}</strong></div>
      <div class="analytics-ranking__track"><span style="width:${Math.max(0, Math.min(100, n(r.views)/max*100))}%"></span></div></li>`).join('')}</ol>`;
}

function dailyChart(rows: CountRow[]) {
  const entries = (rows || []).slice(-45);
  if (!entries.length) return '<p class="muted">Es liegen noch keine gemessenen Aufrufe vor.</p>';
  const max = Math.max(1, ...entries.map(d => n((d as CountRow & {views:number}).views)));
  return `<div class="analytics-chart" role="img" aria-label="Tägliche Seitenaufrufe">
    ${entries.map(r => `<div class="analytics-chart__col" title="${escapeHtml(String(r.day))}: ${fmt(r.views)} Seitenaufrufe · ${fmt((r as CountRow & {ticker?:number}).ticker)} Liveticker">
      <div class="analytics-chart__bar" style="height:${Math.max(n(r.views) > 0 ? 3 : 0, n(r.views)/max*100)}%"></div>
    </div>`).join('')}</div><div class="analytics-chart__labels"><span>${escapeHtml(String(entries[0].day || ''))}</span><span>${escapeHtml(String(entries[entries.length-1].day || ''))}</span></div>`;
}

function hourlyChart(rows: CountRow[]) {
  const data = new Map(rows.map(r => [n(r.hour),n(r.views)]));
  const max = Math.max(1,...data.values());
  return `<div class="analytics-hours" aria-label="Seitenaufrufe nach Uhrzeit, Ortszeit Deutschland">${Array.from({length:24},(_,i) => `
    <div class="analytics-hours__cell" title="${i}:00–${i+1}:00 Uhr: ${fmt(data.get(i))} Aufrufe">
      <div style="height:${Math.max((data.get(i)||0) ? 3:0, (data.get(i)||0)/max*100)}%"></div>
      <span>${i%3===0 ? i+'h' : ''}</span>
    </div>`).join('')}</div>`;
}

function render(data: Result, days: number) {
  const s = data.summary;
  const prior = n(s.previous_page_views);
  const change = prior ? ((n(s.page_views) - prior)/prior*100) : null;
  el('analytics-metrics')!.innerHTML =
    metric('Seitenaufrufe',s.page_views, change === null ? 'Kein Vergleichszeitraum' : `${change >= 0 ? '+' : ''}${change.toFixed(1).replace('.',',')} % zum Vorzeitraum`) +
    metric('Liveticker-Anzeigen',s.ticker_views,'Übersicht + Einzelspiel + TV') +
    metric('Einzelne Begegnungen',s.ticker_detail_views,'Geöffnete Spiel-Liveticker') +
    metric('TV-Liveticker',s.tv_views,'Aufrufe der TV-Ansicht') +
    metric('Interaktionen',s.interactions,'Klicks auf erfasste Funktionen') +
    metric('Aufrufe je Tag',days ? Math.round(n(s.page_views)/days):0,'Durchschnitt im Zeitraum');
  el('analytics-daily')!.innerHTML = dailyChart(data.daily);
  el('analytics-pages')!.innerHTML = rankings(data.pages,'path',n(s.page_views));
  el('analytics-ticker-channels')!.innerHTML = rankings(data.ticker_channels,'path',n(s.ticker_views));
  el('analytics-devices')!.innerHTML = rankings(data.devices,'name',n(s.page_views));
  el('analytics-sources')!.innerHTML = rankings(data.sources,'name',n(s.page_views));
  el('analytics-hours')!.innerHTML = hourlyChart(data.hours || []);
  el('analytics-actions')!.innerHTML = rankings(
    data.actions.map(r => ({...r,target:`${named(r.event)}: ${named(r.target || 'allgemein')}`})),
    'target',n(s.interactions)
  );
  el('analytics-matches')!.innerHTML = data.ticker_matches?.length
    ? `<ol class="analytics-match-list">${data.ticker_matches.map(r=>`<li><div><strong>${escapeHtml(String(r.opponent || 'Begegnung'))}</strong><small>${r.starts_at ? escapeHtml(new Date(r.starts_at).toLocaleDateString('de-DE')) : 'Datum unbekannt'}</small></div><strong>${fmt(r.views)} Aufrufe</strong></li>`).join('')}</ol>`
    : '<p class="muted">Noch keine einzelnen Spiel-Liveticker geöffnet.</p>';
  el('analytics-empty')?.classList.toggle('hidden',n(s.page_views) > 0);
  if (data.started_at) el('analytics-recording-since')!.textContent =
    'Erster erfasster Wert: ' + new Date(data.started_at).toLocaleString('de-DE');
}

async function refresh() {
  if (inFlight) return;
  inFlight = true;
  const select = el('analytics-range') as HTMLSelectElement;
  const button = el('analytics-refresh') as HTMLButtonElement;
  const message = el('analytics-feedback')!;
  button.disabled = true;
  message.textContent = 'Statistik wird geladen …';
  const days = Number(select?.value) || 30;
  try {
    const {data,error} = await supabase.rpc('admin_site_analytics',{p_days:days});
    if (error) throw error;
    if (!data?.summary) throw new Error('Keine gültige Statistikantwort erhalten.');
    cached = data as Result;
    lastDays = days;
    render(cached,days);
    message.textContent = 'Zuletzt aktualisiert: ' + new Date().toLocaleString('de-DE');
  } catch (e) {
    message.textContent = 'Statistik nicht erreichbar: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler');
  } finally {button.disabled = false; inFlight = false;}
}

function downloadCsv() {
  if (!cached) return;
  const sets: Array<[string,CountRow[],string]> = [
    ['Seiten',cached.pages,'path'],['Liveticker',cached.ticker_channels,'path'],
    ['Begegnungen',cached.ticker_matches,'opponent'],['Aktionen',cached.actions,'target'],
    ['Geräte',cached.devices,'name'],['Quellen',cached.sources,'name'],['Tage',cached.daily,'day'],
  ];
  const lines=['Bereich;Eintrag;Aufrufe'];
  for (const [group,rows,key] of sets) {
    for (const row of rows) {
      const entry=String((row as Record<string,unknown>)[key]||'').replace(/"/g,'""');
      lines.push(`"${group}";"${entry}";${n(row.views)}`);
    }
  }
  const blob = new Blob(['\ufeff',lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  const url=URL.createObjectURL(blob);
  link.href=url;link.download=`tsv-statistik-${lastDays}-tage.csv`;
  document.body.append(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),5000);
}

export function initSiteAnalyticsAdmin(isSuper: boolean) {
  if (!isSuper || initialized || !el('panel-analytics')) return;
  initialized = true;
  el('analytics-range')?.addEventListener('change',()=>void refresh());
  el('analytics-refresh')?.addEventListener('click',()=>void refresh());
  el('analytics-export')?.addEventListener('click',downloadCsv);
  document.addEventListener('tsv:analytics-open',()=>void refresh());
}
