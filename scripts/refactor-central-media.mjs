import fs from 'node:fs';

const adminPath = 'src/scripts/admin.ts';
const eventPath = 'src/scripts/event-rsvp-admin.ts';
let admin = fs.readFileSync(adminPath, 'utf8');
let eventAdmin = fs.readFileSync(eventPath, 'utf8');

function replaceRange(source, start, end, replacement, label) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Refactor marker missing: ${label}`);
  return source.slice(0, a) + replacement.trimEnd() + '\n\n' + source.slice(b);
}

admin = admin.replace("import { optimizeImage } from '../lib/images';", "import { replaceMediaImage, removeMediaImage, uploadImageToMedia, rollbackMediaPaths, isOwnedMediaPath } from '../lib/media-upload';");

admin = replaceRange(admin, 'async function saveTeam(event: Event) {', 'async function refreshPlayers() {', `async function saveTeam(event: Event) {
  event.preventDefault();
  const teamSeasonId = $<HTMLSelectElement>('#team-select')?.value;
  const ts = state.teamSeasons.find((row) => row.id === teamSeasonId);
  const teamId = ts?.team_id;
  if (!teamId || !ts) return;
  const oldImagePath = ts.team_image_path || null;
  const teamUpdate = {
    name: $<HTMLInputElement>('#team-name')?.value.trim(),
    short_name: $<HTMLInputElement>('#team-short-name')?.value.trim() || null,
    description: $<HTMLTextAreaElement>('#team-description')?.value.trim() || null,
  };
  const { error: teamError } = await supabase.from('teams').update(teamUpdate).eq('id', teamId);
  if (teamError) return status(teamError.message, 'error');
  const { error: seasonError } = await supabase.from('team_seasons').update({
    league: $<HTMLInputElement>('#team-league')?.value.trim() || null,
    group_name: $<HTMLInputElement>('#team-group')?.value.trim() || null,
    btv_url: $<HTMLInputElement>('#team-btv-url')?.value.trim() || null,
  }).eq('id', ts.id);
  if (seasonError) return status(seasonError.message, 'error');
  const file = $<HTMLInputElement>('#team-image')?.files?.[0];
  if (file) {
    try {
      await replaceMediaImage({ directory: \`teams/\${teamId}/seasons/\${ts.id}\`, file, oldPath: oldImagePath, persistPath: async (path) => {
        const { error } = await supabase.from('team_seasons').update({ team_image_path: path }).eq('id', ts.id);
        return { error };
      }});
    } catch (error) { return status(error instanceof Error ? error.message : 'Mannschaftsbild konnte nicht gespeichert werden.', 'error'); }
  }
  await loadCore(); renderSelectors();
  const teamSelect = $<HTMLSelectElement>('#team-select'); if (teamSelect) teamSelect.value = ts.id;
  fillTeamForm(); await refreshDashboard(); status('Mannschaft gespeichert.', 'success');
}

async function resetTeamImage() {
  const teamSeasonId = $<HTMLSelectElement>('#team-select')?.value;
  const ts = state.teamSeasons.find((row) => row.id === teamSeasonId);
  const team = state.teams.find((row) => row.id === ts?.team_id);
  if (!ts || !team) return;
  try {
    await removeMediaImage({ path: ts.team_image_path, directory: \`teams/\${team.id}/seasons/\${ts.id}\`, clearReference: async () => {
      const { error } = await supabase.from('team_seasons').update({ team_image_path: null }).eq('id', ts.id); return { error };
    }});
  } catch (error) { return status(error instanceof Error ? error.message : 'Saisonbild konnte nicht entfernt werden.', 'error'); }
  await loadCore(); renderSelectors();
  const teamSelect = $<HTMLSelectElement>('#team-select'); if (teamSelect) teamSelect.value = ts.id;
  fillTeamForm(); status('Saisonbild entfernt. Das allgemeine Mannschaftsbild wird wieder verwendet.', 'success');
}
`, 'team image');

admin = replaceRange(admin, 'async function savePlayer(event: Event) {', '// Keep only unsaved browser edits in memory;', `async function savePlayer(event: Event) {
  event.preventDefault();
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value;
  const ts = state.teamSeasons.find((x) => x.id === tsId);
  const displayName = $<HTMLInputElement>('#player-display-name')?.value.trim();
  const editId = $<HTMLInputElement>('#player-edit-id')?.value || '';
  if (!tsId || !ts || !displayName) return;
  let playerId = editId; let oldPhotoPath: string | null = null;
  if (editId) {
    const existingPlayer = (await supabase.from('players').select('photo_path').eq('id', editId).maybeSingle()).data;
    oldPhotoPath = existingPlayer?.photo_path || null;
    const { error } = await supabase.from('players').update({ display_name: displayName, active: true }).eq('id', editId);
    if (error) return status(error.message, 'error');
  } else {
    const { data: player, error } = await supabase.from('players').insert({ display_name: displayName, active: true }).select().single();
    if (error || !player) return status(error?.message || 'Spieler konnte nicht angelegt werden.', 'error');
    playerId = player.id;
    const { error: linkError } = await supabase.from('team_players').insert({ team_season_id: tsId, player_id: playerId, is_captain: $<HTMLInputElement>('#player-captain')?.checked ?? false, public_visible: $<HTMLInputElement>('#player-public-visible')?.checked ?? false });
    if (linkError) return status(linkError.message, 'error');
  }
  if (editId) {
    const { error: linkError } = await supabase.from('team_players').update({ is_captain: $<HTMLInputElement>('#player-captain')?.checked ?? false, public_visible: $<HTMLInputElement>('#player-public-visible')?.checked ?? false }).eq('team_season_id', tsId).eq('player_id', playerId);
    if (linkError) return status(linkError.message, 'error');
  }
  const file = $<HTMLInputElement>('#player-photo')?.files?.[0];
  if (file) {
    try {
      await replaceMediaImage({ directory: \`teams/\${ts.team_id}/players/\${playerId}\`, file, maxDimension: 1200, quality: 0.82, oldPath: oldPhotoPath, persistPath: async (path) => {
        const { error } = await supabase.from('players').update({ photo_path: path }).eq('id', playerId); return { error };
      }});
    } catch (error) { return status(error instanceof Error ? error.message : 'Spielerfoto konnte nicht gespeichert werden.', 'error'); }
  }
  resetPlayerForm(); status(editId ? 'Spieler aktualisiert.' : 'Spieler hinzugefügt.', 'success'); refreshPlayers();
}

// Keep only unsaved browser edits in memory;`, 'player image');

admin = replaceRange(admin, 'async function addNews(event: Event){', 'async function refreshGalleries() {', `async function addNews(event: Event){
 event.preventDefault();
 const editId=editorialInput('news-edit-id')?.value||null,title=editorialInput('news-title')?.value.trim()||'',teamId=editorialInput('news-team')?.value||null,referenceValue=editorialInput('news-match')?.value||'',publication=editorialInput('news-status')?.value||'draft',body=editorialInput('news-body')?.value.trim()||'',eventStart=editorialInput('news-event-start')?.value||'',eventEnd=editorialInput('news-event-end')?.value||'';
 const relatedEventId=referenceValue.startsWith('event:')?referenceValue.slice(6):null,matchId=relatedEventId?null:(referenceValue||null);
 if(!title||!body)return status('Titel und Text fehlen.','error');
 if(eventEnd&&!eventStart)return status('Für ein Ende muss auch ein Beginn eingetragen sein.','error');
 if(eventStart&&eventEnd&&new Date(eventEnd).getTime()<new Date(eventStart).getTime())return status('Das Terminende darf nicht vor dem Beginn liegen.','error');
 if(!state.isSuper&&(!teamId||!canEditTeamId(teamId)))return status('Keine Redaktionsberechtigung.','error');
 if(matchId){const match=state.matches.find(m=>m.id===matchId),ts=state.teamSeasons.find(x=>x.id===match?.team_season_id);if(!match||ts?.team_id!==teamId)return status('Das Spiel gehört nicht zu dieser Mannschaft.','error');}
 if(relatedEventId){const related=state.newsReferenceEvents.find(e=>e.id===relatedEventId);if(!related||(related.team_id||null)!==teamId)return status('Der Termin gehört nicht zu dieser Mannschaft.','error');}
 let originalPublishDate:string|null=null,oldHeroPath:string|null=null;
 if(editId){const existing=await supabase.from('news').select('published_at,hero_image_path').eq('id',editId).maybeSingle();if(existing.error)return status(existing.error.message,'error');originalPublishDate=existing.data?.published_at||null;oldHeroPath=existing.data?.hero_image_path||null;}
 const patch={title,body,excerpt:editorialInput('news-excerpt')?.value.trim()||null,team_id:teamId,match_id:matchId,related_event_id:relatedEventId,status:publication,published_at:publication==='published'?(originalPublishDate||new Date().toISOString()):null};
 const result=editId?await supabase.from('news').update(patch).eq('id',editId).select('id').single():await supabase.from('news').insert({...patch,slug:\`\${slugify(title)}-\${Date.now().toString(36)}\`,author_id:state.user.id}).select('id').single();
 if(result.error||!result.data)return status(result.error?.message||'Speichern fehlgeschlagen.','error');
 const newsId=result.data.id,linked=await supabase.from('events').select('id').eq('external_url',\`news:\${newsId}\`).maybeSingle();
 if(linked.error)return status(\`Beitrag gespeichert, Termin konnte nicht geprüft werden: \${linked.error.message}\`,'error');
 if(eventStart){const eventPatch={title,description:body,category:'club',starts_at:new Date(eventStart).toISOString(),ends_at:eventEnd?new Date(eventEnd).toISOString():null,location_name:editorialInput('news-event-location')?.value.trim()||null,team_id:teamId,status:publication==='published'?'published':publication==='archived'?'archived':'draft',external_url:\`news:\${newsId}\`};const eventResult=linked.data?await supabase.from('events').update(eventPatch).eq('id',linked.data.id):await supabase.from('events').insert({...eventPatch,slug:\`news-\${newsId}\`,created_by:state.user.id});if(eventResult.error)return status(\`Beitrag gespeichert, Kalendertermin fehlgeschlagen: \${eventResult.error.message}\`,'error');}else if(linked.data){const removed=await supabase.from('events').delete().eq('id',linked.data.id);if(removed.error)return status(\`Beitrag gespeichert, alter Kalendertermin konnte nicht entfernt werden: \${removed.error.message}\`,'error');}
 const photo=document.getElementById('news-image');
 if(photo instanceof HTMLInputElement&&photo.files?.[0]){try{await replaceMediaImage({directory:teamId?\`teams/\${teamId}/news/\${newsId}\`:\`news/\${newsId}\`,file:photo.files[0],oldPath:oldHeroPath,persistPath:async(path)=>{const {error}=await supabase.from('news').update({hero_image_path:path}).eq('id',newsId);return {error};}});}catch(error){return status('Text gespeichert, Bildfehler: '+(error instanceof Error?error.message:'Unbekannter Fehler'),'error');}}
 const form=document.getElementById('news-form');if(form instanceof HTMLFormElement)form.reset();editorialInput('news-edit-id').value='';editorialInput('news-status').value='draft';document.getElementById('news-cancel-edit')?.classList.add('hidden');document.getElementById('news-preview')?.classList.add('hidden');status(editId?'Beitrag aktualisiert.':'Beitrag erstellt.','success');await refreshNews();await refreshNewsReferenceEvents();
}

async function refreshGalleries() {`, 'news image');

admin = replaceRange(admin, 'async function addGallery(event: Event) {', 'async function loadFacility() {', `async function addGallery(event: Event) {
  event.preventDefault();
  const teamId=$<HTMLSelectElement>('#gallery-team')?.value,title=$<HTMLInputElement>('#gallery-title')?.value.trim(),matchId=$<HTMLSelectElement>('#gallery-match')?.value||null,files=Array.from($<HTMLInputElement>('#gallery-files')?.files??[]);
  if(!teamId||!title||!files.length)return;
  const {data:gallery,error}=await supabase.from('galleries').insert({title,team_id:teamId,match_id:matchId,published:$<HTMLInputElement>('#gallery-published')?.checked??true,created_by:state.user.id}).select().single();
  if(error||!gallery)return status(error?.message||'Galerie konnte nicht angelegt werden.','error');
  const uploaded:string[]=[];
  try{
    for(const [index,file] of files.entries()){
      const directory=matchId?\`matches/\${matchId}/gallery/\${gallery.id}\`:\`teams/\${teamId}/gallery/\${gallery.id}\`;
      const path=await uploadImageToMedia({directory,file,maxDimension:1800,quality:0.82,basename:\`image-\${index+1}\`});uploaded.push(path);
      const {error:itemError}=await supabase.from('gallery_items').insert({gallery_id:gallery.id,storage_path:path,alt_text:\`\${title} – Bild \${index+1}\`,sort_order:index});
      if(itemError)throw itemError;
    }
  }catch(error){await supabase.from('gallery_items').delete().eq('gallery_id',gallery.id);await supabase.from('galleries').delete().eq('id',gallery.id);await rollbackMediaPaths(uploaded);return status(error instanceof Error?error.message:'Galerie konnte nicht gespeichert werden.','error');}
  ($<HTMLFormElement>('#gallery-form'))?.reset();const published=$<HTMLInputElement>('#gallery-published');if(published)published.checked=true;status('Galerie gespeichert.','success');refreshGalleries();
}

async function loadFacility() {`, 'gallery upload');

admin = admin.replace(`    const galleryItems = items.filter((item) => item.gallery_id === galleryId);\n    const paths = galleryItems.map((item) => item.storage_path).filter(Boolean);\n    if (paths.length) {\n      const { error: storageError } = await supabase.storage.from('media').remove(paths);\n      if (storageError) return status(storageError.message, 'error');\n    }\n    const { error: itemError } = await supabase.from('gallery_items').delete().eq('gallery_id', galleryId);\n    if (itemError) return status(itemError.message, 'error');\n    const { error } = await supabase.from('galleries').delete().eq('id', galleryId);\n    if (error) status(error.message, 'error'); else {\n      status('Galerie gelöscht.', 'success');\n      refreshGalleries();\n    }`, `    const gallery= galleries.find((g)=>g.id===galleryId);\n    const galleryItems=items.filter((item)=>item.gallery_id===galleryId);\n    const expected=gallery?.match_id?\`matches/\${gallery.match_id}/gallery/\${galleryId}\`:\`teams/\${gallery?.team_id}/gallery/\${galleryId}\`;\n    const paths=galleryItems.map((item)=>String(item.storage_path||'')).filter((path)=>isOwnedMediaPath(path,expected));\n    const { error:itemError }=await supabase.from('gallery_items').delete().eq('gallery_id',galleryId);\n    if(itemError)return status(itemError.message,'error');\n    const { error }=await supabase.from('galleries').delete().eq('id',galleryId);\n    if(error)return status(error.message,'error');\n    if(paths.length){const cleanup=await supabase.storage.from('media').remove(paths);if(cleanup.error)status('Galerie gelöscht; Storage-Aufräumen wird später erneut versucht: '+cleanup.error.message,'error');else status('Galerie gelöscht.','success');}else status('Galerie gelöscht.','success');\n    refreshGalleries();`);

admin = replaceRange(admin, 'async function addSponsor(event: Event){', 'async function loadUsers() {', `async function addSponsor(event: Event){
 event.preventDefault();if(!state.isSuper)return status('Keine Berechtigung.','error');const editId=editorialInput('sponsor-edit-id').value||null,name=editorialInput('sponsor-name').value.trim();if(!name)return status('Sponsorname erforderlich.','error');
 const existing=editId?await supabase.from('sponsors').select('logo_path').eq('id',editId).maybeSingle():{data:null,error:null};if(existing.error)return status(existing.error.message,'error');
 const active=document.getElementById('sponsor-active'),patch={name,url:editorialInput('sponsor-url').value.trim()||null,description:editorialInput('sponsor-description').value.trim()||null,sort_order:Number(editorialInput('sponsor-order').value)||0,active:active instanceof HTMLInputElement?active.checked:false};
 const result=editId?await supabase.from('sponsors').update(patch).eq('id',editId).select('id').single():await supabase.from('sponsors').insert(patch).select('id').single();if(result.error||!result.data)return status(result.error?.message||'Sponsor nicht gespeichert.','error');
 const input=document.getElementById('sponsor-logo');if(input instanceof HTMLInputElement&&input.files?.[0]){try{await replaceMediaImage({directory:\`site/sponsors/\${result.data.id}\`,file:input.files[0],maxDimension:1400,quality:0.9,oldPath:existing.data?.logo_path||null,persistPath:async(path)=>{const {error}=await supabase.from('sponsors').update({logo_path:path}).eq('id',result.data.id);return {error};}});}catch(error){return status('Sponsor gespeichert, Logo fehlgeschlagen: '+(error instanceof Error?error.message:'Unbekannter Fehler'),'error');}}
 const form=document.getElementById('sponsor-form');if(form instanceof HTMLFormElement)form.reset();editorialInput('sponsor-edit-id').value='';document.getElementById('sponsor-cancel-edit')?.classList.add('hidden');status(editId?'Sponsor aktualisiert.':'Sponsor angelegt.','success');await loadClubEntries();
}

async function addOfficial(event: Event){
 event.preventDefault();if(!state.isSuper)return status('Keine Berechtigung.','error');const editId=editorialInput('official-edit-id').value||null,name=editorialInput('official-name').value.trim(),title=editorialInput('official-title').value.trim();if(!name||!title)return status('Name und Funktion erforderlich.','error');
 const existing=editId?await supabase.from('officials').select('photo_path').eq('id',editId).maybeSingle():{data:null,error:null};if(existing.error)return status(existing.error.message,'error');
 const published=document.getElementById('official-published'),patch={name,title,email:editorialInput('official-email').value.trim()||null,phone:editorialInput('official-phone').value.trim()||null,sort_order:Number(editorialInput('official-order').value)||0,published:published instanceof HTMLInputElement?published.checked:false};
 const result=editId?await supabase.from('officials').update(patch).eq('id',editId).select('id').single():await supabase.from('officials').insert(patch).select('id').single();if(result.error||!result.data)return status(result.error?.message||'Funktionär nicht gespeichert.','error');
 const input=document.getElementById('official-photo');if(input instanceof HTMLInputElement&&input.files?.[0]){try{await replaceMediaImage({directory:\`site/officials/\${result.data.id}\`,file:input.files[0],maxDimension:1200,quality:0.85,oldPath:existing.data?.photo_path||null,persistPath:async(path)=>{const {error}=await supabase.from('officials').update({photo_path:path}).eq('id',result.data.id);return {error};}});}catch(error){return status('Funktionär gespeichert, Bild fehlgeschlagen: '+(error instanceof Error?error.message:'Unbekannter Fehler'),'error');}}
 const form=document.getElementById('official-form');if(form instanceof HTMLFormElement)form.reset();editorialInput('official-edit-id').value='';document.getElementById('official-cancel-edit')?.classList.add('hidden');status(editId?'Funktionär aktualisiert.':'Funktionär angelegt.','success');await loadClubEntries();
}

async function loadUsers() {`, 'club images');

// Event uploader: central helper + safe deletion.
eventAdmin = eventAdmin.replace("import { optimizeImage } from '../lib/images';", "import { replaceMediaImage, removeMediaImage } from '../lib/media-upload';");
eventAdmin = eventAdmin.replace(/    const oldPath = String\(event\.hero_image_path\); imageRemove\.disabled = true;[\s\S]*?    message\('Veranstaltungsbild entfernt\. Das Standardbild wird wieder verwendet\.'\); await refresh\(selectedId\);/, `    const oldPath=String(event.hero_image_path);imageRemove.disabled=true;\n    try{await removeMediaImage({path:oldPath,directory:\`events/\${selectedId}\`,clearReference:async()=>{const {error}=await supabase.from('events').update({hero_image_path:null}).eq('id',selectedId);return {error};}});message('Veranstaltungsbild entfernt. Das Standardbild wird wieder verwendet.');await refresh(selectedId);}\n    catch(error){imageRemove.disabled=false;message('Bild konnte nicht entfernt werden: '+(error instanceof Error?error.message:'Unbekannter Fehler'),true);}`);
eventAdmin = eventAdmin.replace(/        if \(!\['image\/jpeg'[\s\S]*?        if \(previous && previous !== path && String\(previous\)\.startsWith\(`events\/\$\{data\.id\}\/`\)\) await supabase\.storage\.from\('media'\)\.remove\(\[previous\]\);/, `        message('Veranstaltung gespeichert. Bild wird optimiert und hochgeladen …');\n        const previous=events.find(row=>row.id===data.id)?.hero_image_path||null;\n        try{await replaceMediaImage({directory:\`events/\${data.id}\`,file,oldPath:previous,persistPath:async(path)=>{const {error}=await supabase.from('events').update({hero_image_path:path}).eq('id',data.id);return {error};}});}\n        catch(error){message('Veranstaltung gespeichert, Bild fehlgeschlagen: '+(error instanceof Error?error.message:'Unbekannter Fehler'),true);await refresh(data.id);return;}`);

fs.writeFileSync(adminPath, admin);
fs.writeFileSync(eventPath, eventAdmin);
console.log('central media refactor applied');
