import { supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime } from '../lib/ui';

type Health = {
  supabase_reachable: boolean;
  integrity: { checked_at?: string; missing_media_count?: number;
    missing_media_examples?: Array<{ source: string; path: string }>;
    cron_jobs?: Array<{ name: string; active: boolean; last_status: string | null; last_run: string | null }>;
    cron_failures_24h?: number; } | null;
  btv_last_run: { status: string; started_at: string; error_message?: string } | null;
  btv_last_success: { status: string; completed_at: string; season_code: string } | null;
  btv_failures_recent: number;
  restore_check: { checked_at?: string; method?: string; notes?: string; result?: string } | null;
};
const node = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const ageDays = (date?: string) => date ? (Date.now()-new Date(date).getTime())/86400000 : Infinity;
const dateText = (value?: string) => value ? escapeHtml(formatDateTime(value)) : 'Kein erfolgreicher Lauf dokumentiert';
const tile = (title: string, state: 'ok' | 'warning' | 'error', text: string) =>
  '<article class="ops-health-tile" data-level="' + state + '"><strong>' + escapeHtml(title) +
    '</strong><p>' + escapeHtml(text) + '</p></article>';

export function initSystemMonitor(isSuper: boolean) {
  if (!isSuper) return;
  const root=node<HTMLElement>('ops-health-summary');
  if (!root || root.dataset.initialized==='true') return;
  root.dataset.initialized='true';

  const refresh=async()=>{
    root.textContent='Supabase, BTV, Medien und Hintergrundaufgaben werden geprüft …';
    const missing=node<HTMLElement>('ops-missing-media');
    const cron=node<HTMLElement>('ops-cron-jobs');
    try{
      const {data,error}=await supabase.functions.invoke('admin-users',{body:{action:'system_health'}});
      if(error || data?.ok!==true) throw Error(data?.error || error?.message || 'Abfrage fehlgeschlagen.');
      const health=data as Health & {ok:boolean};
      const checks=health.integrity;
      if(!checks)throw Error('Datenbank-Diagnose hat kein Ergebnis geliefert.');
      const goodBtv=!!health.btv_last_success && ageDays(health.btv_last_success.completed_at) <= 2;
      const missingCount=Number(checks.missing_media_count || 0);
      const cronFailures=Number(checks.cron_failures_24h || 0);
      const cronUnhealthy=(checks.cron_jobs || []).some(job=>!job.active || job.last_status!=='succeeded');
      const backupFresh=health.restore_check?.checked_at && ageDays(health.restore_check.checked_at)<=30;
      root.innerHTML=[
        tile('Supabase','ok','Erreichbar · '+formatDateTime(checks.checked_at || new Date().toISOString())),
        tile('BTV-Abgleich',goodBtv?'ok':'warning',
          health.btv_last_success?'Letzter Erfolg: '+formatDateTime(health.btv_last_success.completed_at):
          'Noch kein bestätigter Erfolg'),
        tile('Bilder im Storage',missingCount?'warning':'ok',
          missingCount===0?'Keine fehlenden referenzierten Bilder':missingCount+' fehlende Bildreferenzen'),
        tile('Hintergrundaufgaben',cronFailures || cronUnhealthy?'warning':'ok',
          cronFailures+' Fehler in 24 Stunden · '+(checks.cron_jobs || []).length+' überwachte Cronjobs'),
        tile('Wiederherstellung',backupFresh?'ok':'warning',
          backupFresh?'Prüfung innerhalb der letzten 30 Tage bestätigt':'Keine aktuelle Restore-Prüfung bestätigt'),
      ].join('');
      if(missing)missing.innerHTML=missingCount
        ? '<p>Referenzierte Speicherobjekte fehlen ('+missingCount+'). Beispiele:</p><ul class="ops-detail-list">' +
          (checks.missing_media_examples || []).map(item=>'<li><strong>'+escapeHtml(item.source)+
            '</strong>: <code>'+escapeHtml(item.path)+'</code></li>').join('')+'</ul>'
        : '<p>Alle geprüften Bildverweise zeigen auf vorhandene Objekte im Bucket media.</p>';
      if(cron)cron.innerHTML=(checks.cron_jobs || []).length
        ? '<ul class="ops-detail-list">'+(checks.cron_jobs || []).map(job=>'<li><strong>'+
          escapeHtml(job.name)+'</strong> · '+(job.active?'aktiv':'deaktiviert')+
          ' · '+escapeHtml(job.last_status || 'noch ohne Lauf')+
          (job.last_run?' · '+dateText(job.last_run):'')+'</li>').join('')+'</ul>'
        : '<p>Keine überwachten TSV-Cronjobs gefunden.</p>';
      const last=node<HTMLElement>('ops-restore-last');
      if(last){
        const check=health.restore_check;
        last.innerHTML=check?.checked_at
          ? '<p><strong>Letzte bestätigte Wiederherstellungsprüfung: '+dateText(check.checked_at)+
            '</strong> · '+escapeHtml(check.method || 'Methode unbekannt')+
            '</p><p>'+escapeHtml(check.notes || '')+'</p><p class="muted">Manuelle Bestätigung; kein automatischer Nachweis der Supabase-PITR-Verfügbarkeit.</p>'
          : '<p class="ops-warning">Noch keine echte Wiederherstellungsprüfung protokolliert.</p>';
      }
    }catch(error){
      root.innerHTML=tile('Systemüberwachung','error','Keine verlässlichen Daten: '+
        (error instanceof Error?error.message:'Unbekannter Fehler'));
      if(missing)missing.textContent='Zurzeit nicht prüfbar.';
      if(cron)cron.textContent='Zurzeit nicht prüfbar.';
    }
  };
  node<HTMLButtonElement>('ops-refresh')?.addEventListener('click',()=>void refresh());
  const form=node<HTMLFormElement>('ops-restore-form');
  form?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const button=form.querySelector<HTMLButtonElement>('[type="submit"]');
    const feedback=node<HTMLElement>('ops-restore-feedback');
    if(button)button.disabled=true;
    if(feedback)feedback.textContent='Prüfprotokoll wird sicher gespeichert …';
    try{
      const {data,error}=await supabase.functions.invoke('admin-users',{
        body:{action:'record_restore_check',confirmed:node<HTMLInputElement>('ops-restore-confirmed')?.checked===true,
          method:node<HTMLSelectElement>('ops-restore-method')?.value,
          notes:node<HTMLTextAreaElement>('ops-restore-notes')?.value || ''},
      });
      if(error || data?.ok!==true)throw Error(data?.error || error?.message || 'Nicht gespeichert.');
      form.reset();
      if(feedback)feedback.textContent='Wiederherstellungsprüfung dokumentiert.';
      await refresh();
    }catch(error){if(feedback)feedback.textContent='Prüfung nicht gespeichert: '+
      (error instanceof Error?error.message:'Unbekannter Fehler');}
    finally{if(button)button.disabled=false;}
  });
  void refresh();
}
