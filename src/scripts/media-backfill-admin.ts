import { supabase } from '../lib/supabase';
import { uploadImageToMedia } from '../lib/media-upload';

/**
 * Super-admin assisted, rollback-safe existing-media optimization.
 * Reads and writes only the existing public tables and Supabase media bucket.
 * Never deletes the original: legacy paths can be shared across records.
 * Storage and table RLS remain the ultimate authorization layer.
 */
type Candidate = {
  table: 'events' | 'news' | 'teams' | 'team_seasons' | 'sponsors' | 'officials';
  id: string;
  field: string;
  oldPath: string;
  directory: string;
  limit: number;
};
const media = supabase.storage.from('media');
const specs = [
  { table: 'events', field: 'hero_image_path', prefix: 'events', limit: 560 * 1024 },
  { table: 'news', field: 'hero_image_path', prefix: 'news', limit: 560 * 1024 },
  { table: 'teams', field: 'image_path', prefix: 'teams', limit: 750 * 1024 },
  { table: 'team_seasons', field: 'team_image_path', prefix: 'teams', limit: 750 * 1024 },
  { table: 'sponsors', field: 'logo_path', prefix: 'sponsors', limit: 350 * 1024 },
  { table: 'officials', field: 'photo_path', prefix: 'officials', limit: 560 * 1024 },
] as const;
const contentType = (path: string) => {
  const extension = path.split('.').pop()?.toLowerCase();
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
    : extension === 'png' ? 'image/png'
    : extension === 'webp' ? 'image/webp'
    : extension === 'avif' ? 'image/avif'
    : null;
};

export function initMediaBackfillAdmin() {
  const scanButton = document.getElementById('ops-media-analyze') as HTMLButtonElement | null;
  const optimizeButton = document.getElementById('ops-media-optimize') as HTMLButtonElement | null;
  const report = document.getElementById('ops-media-report');
  if (!scanButton || !optimizeButton || !report || scanButton.dataset.ready) return;
  scanButton.dataset.ready = 'true';
  let candidates: Candidate[] = [];
  let scanning = false;
  let working = false;
  const originals = new Map<string, Blob>();
  const announce = (text: string) => { report.textContent = text; };

  const scan = async () => {
    if (scanning || working) return;
    scanning = true;
    scanButton.disabled = optimizeButton.disabled = true;
    candidates = [];
    originals.clear();
    announce('Vorhandene Bildreferenzen werden geprüft …');
    try {
      for (const spec of specs) {
        const field = spec.field;
        // Select only referenced media paths and verified identifiers; no full-table scans with *.
        const selection = spec.table === 'team_seasons' ? 'id,team_id,' + field : 'id,' + field;
        const { data, error } = await supabase.from(spec.table).select(selection).not(field, 'is', null);
        if (error) throw new Error('Bildreferenzen konnten nicht gelesen werden: ' + error.message);
        for (const row of data || []) {
          const path = String((row as Record<string, unknown>)[field] || '');
          const uuid = String((row as Record<string, unknown>).id);
          const owner = spec.table === 'team_seasons'
            ? String((row as Record<string, unknown>).team_id) : uuid;
          if (!path || !contentType(path) || !/^[0-9a-f-]{36}$/i.test(owner)) continue;
          const directory = spec.prefix + '/' + owner;
          candidates.push({ table: spec.table, field, id: uuid, oldPath: path, directory, limit: spec.limit });
        }
      }
      let originalBytes = 0;
      const oversized: Candidate[] = [];
      for (const item of candidates) {
        let blob = originals.get(item.oldPath);
        if (!blob) {
          const { data, error } = await media.download(item.oldPath);
          if (error || !data) {
            announce('Ein Bild konnte nicht gelesen werden: ' + item.oldPath + '. Bisherige Referenzen bleiben erhalten.');
            throw new Error('Storage-Download fehlgeschlagen: ' + item.oldPath);
          }
          blob = data;
          originals.set(item.oldPath, blob);
        }
        if (blob.size > item.limit && blob.size <= 8 * 1024 * 1024) {
          oversized.push(item);
          originalBytes += blob.size;
        }
      }
      candidates = oversized;
      optimizeButton.disabled = !candidates.length;
      announce(candidates.length
        ? candidates.length + ' Bildreferenzen oberhalb des Zielwerts. Zusammen derzeit ' +
          (originalBytes / 1024 / 1024).toFixed(2) + ' MB übertragen (gemeinsame Dateien mehrfach gezählt).'
        : 'Alle geprüften Bilder sind bereits innerhalb der festgelegten Größenlimits.');
    } catch (error) {
      candidates = [];
      originals.clear();
      announce('Analyse nicht abgeschlossen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      scanning = false;
      scanButton.disabled = false;
    }
  };

  scanButton.addEventListener('click', () => void scan());
  optimizeButton.addEventListener('click', async () => {
    if (working || !candidates.length || scanning) return;
    if (!window.confirm(candidates.length + ' Bildreferenzen nacheinander sicher optimieren? Die bisherigen Bilder werden nicht gelöscht.')) return;
    working = true;
    scanButton.disabled = optimizeButton.disabled = true;
    const work = [...candidates];
    let converted = 0;
    let skipped = 0;
    let savedBytes = 0;
    const failed: string[] = [];
    try {
      for (const [index, item] of work.entries()) {
        announce('Bild ' + (index + 1) + '/' + work.length + ' wird optimiert … ' + item.table);
        let uploaded: string | null = null;
        try {
          const original = originals.get(item.oldPath);
          const mime = contentType(item.oldPath);
          if (!original || !mime) throw new Error('Original nicht verfügbar');
          const file = new File([original], 'original.' + item.oldPath.split('.').pop(), { type: mime });
          uploaded = await uploadImageToMedia({
            directory: item.directory, file, basename: 'archiv-optimiert',
            maxDimension: item.table === 'events' || item.table === 'news' ? 1440 : 1800,
            quality: 0.76,
          });
          const { data: optimized, error: checkError } = await media.download(uploaded);
          if (checkError || !optimized) throw new Error('Neues Bild nicht lesbar');
          if (optimized.size >= original.size * 0.9) {
            const { error: removeError } = await media.remove([uploaded]);
            if (removeError) throw new Error('Unnötigen Upload nicht bereinigbar');
            uploaded = null;
            skipped++;
            continue;
          }
          // Compare-and-swap: concurrent edits must never be overwritten.
          const { data: updated, error: updateError } = await supabase.from(item.table)
            .update({ [item.field]: uploaded })
            .eq('id', item.id).eq(item.field, item.oldPath)
            .select('id').maybeSingle();
          if (updateError || !updated) throw new Error(updateError?.message || 'Bild wurde parallel geändert');
          savedBytes += original.size - optimized.size;
          converted++;
          uploaded = null; // Referenced new object must never be removed by error recovery.
        } catch (error) {
          failed.push(item.table + '/' + item.id + ': ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
          if (uploaded) {
            const { error: rollbackError } = await media.remove([uploaded]);
            if (rollbackError) failed.push('Rollback fehlgeschlagen für ' + uploaded);
          }
        }
      }
      announce(converted + ' Bildreferenzen aktualisiert, ' + skipped + ' bereits effizient, ' + failed.length +
        ' Hinweise. Einsparung je Seitenabruf der ersetzten Bilder: ' + (savedBytes / 1024 / 1024).toFixed(2) +
        ' MB. Alte Bilder bleiben sicher im Storage. ' + failed.slice(0, 3).join(' · '));
    } finally {
      working = false;
      originals.clear();
      candidates = [];
      scanButton.disabled = false;
      optimizeButton.disabled = true;
    }
  });
}
