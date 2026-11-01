import{n as e,r as t,t as n}from"./supabase.BgDdE24J.js";import{n as r,t as i}from"./ui.DpEpU-0S.js";import{i as a,n as o,t as s}from"./tennis-score.Ct3db5HJ.js";function c(e,t){if(t.status===`scheduled`)return`<span>Ergebnis</span><strong>–</strong>`;let n=o(t.result_text);if(!n.hasResult)return`<span>Ergebnis</span><strong>${i(t.result_text||`–`)}</strong>`;let{homeSets:r,awaySets:a}=s(n,!!e.is_home),c=n.scores.filter(Boolean).map(t=>{if(e.is_home)return t;let[n,r]=t.split(`:`);return`${r}:${n}`}),l=n.inProgressSetIndex,u=l==null?null:n.scores[l],d=u&&!e.is_home?u.split(`:`).reverse().join(`:`):u,f=t.status===`finished`&&n.complete,p=n.winner===`tsv`?`TSV Feldkirchen`:e.opponent;return`
    <span>${f?`Endstand`:`Zwischenstand`} · Heim : Gast</span>
    <strong>${r} : ${a}</strong>
    <small class="live-set-scores">Sätze: ${i(c.join(` · `))}</small>
    ${d?`<small class="live-set-in-progress">Aktuell im ${l+1}. Satz: ${i(d)}</small>`:``}
    ${f?`<small class="live-set-winner">${i(p)} gewinnt</small>`:``}
  `}function l(e,t){let n=o(t.result_text),r=s(n,!!e.is_home),a=[t.tsv_player_1_name,t.tsv_player_2_name].filter(Boolean).join(` / `)||`TSV-Spieler noch offen`,c=[t.opponent_slot_1,t.opponent_slot_2].filter(e=>e!=null).map(e=>`Gegner ${e}`).join(` / `)||(t.discipline===`singles`?`Gegner ${t.position}`:`Doppelgegner noch offen`),l=e.is_home?a:c,u=e.is_home?c:a,d=n.scores.filter(Boolean).map(t=>{if(e.is_home)return t;let[n,r]=t.split(`:`);return`${r}:${n}`}),f=n.inProgressSetIndex,p=f==null?null:n.scores[f],m=p&&!e.is_home?p.split(`:`).reverse().join(`:`):p,h=t.discipline===`singles`?`Einzel`:`Doppel`,g=Number(t.position)||1;return`
    <article class="ticker-running-encounter">
      <header class="ticker-running-encounter__heading">
        <span class="ticker-running-encounter__number">${t.discipline===`singles`?`E`:`D`}${g}</span>
        <strong>${h} ${g}</strong>
        <span class="ticker-running-encounter__live"><span aria-hidden="true">●</span> LIVE</span>
      </header>
      <div class="ticker-running-encounter__line">
        <div class="ticker-running-encounter__player">
          <small>Heim</small>
          <strong>${i(l)}</strong>
        </div>
        <div class="ticker-running-encounter__result" aria-label="${n.hasResult?`Zwischenstand: Heim ${r.homeSets}, Gast ${r.awaySets}`:`Noch kein Satz eingetragen`}">
          <small>${n.hasResult?`Satzstand`:`Läuft gerade`}</small>
          <strong>${n.hasResult?`${r.homeSets} : ${r.awaySets}`:`– : –`}</strong>
          <span>${d.length?i(d.join(` · `)):`Noch kein Satz eingetragen`}</span>
          ${m?`<small class="ticker-running-encounter__current">Aktuell Satz ${f+1}: ${i(m)}</small>`:``}
        </div>
        <div class="ticker-running-encounter__player ticker-running-encounter__player--guest">
          <small>Gast</small>
          <strong>${i(u)}</strong>
        </div>
      </div>
    </article>`}var u=`data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22960%22%20height%3D%22540%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e7f0ed%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%20font-family%3D%22Arial%22%20font-size%3D%2238%22%20fill%3D%22%23216052%22%3ETSV%20Feldkirchen%20Tennis%3C%2Ftext%3E%3C%2Fsvg%3E`;function d(t){return t.gender===`men`?e(`teams/herren.png`):t.gender===`women`?e(`teams/damen.png`):t.gender===`youth`?e(`teams/jugend.png`):u}function f(e=``){return e.split(/\s+/).filter(Boolean).slice(0,2).map(e=>e[0]?.toUpperCase()||``).join(``)||`TSV`}var p=null,m=0;async function h(){return p&&Date.now()-m<6e4?p:(m=Date.now(),p=g(),p)}async function g(){let[{data:e},{data:n},{data:r},{data:i},{data:a}]=await Promise.all([t.from(`seasons`).select(`*`).order(`year`,{ascending:!1}),t.from(`team_categories`).select(`*`).order(`sort_order`),t.from(`teams`).select(`*`).eq(`active`,!0).order(`sort_order`),t.from(`team_seasons`).select(`*`),t.from(`verified_team_btv_links`).select(`team_season_id,btv_url`)]);return{seasons:e??[],categories:n??[],teams:r??[],teamSeasons:i??[],btvLinks:a??[]}}function _(e){let t=document.querySelector(e);t&&window.setTimeout(()=>{(/wird geladen|werden geladen|wird ermittelt|werden ermittelt/i.test(t.textContent||``)||!t.innerHTML.trim())&&(t.innerHTML=`<div class="public-unavailable" role="status">Diese Informationen sind gerade nicht verfügbar. Bitte versuche es später erneut.</div>`)},12e3)}function v(e){return new Map(e.map(e=>[e.id,e]))}async function y(n,r,a={}){let o=document.querySelector(n);if(!o)return;let{data:s,error:c}=await t.from(`sponsor_placements`).select(`*`).eq(`active`,!0).in(`placement`,r);if(c||!s?.length){o.classList.add(`hidden`),o.innerHTML=``;return}let l=new Date().toISOString().slice(0,10),u=s.filter(e=>e.starts_on&&e.starts_on>l||e.ends_on&&e.ends_on<l?!1:e.placement===`team`?!!a.teamId&&e.team_id===a.teamId:e.placement===`match`?!!a.matchId&&e.match_id===a.matchId:e.placement===`live`&&e.match_id?e.match_id===a.matchId:e.team_id&&a.teamId?e.team_id===a.teamId:!e.team_id&&!e.match_id);if(!u.length){o.classList.add(`hidden`),o.innerHTML=``;return}let d=[...new Set(u.map(e=>e.sponsor_id))],{data:f}=await t.from(`sponsors`).select(`*`).in(`id`,d).eq(`active`,!0).order(`sort_order`);if(!f?.length){o.classList.add(`hidden`),o.innerHTML=``;return}let p=r.includes(`live`)||r.includes(`match`)?`Sponsor des Spieltags`:r.includes(`team`)?`Mannschaftspartner`:`Unsere Partner`;o.classList.remove(`hidden`),o.innerHTML=`
    <div class="card">
      <p class="eyebrow">${i(p)}</p>
      <div class="sponsor-strip">
        ${f.map(t=>`
          <a class="sponsor-item" href="${i(t.url||`#`)}" ${t.url?`target="_blank" rel="noreferrer"`:`aria-disabled="true"`}>
            ${t.logo_path?`<img src="${i(e(t.logo_path))}" alt="Logo ${i(t.name)}" loading="lazy" />`:``}
            <strong>${i(t.name)}</strong>
          </a>
        `).join(``)}
      </div>
    </div>`}var b=`https://www.tennis.de/spielen/spielbetrieb/mannschaftssuche.html?verband=btv&verein=01012#teamview/23391`;function x(e){let t=S(e);return{href:t||b,isDirect:!!t}}function S(e){let t=e?.tennis_de_portrait_url;if(typeof t!=`string`)return null;try{let e=new URL(t);return e.origin!==`https://www.tennis.de`||e.pathname!==`/spielen/spielbetrieb/mannschaftssuche.html`||e.searchParams.get(`verband`)?.toLowerCase()!==`btv`||e.searchParams.get(`verein`)!==`01012`||!/^#teamportrait\/\d+$/.test(e.hash)?null:e.href}catch{return null}}function C(e){let t=typeof e.venue_address==`string`?e.venue_address.trim():``,n=typeof e.venue_name==`string`?e.venue_name.trim():``;return!t&&!n?null:`https://www.google.com/maps/dir/?api=1&destination=`+encodeURIComponent(t||n)}function w(e){let t=C(e);return t?`<a class="button ghost match-route-button" href="${i(t)}" target="_blank" rel="noopener noreferrer" aria-label="Route zum Spielort ${i(e.venue_name||e.venue_address||``)} planen">↗ Route planen</a>`:``}function T(e,t=!1){let n=typeof e.venue_name==`string`?e.venue_name.trim():``,r=typeof e.venue_address==`string`?e.venue_address.trim():``;return`<div class="match-venue">
    <span class="match-venue__label">📍 Tatsächlicher Spielort</span>
    <strong>${i(n||r||`Spielort noch nicht bekannt`)}</strong>
    ${r?`<small>${i(r)}</small>`:n?`<small>Genaue Anschrift bitte vor der Fahrt prüfen.</small>`:``}
    ${t?w(e):``}
  </div>`}function E(e,t){let n=t.teamSeasons.find(t=>t.id===e.team_season_id);return{ts:n,team:t.teams.find(e=>e.id===n?.team_id),season:t.seasons.find(e=>e.id===n?.season_id)}}function D(e,t){return t.find(t=>t.match_id===e.id)}function O(e){let t=typeof e.btv_result_text==`string`?/^\s*(\d{1,2})\s*:\s*(\d{1,2})\s*$/.exec(e.btv_result_text):null;if(!t)return null;let n=Number(t[1]),r=Number(t[2]);return n===0&&r===0?null:{home:n,away:r}}function k(t,n,a=[],o=new Set){let{team:s}=E(t,n),c=D(t,a),l=c?.status??`scheduled`,u=O(t),d=u?.home??c?.home_score??0,f=u?.away??c?.away_score??0,p=t.is_home?d:f,m=t.is_home?f:d,h=t.is_home?`Heim`:`Auswärts`,g=`/spiel/?match=${encodeURIComponent(t.id)}`;return`
    <div class="match-row">
      <a class="match-row__main" href="${g}">
        <span class="match-row__teamline"><img class="match-row__tsv-logo" src="${i(e(`branding/tennis-logo.png`))}" alt="" /><strong>${i(s?.name??`TSV Feldkirchen`)} · ${i(h)}</strong></span>
        <div class="match-meta">${i(r(t.starts_at))} · gegen ${i(t.opponent)}</div>
        ${T(t)}
      </a>
      <div class="actions">
        ${w(t)}
        ${u?`<span class="status-pill btv-official">Offizielles BTV-Ergebnis</span>`:l===`live`?`<span class="status-pill live">LIVE</span>`:l===`finished`?`<span class="status-pill">Beendet</span>`:``}
        ${l!==`scheduled`||u?`<span class="score">${p} : ${m}</span>`:``}
        <a class="button ghost" href="${g}">${o.has(t.id)?`Spiel & Bilder`:`Spiel öffnen`}</a>
        ${l===`live`?`<a class="button" href="/live/?match=${encodeURIComponent(t.id)}">Liveticker</a>`:``}
      </div>
    </div>`}async function A(){let n=document.querySelector(`#facility-pill`),a=document.querySelector(`#live-center`),o=document.querySelector(`#today-matches`),s=document.querySelector(`#today-fixtures-panel`),c=document.querySelector(`#upcoming-matches`),u=document.querySelector(`#recent-matches`),d=document.querySelector(`#home-news`),f=document.querySelector(`#home-weather`),p=(e,t)=>{e&&(e.innerHTML=`<p class="muted" role="status">${i(t)}</p>`)},m=window.setTimeout(()=>{n?.textContent?.match(/geladen|ermittelt/i)&&p(n,`Anlagenstatus momentan nicht abrufbar. Bitte Courtbooking prüfen.`);for(let e of[o,c,u,d])e?.textContent?.match(/geladen|ermittelt/i)&&p(e,`Inhalte momentan nicht abrufbar. Bitte später erneut versuchen.`)},12e3);try{let m=await h(),g=new Date,_=new Intl.DateTimeFormat(`de-DE`,{timeZone:`Europe/Berlin`,year:`numeric`,month:`2-digit`,day:`2-digit`}),v=e=>{let t=_.formatToParts(new Date(e)),n=e=>t.find(t=>t.type===e)?.value||``;return`${n(`year`)}-${n(`month`)}-${n(`day`)}`},b=v(g),[x,S,C]=b.split(`-`).map(Number),w=Date.UTC(x,S-1,C),T=new Date(w-72e5),D=new Date(w+936e5),[A,j,M,N,P,F,I,L]=await Promise.all([n?t.from(`facility_status`).select(`*`).limit(1):Promise.resolve({data:[],error:null}),t.from(`match_live_state`).select(`*`).eq(`status`,`live`),t.from(`matches`).select(`*`).eq(`is_published`,!0).gte(`starts_at`,T.toISOString()).lt(`starts_at`,D.toISOString()).order(`starts_at`).limit(50),t.from(`matches`).select(`*`).eq(`is_published`,!0).gte(`starts_at`,g.toISOString()).order(`starts_at`).limit(15),u?t.from(`matches`).select(`*`).eq(`is_published`,!0).lt(`starts_at`,T.toISOString()).order(`starts_at`,{ascending:!1}).limit(8):Promise.resolve({data:[],error:null}),d?t.from(`news`).select(`*`).eq(`status`,`published`).order(`published_at`,{ascending:!1}).limit(3):Promise.resolve({data:[],error:null}),document.querySelector(`#home-team-count, #home-court-count`)?t.from(`site_settings`).select(`key,value`).in(`key`,[`team_count`,`court_count`]):Promise.resolve({data:[],error:null}),f?fetch(`https://api.open-meteo.com/v1/forecast?latitude=48.15&longitude=11.73&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin&forecast_days=3`).then(e=>e.ok?e.json():Promise.reject(Error(`Wetterdienst nicht erreichbar`))).catch(()=>null):Promise.resolve(null)]),R=new Map((I.data??[]).map(e=>[e.key,e.value]));for(let[e,t]of[[`#home-team-count`,`team_count`],[`#home-court-count`,`court_count`]]){let n=document.querySelector(e);n&&R.has(t)&&(n.textContent=String(R.get(t)))}if(n){let e=A.data?.[0],t=!!e?.updated_at&&Date.now()-new Date(e.updated_at).getTime()>12096e5,r=!!A.error,i=t?`Status nicht aktuell`:r?`Anlagenstatus nicht verfügbar`:e?e.status===`closed`?`Geschlossen`:e.status===`limited`?`Teilweise offen`:e.status===`open`?`Offen`:`Status derzeit unklar`:`Status nicht gemeldet`,a=t?`Die letzte Meldung ist älter als 14 Tage. Bitte die Verfügbarkeit direkt bei Courtbooking prüfen.`:r?`Bitte prüfe die aktuelle Platzverfügbarkeit in Courtbooking.`:e?.message||(e?`Aktuelle Meldung zur Tennisanlage.`:`Für heute liegt noch keine Statusmeldung vor.`);n.className=`facility-pill facility-pill--${!r&&!t&&[`closed`,`open`,`limited`].includes(e?.status)?e.status:`unknown`}`,n.textContent=`Anlagenstatus: ${i}`,n.title=a}if(f){let e=[`Heute`,`Morgen`,...(L?.daily?.time??[]).slice(2,3).map(e=>new Intl.DateTimeFormat(`de-DE`,{weekday:`short`}).format(new Date(`${e}T12:00:00`)))],t={0:`☀️`,1:`🌤️`,2:`⛅`,3:`☁️`,45:`🌫️`,48:`🌫️`,51:`🌦️`,53:`🌦️`,55:`🌧️`,61:`🌧️`,63:`🌧️`,65:`🌧️`,71:`🌨️`,73:`🌨️`,75:`❄️`,80:`🌦️`,81:`🌧️`,82:`⛈️`,95:`⛈️`};f.innerHTML=L?.daily?.time?.length?L.daily.time.slice(0,3).map((n,r)=>`
        <div class="weather-day"><strong>${i(e[r]||``)}</strong><span class="weather-icon" aria-hidden="true">${t[L.daily.weather_code[r]]||`🌤️`}</span><span>${Math.round(L.daily.temperature_2m_max[r])}° / ${Math.round(L.daily.temperature_2m_min[r])}°</span><small>${L.daily.precipitation_probability_max[r]??0}% Regen</small></div>`).join(``):`<p class="muted">Wetter momentan nicht abrufbar.</p>`}let z=j.data??[],B=z.map(e=>e.match_id),V=[...M.data??[],...N.data??[],...P.data??[]],H=new Set(V.map(e=>e.id)),U=B.filter(e=>!H.has(e));if(U.length){let e=await t.from(`matches`).select(`*`).eq(`is_published`,!0).in(`id`,U);V.push(...e.data??[])}let W=new Map(V.map(e=>[e.id,e])),G=B.map(e=>W.get(e)).filter(Boolean),K=(M.data??[]).filter(e=>v(e.starts_at)===b),q=new Set(K.map(e=>e.id)),J=[...G.filter(e=>v(e.starts_at)===b),...K.filter(e=>!B.includes(e.id))],Y=(N.data??[]).filter(e=>!B.includes(e.id)&&(!c||!q.has(e.id))),X=(P.data??[]).slice(0,6),Z=J.length?J:c?[]:Y.slice(0,3),ee=[...new Set([...Z,...Y,...X].map(e=>e.id))],Q=[...(ee.length?await t.from(`match_live_state`).select(`*`).in(`match_id`,ee):{data:[],error:null}).data??[],...z];if(a){if(G.length){let e=await t.from(`match_encounters`).select(`match_id,discipline,position,status,sort_order,tsv_player_1_name,tsv_player_2_name,opponent_slot_1,opponent_slot_2,result_text`).in(`match_id`,G.map(e=>e.id)).eq(`status`,`live`).order(`sort_order`).order(`position`),n=e.data??[];a.classList.remove(`hidden`),a.innerHTML=`
          <div class="ticker-overview-feature__intro">
            <span class="live-badge"><span class="live-dot"></span>LIVE · TSV Feldkirchen Tennis</span>
            <h2>${G.length===1?`Jetzt live dabei`:`${G.length} Punktspiele laufen`}</h2>
            <p>Alle gerade laufenden Einzel und Doppel – direkt mit ihren Zwischenständen.</p>
          </div>
          <div class="ticker-overview-match-list">
            ${G.map(t=>{let{team:a}=E(t,m),o=a?.name?`TSV Feldkirchen ${a.name}`:`TSV Feldkirchen`,s=t.is_home?o:t.opponent,c=t.is_home?t.opponent:o,u=Q.find(e=>e.match_id===t.id),d=O(t),f=d?.home??Number(u?.home_score??0),p=d?.away??Number(u?.away_score??0),h=`/live/?match=${encodeURIComponent(t.id)}`,g=n.filter(e=>e.match_id===t.id);return`
                <article class="ticker-overview-feature">
                  <div class="ticker-overview-feature__match-title">
                    <div>
                      <h3>${i(a?.name||`TSV Feldkirchen`)} <span>gegen</span> ${i(t.opponent)}</h3>
                      <p>${i(r(t.starts_at))} · ${t.is_home?`Heimspiel`:`Auswärtsspiel`}</p>
                    </div>
                    <span class="ticker-overview-feature__match-count">${d?`BTV-Endstand verfügbar`:`${g.length} ${g.length===1?`Begegnung läuft`:`Begegnungen laufen`}`}</span>
                  </div>
                  <div class="ticker-overview-feature__score" aria-label="Heim ${f}, Gast ${p}">
                    <div class="ticker-overview-feature__team">
                      <small>Heim</small>
                      <strong>${i(s)}</strong>
                    </div>
                    <div class="ticker-overview-feature__number">
                      <span>Begegnungen</span>
                      <strong>${f} <i aria-hidden="true">:</i> ${p}</strong>
                    </div>
                    <div class="ticker-overview-feature__team">
                      <small>Gast</small>
                      <strong>${i(c)}</strong>
                    </div>
                  </div>
                  <section class="ticker-running-encounters" aria-label="Aktuell laufende Einzel und Doppel">
                    <div class="ticker-running-encounters__title">
                      <h4>Gerade auf dem Platz</h4>
                      <span>${g.length} LIVE</span>
                    </div>
                    ${e.error?`<p class="ticker-running-encounters__empty">Die laufenden Begegnungen sind momentan nicht abrufbar.</p>`:g.length?`<div class="ticker-running-encounters__list">${g.map(e=>l(t,e)).join(``)}</div>`:`<p class="ticker-running-encounters__empty">Noch kein Einzel oder Doppel live geschaltet.</p>`}
                  </section>
                  <div class="ticker-overview-feature__footer">
                    <span>Weitere Begegnungen und alle Satzdetails</span>
                    <a class="ticker-overview-feature__action" href="${h}">Live-Ergebnisse &amp; alle Sätze ansehen <span aria-hidden="true">↗</span></a>
                  </div>
                </article>`}).join(``)}
          </div>`}else a.classList.add(`hidden`),a.innerHTML=``}o&&(s&&s.classList.toggle(`hidden`,!!M.error||!!j.error||J.length===0),M.error||j.error||!c&&N.error?p(o,`Punktspiele sind momentan nicht abrufbar.`):o.innerHTML=Z.length?`<p class="match-section-note">${J.length?J.some(e=>B.includes(e.id))?`Heute und LIVE`:`Heutige Punktspiele`:`Nächste Punktspiele`}</p>${Z.slice(0,6).map(e=>k(e,m,Q)).join(``)}`:c?`<p class="muted">Heute finden keine Punktspiele statt. Die nächsten Begegnungen stehen unten unter „Demnächst“.</p>`:`<p class="muted">Momentan keine Punktspiele angekündigt.</p>`),c&&(c.innerHTML=N.error?`<p class="muted">Spielplan momentan nicht abrufbar.</p>`:Y.length?Y.slice(0,8).map(e=>k(e,m,Q)).join(``):`<p class="muted">Keine weiteren Punktspiele angekündigt.</p>`);let $=X.filter(e=>Q.find(t=>t.match_id===e.id)?.status===`finished`||O(e));u&&(u.innerHTML=P.error?`<p class="muted">Ergebnisse momentan nicht abrufbar.</p>`:$.length?$.map(e=>k(e,m,Q)).join(``):`<p class="muted">Noch keine bestätigten Spielergebnisse vorhanden.</p>`),d&&(d.innerHTML=F.error?`<p class="muted">Neuigkeiten momentan nicht abrufbar.</p>`:F.data?.length?F.data.map(t=>`
          <article class="news-row home-news-item ${t.hero_image_path?`home-news-item--with-image`:``}">
            <a class="home-news-item__link" href="/aktuelles/" aria-label="Nachricht ${i(t.title)} öffnen">
              ${t.hero_image_path?`<img class="home-news-item__image" src="${i(e(t.hero_image_path))}" alt="" width="108" height="80" loading="lazy" decoding="async" />`:``}
              <span class="home-news-item__content">
                <strong>${i(t.title)}</strong>
                <time class="match-meta" ${t.published_at?`datetime="${i(t.published_at)}"`:``}>${t.published_at?i(r(t.published_at)):``}</time>
              </span>
            </a>
          </article>`).join(``):`<p class="muted">Noch keine aktuellen Beiträge.</p>`),document.querySelector(`#home-sponsors`)&&await y(`#home-sponsors`,[`home`])}catch(e){console.warn(`Öffentliche Startseiten-Daten konnten nicht geladen werden:`,e),n?.textContent?.match(/geladen|ermittelt/i)&&p(n,`Anlagenstatus momentan nicht abrufbar.`);for(let e of[o,c,u,d])e?.textContent?.match(/geladen|ermittelt/i)&&p(e,`Inhalte momentan nicht abrufbar.`)}finally{window.clearTimeout(m),window.setTimeout(A,document.hidden?12e4:a&&!a.classList.contains(`hidden`)?2e4:6e4)}}async function j(){_(`#teams-grid`);let n=document.querySelector(`#teams-grid`),o=document.querySelector(`#teams-season-nav`),s=document.querySelector(`#teams-category-chips`),c=document.querySelector(`#teams-results-info`),l=document.querySelector(`#teams-results-title`);if(!n||!o||!s||!c||!l)return;let u=await h(),f=new Map(u.btvLinks.map(e=>[e.team_season_id,e.btv_url]));if(!u.seasons.length||!u.teams.length){n.innerHTML=`<div class="teams-empty" role="status"><h3>Mannschaften derzeit nicht verfügbar</h3><p>Bitte versuche es später erneut.</p></div>`,c.textContent=`Der Spielplan konnte nicht geladen werden.`;return}let p=u.seasons.filter(e=>e.is_published!==!1&&typeof e.code==`string`&&/^(sommer|winter)-20\d{2}/.test(e.code)),m=Array.from(o.querySelectorAll(`[data-season]`)),g=[...new Set([...m.map(e=>e.dataset.season||``).filter(Boolean),...p.map(e=>e.code)])],y=new Map(p.map(e=>[e.code,e]));for(let e of g){if(m.some(t=>t.dataset.season===e))continue;let t=y.get(e);if(!t)continue;let n=e.startsWith(`winter-`),r=document.createElement(`button`);r.type=`button`,r.className=`teams-season-card`,r.dataset.season=e,r.setAttribute(`aria-pressed`,`false`),r.innerHTML=`<span class="teams-season-card__top"><span class="teams-season-card__icon" aria-hidden="true">${n?`❄`:`☀`}</span><span class="teams-season-card__count" data-count="${i(e)}">–</span></span><strong>${i(t.name)}</strong><span class="teams-season-card__subtitle">${n?`Winterrunde`:`Sommerrunde`}</span>`,o.append(r)}let b=v(u.teams),S=u.teamSeasons.filter(e=>e.is_published&&b.has(e.team_id)),C=[{id:`herren`,name:`Herren`},{id:`damen`,name:`Damen`},{id:`junioren`,name:`Junioren`},{id:`juniorinnen`,name:`Juniorinnen`},{id:`knaben`,name:`Knaben`},{id:`maedchen`,name:`Mädchen`},{id:`bambini`,name:`Bambini`},{id:`kleinfeld`,name:`Kleinfeld`}],E=e=>{let t=`${e?.slug||``} ${e?.name||``}`.toLocaleLowerCase(`de-DE`);return C.find(e=>t.includes(e.id)||e.id===`maedchen`&&t.includes(`mädchen`))?.id||``},D=e=>e?S.filter(t=>t.season_id===e.id):[],O=new Map(g.map(e=>[e,D(y.get(e)).length]));for(let e of Array.from(o.querySelectorAll(`[data-season]`))){let t=e.dataset.season||``,n=e.querySelector(`[data-count]`);if(n){let e=O.get(t)??0;n.textContent=e===0?`Noch keine Teams`:e+(e===1?` Team`:` Teams`)}}let k=g.map(e=>y.get(e)).find(e=>e?.is_current&&!e.archived_at),A=new Date().toLocaleDateString(`en-CA`,{timeZone:`Europe/Berlin`}),j=g.map(e=>y.get(e)).find(e=>e&&(O.get(e.code)||0)>0&&e.starts_on<=A&&e.ends_on>=A),M=k||j||g.map(e=>y.get(e)).find(e=>e&&(O.get(e.code)||0)>0)||y.get(`sommer-2026`),N=M?.code||`sommer-2026`,P=``,F=C.filter(e=>S.some(t=>E(b.get(t.team_id))===e.id));s.innerHTML=[`<button type="button" class="teams-category-chip is-active" data-category="" aria-pressed="true">Alle Teams</button>`,...F.map(e=>`<button type="button" class="teams-category-chip" data-category="${i(e.id)}" aria-pressed="false">${i(e.name)}</button>`)].join(``);let I=S.map(e=>e.id),L=(I.length?await t.from(`matches`).select(`*`).eq(`is_published`,!0).in(`team_season_id`,I).order(`starts_at`):{data:[],error:null}).data??[],R=L.length?await t.from(`match_live_state`).select(`*`).in(`match_id`,L.map(e=>e.id)):{data:[],error:null},z=new Map((R.data??[]).map(e=>[e.match_id,e])),B=e=>{let t=g.map(e=>y.get(e)).filter(t=>!!t&&D(t).some(t=>E(b.get(t.team_id))===e));return t.find(e=>e.code===M?.code)?.code??t.sort((e,t)=>String(t.starts_on||``).localeCompare(String(e.starts_on||``)))[0]?.code},V=()=>{let e=new URLSearchParams(window.location.search),t=e.get(`category`)||e.get(`gruppe`)||``;P=F.some(e=>e.id===t)?t:``;let n=e.get(`season`),r=u.seasons.find(e=>e.id===n)?.code;N=(g.includes(n||``)?n:r&&g.includes(r)?r:``)||(P?B(P):void 0)||M?.code||`sommer-2026`},H=()=>{let e=new URL(window.location.href);e.searchParams.set(`season`,N),P?e.searchParams.set(`category`,P):e.searchParams.delete(`category`),e.searchParams.delete(`gruppe`),window.history.pushState({},``,e.toString())},U=()=>{for(let e of Array.from(o.querySelectorAll(`[data-season]`))){let t=e.dataset.season===N;e.classList.toggle(`is-active`,t),e.setAttribute(`aria-pressed`,String(t))}for(let e of Array.from(s.querySelectorAll(`[data-category]`))){let t=e.dataset.category===P;e.classList.toggle(`is-active`,t),e.setAttribute(`aria-pressed`,String(t))}let t=y.get(N),u=D(t).map(e=>({ts:e,team:b.get(e.team_id)})).filter(e=>!!e.team).sort((e,t)=>{let n=e=>{let t=`${e.name||``} ${e.slug||``}`.toLocaleLowerCase(`de-DE`),n=[`herren`,`damen`,`junioren`,`juniorinnen`,`knaben`,`mädchen`,`bambini`,`kleinfeld`],r=n.findIndex(e=>t.includes(e));return r<0?n.length:r};return n(e.team)-n(t.team)||(e.team.sort_order??0)-(t.team.sort_order??0)||String(e.team.name).localeCompare(String(t.team.name),`de`)}),p=u.filter(({team:e})=>!P||E(e)===P),m=t?.name||(N===`winter-2026-2027`?`Winter 2026/2027`:N===`sommer-2027`?`Sommer 2027`:`Sommer 2026`);l.textContent=m,c.textContent=u.length>0?`${p.length} ${p.length===1?`Mannschaft`:`Mannschaften`}${P?` in dieser Kategorie`:` in dieser Runde`}`:`Noch keine bestätigten Mannschaftsmeldungen für diese Runde.`;let h=N===`sommer-2027`?`Die Mannschaften und Spielpläne für Sommer 2027 werden veröffentlicht, sobald die offiziellen BTV-Daten verfügbar sind.`:N===`winter-2026-2027`?`Die Mannschaften der Winterrunde 2026/2027 sind beim BTV bereits veröffentlicht. Wir gleichen ihre Meldungen und Spielpläne derzeit mit unserer Mannschaftsverwaltung ab.`:`Für diese Saison wurden noch keine Mannschaften veröffentlicht.`;if(!p.length){n.innerHTML=u.length&&P?`<div class="teams-empty"><span aria-hidden="true">◎</span><h3>Keine Mannschaft in dieser Kategorie</h3><p>Wähle „Alle Teams“, um die gesamte Saison zu sehen.</p></div>`:`<div class="teams-empty"><span aria-hidden="true">${N.startsWith(`winter`)?`❄`:`☀`}</span><h3>${N===`winter-2026-2027`?`BTV-Winterrunde 2026/27`:`Noch keine Mannschaften veröffentlicht`}</h3><p>${h}</p>${N===`winter-2026-2027`?`<a class="button secondary" href="https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften" target="_blank" rel="noopener noreferrer">Winter-Mannschaften beim BTV ansehen ↗</a>`:``}</div>`;return}let g=Date.now();n.innerHTML=p.map(({ts:t,team:n})=>{let o=L.filter(e=>e.team_season_id===t.id),s=o.find(e=>z.get(e.id)?.status===`live`),c=o.find(e=>new Date(e.starts_at).getTime()>=g&&z.get(e.id)?.status!==`finished`),l=s||c,u=l?z.get(l.id):null,p=u?.status===`live`,h=l?l.is_home?u?.home_score:u?.away_score:null,_=l?l.is_home?u?.away_score:u?.home_score:null,v=`/mannschaften/${encodeURIComponent(n.slug)}/?season=${encodeURIComponent(N)}`,y=a(f.get(t.id)===t.btv_url?t.btv_url:null),b=x(t);return`
        <article class="card team-card team-overview-card">
          <a href="${v}" class="team-card__image-link" aria-label="${i(n.name)} öffnen"><img src="${i(e(t.team_image_path||n.image_path)||d(n))}" alt="Mannschaftsfoto ${i(n.name)}" loading="lazy" /></a>
          <div>
            <p class="eyebrow">${i(m)}</p>
            <h3><a href="${v}" class="text-link">${i(n.name)}</a></h3>
            <a class="text-link" href="${i(y.href)}" target="_blank" rel="noopener noreferrer"
               aria-label="${y.isDirect?`BTV-Tabelle und Spielplan`:`BTV-Vereinsübersicht`} ${i(n.name)} – ${i(N)} öffnen">${y.isDirect?`BTV Tabelle / Spielplan ↗`:`BTV Vereinsübersicht ↗`}</a>
            ${y.isDirect?``:`<small class="muted">Direkter Gruppenlink noch nicht bestätigt</small>`}
          </div>
          <p class="muted">${i([t.league,t.group_name].filter(Boolean).join(` · `)||`TSV Feldkirchen Tennis`)}</p>
          ${l?`
            <div class="team-overview-next ${p?`is-live`:``}">
              <span class="status-pill ${p?`live`:``}">${p?`LIVE`:`Nächstes Spiel`}</span>
              <strong>gegen ${i(l.opponent)}</strong>
              <small>${i(r(l.starts_at))} · ${l.is_home?`Heimspiel`:`Auswärtsspiel`}${p?` · ${h??0} : ${_??0}`:``}</small>
              ${T(l)}
              ${w(l)}
              ${p?`<a href="/live/?match=${encodeURIComponent(l.id)}">Zum Liveticker</a>`:``}
            </div>`:`<p class="muted">Derzeit kein nächstes Punktspiel eingetragen.</p>`}
          <div class="actions"><a class="button" href="${v}">Mannschaft öffnen</a><a class="button ghost" href="${i(y.href)}" target="_blank" rel="noopener noreferrer">${y.isDirect?`BTV Gruppe ↗`:`BTV Verein ↗`}</a><a class="button ghost" href="${i(b.href)}" target="_blank" rel="noopener noreferrer" aria-label="${b.isDirect?`Offizielles tennis.de Mannschaftsporträt`:`Offizielle tennis.de Mannschaftssuche für TSV Feldkirchen`} – ${i(n.name)} – ${i(N)}">${b.isDirect?`tennis.de Portrait ↗`:`tennis.de Team suchen ↗`}</a></div>
        </article>`}).join(``)};V(),o.addEventListener(`click`,e=>{let t=e.target.closest(`[data-season]`);t&&o.contains(t)&&t.dataset.season!==N&&(N=t.dataset.season||`sommer-2026`,P=``,H(),U())}),s.addEventListener(`click`,e=>{let t=e.target.closest(`[data-category]`);t&&s.contains(t)&&t.dataset.category!==P&&(P=t.dataset.category||``,H(),U())}),window.addEventListener(`popstate`,()=>{V(),U()}),U()}async function M(o){_(`#team-header`),_(`#team-roster`),_(`#team-matches`),_(`#team-season`),_(`#team-standings`);let s=document.querySelector(`[data-team-slug]`);if(!s)return;let c=await h(),l=new Map(c.btvLinks.map(e=>[e.team_season_id,e.btv_url])),u=c.teams.find(e=>e.slug===o);if(!u){s.innerHTML=`<div class="card"><h1>Mannschaft nicht gefunden</h1></div>`;return}let p=c.teamSeasons.filter(e=>e.team_id===u.id&&e.is_published&&c.seasons.some(t=>t.id===e.season_id&&t.is_published!==!1)).sort((e,t)=>{let n=c.seasons.find(t=>t.id===e.season_id),r=c.seasons.find(e=>e.id===t.season_id);return(n?.display_order??100)-(r?.display_order??100)}),m=new URLSearchParams(window.location.search).get(`season`),g=p.find(e=>{let t=c.seasons.find(t=>t.id===e.season_id);return e.season_id===m||t?.code===m})??p.find(e=>c.seasons.find(t=>t.id===e.season_id)?.is_current)??p[0],b=c.seasons.find(e=>e.id===g?.season_id)?.code,S=s.querySelector(`.breadcrumbs a[href*="category="]`);if(S&&b){let e=new URL(S.href);e.searchParams.set(`season`,b),S.href=`${e.pathname}${e.search}${e.hash}`}let C=document.querySelector(`#team-season-nav`);C&&(C.innerHTML=p.map(e=>{let t=c.seasons.find(t=>t.id===e.season_id),n=e.id===g?.id;return`<button type="button" class="teams-category-chip ${n?`is-active`:``}" data-detail-season="${i(t?.code||t?.id||``)}" aria-pressed="${n}">${i(t?.name||`Saison`)}</button>`}).join(``)||`<p class="muted">Für dieses Team gibt es noch keine bestätigte Saison.</p>`,C.addEventListener(`click`,e=>{let t=e.target.closest(`[data-detail-season]`);if(!t||!C.contains(t))return;let n=new URL(window.location.href);n.searchParams.set(`season`,t.dataset.detailSeason||``),window.location.assign(n.toString())}));let E=x(g),D=a(l.get(g?.id)===g?.btv_url?g?.btv_url:null),A=document.querySelector(`#team-header`);A&&(A.innerHTML=`
    <section class="hero">
      <div><p class="eyebrow">Mannschaft</p><h1>${i(u.name)}</h1><p class="hero__lead">${i(u.description||[g?.league,g?.group_name].filter(Boolean).join(` · `)||`TSV Feldkirchen Tennis`)}</p><div class="actions">${g?`<a class="button" href="${i(D.href)}" target="_blank" rel="noopener noreferrer">${D.isDirect?`BTV Spielplan ↗`:`BTV Vereinsübersicht ↗`}</a>`:``}${g?`<a class="button ghost" href="${i(E.href)}" target="_blank" rel="noopener noreferrer">${E.isDirect?`tennis.de Mannschaftsporträt ↗`:`tennis.de Mannschaftssuche ↗`}</a>`:``}<a class="button secondary" href="${i(n({team:o}))}">Kalender abonnieren</a></div></div>
      <div class="card"><img src="${i(e(g?.team_image_path||u.image_path)||d(u))}" alt="Mannschaftsfoto ${i(u.name)}" /></div>
    </section>
  `);let j=document.querySelector(`#team-season`);if(j&&(j.innerHTML=p.map(e=>{let t=c.seasons.find(t=>t.id===e.season_id);return`<p><strong>${i(t?.name??``)}</strong><br><span class="muted">${i([e.league,e.group_name].filter(Boolean).join(` · `))}</span></p>`}).join(``)||`<p class="muted">Noch keine Saisoninformationen.</p>`),!g)return;let M=p.map(e=>e.id),[{data:N},{data:P},{data:F},{data:I},{data:L},R]=await Promise.all([t.from(`team_players`).select(`*`).eq(`team_season_id`,g.id).eq(`public_visible`,!0).order(`is_captain`,{ascending:!1}).order(`sort_order`),t.from(`matches`).select(`*`).eq(`team_season_id`,g.id).eq(`is_published`,!0).order(`starts_at`),M.length?t.from(`matches`).select(`*`).in(`team_season_id`,M).eq(`is_published`,!0).order(`starts_at`):Promise.resolve({data:[]}),t.from(`news`).select(`*`).eq(`team_id`,u.id).eq(`status`,`published`).order(`published_at`,{ascending:!1}),t.from(`galleries`).select(`*`).eq(`team_id`,u.id).eq(`published`,!0).order(`created_at`,{ascending:!1}),t.from(`team_standings`).select(`rank,team_name,club_code,standing_text,source_url,synced_at`).eq(`team_season_id`,g.id).order(`rank`)]),z=document.querySelector(`#team-standings`);if(z){let e=R.data??[],t=e[0]?.source_url,n=e[0]?.synced_at,a=e=>{let t=typeof e==`string`?e.trim().split(/\s+/).slice(0,5):[];return t.length===5?t:[`–`,`–`,`–`,`–`,`–`]};z.innerHTML=e.length?`
      <p class="team-standings-scroll-hint">← Tabelle seitlich wischen →</p>
      <div class="table-wrap" tabindex="0" role="region" aria-label="BTV-Gruppentabelle seitlich scrollbar">
        <table class="data-table team-standings-table">
          <thead><tr><th scope="col">Rang</th><th scope="col">Mannschaft</th><th scope="col">Beg.</th><th scope="col">Punkte</th><th scope="col">Matches</th><th scope="col">Sätze</th><th scope="col">Spiele</th></tr></thead>
          <tbody>${e.map(e=>{let t=a(e.standing_text);return`
            <tr class="${e.club_code===`01012`?`is-tsv`:``}">
              <td><strong>${e.rank}</strong></td>
              <td>${i(e.team_name)}${e.club_code===`01012`?` <span class="status-pill">TSV</span>`:``}</td>
              ${t.map(e=>`<td class="team-standings-number">${i(e)}</td>`).join(``)}
            </tr>`}).join(``)}</tbody>
        </table>
      </div>
      <p class="match-meta">Amtlicher BTV-Stand${n?` · aktualisiert ${i(r(n))}`:``}${t?` · <a href="${i(t)}" target="_blank" rel="noopener noreferrer">Quelle ↗</a>`:``}</p>`:`<p class="muted">Für diese Saison ist die amtliche Tabelle beim BTV derzeit nicht abrufbar.</p><p><a class="text-link" href="${i(D.href)}" target="_blank" rel="noopener noreferrer">BTV-Gruppe direkt öffnen ↗</a></p>`}let B=(N??[]).map(e=>e.player_id),V=v(B.length?(await t.from(`players`).select(`*`).in(`id`,B)).data??[]:[]),H=document.querySelector(`#team-roster`);H&&(H.innerHTML=N?.length?`
    <div class="roster-grid">
      ${N.map(t=>{let n=V.get(t.player_id);return n?`<article class="player-card">
          ${n.photo_path?`<img class="player-card__photo" src="${i(e(n.photo_path))}" alt="${i(n.display_name)}" loading="lazy" />`:`<span class="player-card__placeholder" aria-hidden="true">${i(f(n.display_name))}</span>`}
          <div>
            <strong>${i(n.display_name)}</strong>
            ${t.is_captain?`<div class="match-meta">Mannschaftsführung</div>`:``}
          </div>
        </article>`:``}).join(``)}
    </div>`:`<p class="muted">Der öffentliche Kader wird noch gepflegt.</p>`);let U=P??[],W=U.length?(await t.from(`match_live_state`).select(`*`).in(`match_id`,U.map(e=>e.id))).data??[]:[],G=document.querySelector(`#team-stats`);if(G){let e=P??[],t=new Map(W.map(e=>[e.match_id,e])),n=e.filter(e=>t.get(e.id)?.status===`finished`||O(e)),r=n.map(e=>{let n=t.get(e.id),r=O(e),i=r?.home??Number(n?.home_score??0),a=r?.away??Number(n?.away_score??0),o=e.is_home?i:a,s=e.is_home?a:i;return Math.sign(o-s)}),a=r.filter(e=>e>0).length,o=r.filter(e=>e===0).length,s=r.filter(e=>e<0).length,c=e.filter(e=>e.is_home).length,l=e.length-c;G.innerHTML=`<div class="phase8-stat-grid">
      <div><strong>${e.length}</strong><span>Punktspiele</span></div>
      <div><strong>${c}</strong><span>Heimspiele</span></div>
      <div><strong>${l}</strong><span>Auswärtsspiele</span></div>
      <div><strong>${n.length}</strong><span>Ergebnisse</span></div>
      </div><p class="muted">Offiziell bestätigte BTV-Ergebnisse und abgeschlossene TSV-Liveticker: ${a} Siege · ${o} Unentschieden · ${s} Niederlagen.
      ${n.length<e.length?`Spiele ohne veröffentlichten Endstand werden nicht als 0:0 gewertet.`:``}</p>
      ${g?`<p><a href="${i(D.href)}" class="text-link" target="_blank" rel="noopener noreferrer">${D.isDirect?`Offiziellen BTV-Spielplan und Tabellenstand ansehen ↗`:`BTV-Vereinsübersicht öffnen (Gruppenlink prüfen) ↗`}</a></p>`:``}`}let K=document.querySelector(`#team-next-match`);if(K){let t=Date.now(),n=U.find(e=>W.find(t=>t.match_id===e.id)?.status===`live`),r=U.filter(e=>e.is_published!==!1&&new Date(e.starts_at).getTime()>t).sort((e,t)=>new Date(e.starts_at).getTime()-new Date(t.starts_at).getTime())[0],a=n??r;if(a){let n=W.find(e=>e.match_id===a.id)?.status===`live`,r=new Date(a.starts_at),o=new Intl.DateTimeFormat(`de-DE`,{weekday:`long`,day:`2-digit`,month:`long`}).format(r),s=new Intl.DateTimeFormat(`de-DE`,{hour:`2-digit`,minute:`2-digit`}).format(r),c=Math.max(1,Math.ceil((r.getTime()-t)/864e5)),l=n?`Jetzt live`:c===1?`Morgen`:c<=7?`In ${c} Tagen`:`Nächstes Punktspiel`,d=a.is_home?u.name:a.opponent,f=a.is_home?a.opponent:u.name,p=`/spiel/?match=${encodeURIComponent(a.id)}`;K.classList.remove(`hidden`),K.innerHTML=`
        <article class="next-match-card ${n?`next-match-card--live`:``}">
          <div class="next-match-card__top">
            <div>
              <span class="next-match-card__badge">${n?`● LIVE`:i(l)}</span>
              <p class="eyebrow">${a.is_home?`Heimspiel`:`Auswärtsspiel`}</p>
            </div>
            <div class="next-match-card__date">
              <strong>${i(o)}</strong>
              <span>${i(s)} Uhr</span>
            </div>
          </div>
          <a class="next-match-card__teams" href="${p}">
            <div class="${a.is_home?`is-tsv`:``}">${a.is_home?`<img class="next-match-tsv-logo" src="${i(e(`branding/tennis-logo.png`))}" alt="TSV Feldkirchen Tennis" />`:``}<span>${i(d)}</span></div>
            <strong>VS</strong>
            <div class="${a.is_home?``:`is-tsv`}">${a.is_home?``:`<img class="next-match-tsv-logo" src="${i(e(`branding/tennis-logo.png`))}" alt="TSV Feldkirchen Tennis" />`}<span>${i(f)}</span></div>
          </a>
          <div class="next-match-card__bottom">
            ${T(a)}
            <div class="actions">
              ${w(a)}
              <a class="button secondary" href="${p}">Spiel öffnen</a>
              ${n?`<a class="button" href="/live/?match=${encodeURIComponent(a.id)}">Liveticker</a>`:``}
            </div>
          </div>
        </article>`}else K.classList.add(`hidden`),K.innerHTML=``}let q=new Set((L??[]).filter(e=>e.match_id).map(e=>e.match_id)),J=document.querySelector(`#team-matches`);if(J){let e=Date.now(),t=(P??[]).filter(e=>W.find(t=>t.match_id===e.id)?.status===`live`),n=(P??[]).filter(n=>new Date(n.starts_at).getTime()>=e&&!t.includes(n)),r=(P??[]).filter(n=>new Date(n.starts_at).getTime()<e&&!t.includes(n)).reverse(),a=(e,t)=>t.length?`<section class="team-match-group"><h3>${i(e)} <small>(${t.length})</small></h3><div class="match-list">${t.map(e=>k(e,c,W,q)).join(``)}</div></section>`:``;J.innerHTML=a(`Jetzt LIVE`,t)+a(`Kommende Spiele`,n)+a(`Vergangene Ergebnisse`,r)||`<p class="muted">Noch keine Spiele eingetragen.</p>`}let Y=document.querySelector(`#team-news`);Y&&(Y.innerHTML=I?.length?I.map(e=>`<div class="news-row"><div><strong>${i(e.title)}</strong><p class="muted">${i(e.excerpt||``)}</p></div></div>`).join(``):`<p class="muted">Noch keine Mannschaftsberichte.</p>`);let X=document.querySelector(`#team-gallery`),Z=(L??[]).filter(e=>!e.match_id);if(X&&Z.length){let n=Z.map(e=>e.id),r=(await t.from(`gallery_items`).select(`*`).in(`gallery_id`,n).order(`sort_order`)).data??[];X.classList.add(`gallery-grid`),X.innerHTML=r.slice(0,12).map(t=>`<figure class="gallery-item"><img src="${i(e(t.storage_path))}" alt="${i(t.alt_text||u.name)}" loading="lazy" /><figcaption class="muted">${i(t.caption||``)}</figcaption></figure>`).join(``)}else X&&(X.classList.remove(`gallery-grid`),X.innerHTML=`<p class="muted">Noch keine allgemeinen Mannschaftsbilder veröffentlicht. Bilder einzelner Punktspiele findest du direkt beim jeweiligen Spiel.</p>`);await y(`#team-sponsors`,[`team`],{teamId:u.id})}async function N(n){_(`#match-detail-head`),_(`#match-detail-news`),_(`#match-detail-score`),_(`#match-detail-encounters`),_(`#match-detail-timeline`),_(`#match-detail-gallery`);let a=document.querySelector(`#match-detail-root`),o=document.querySelector(`#match-detail-head`),s=document.querySelector(`#match-detail-score`),l=document.querySelector(`#match-detail-encounters`),u=document.querySelector(`#match-detail-gallery`),d=document.querySelector(`#match-detail-news`);if(!a||!o||!s||!l||!u)return;if(!n){o.innerHTML=`<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>`;return}let f=await h(),[{data:p},{data:m},{data:g},{data:v}]=await Promise.all([t.from(`matches`).select(`*`).eq(`id`,n).eq(`is_published`,!0).maybeSingle(),t.from(`match_live_state`).select(`*`).eq(`match_id`,n).maybeSingle(),t.from(`match_encounters`).select(`*`).eq(`match_id`,n).order(`sort_order`).order(`position`),t.from(`galleries`).select(`*`).eq(`match_id`,n).eq(`published`,!0).order(`created_at`,{ascending:!1})]);if(!p){o.innerHTML=`<div class="card"><h1>Spiel nicht gefunden</h1></div>`;return}let{team:b,ts:x,season:S}=E(p,f),C=b?.name??`TSV Feldkirchen`,D=p.is_home?C:p.opponent,k=p.is_home?p.opponent:C,A=m?.status??`scheduled`,j=O(p),M=j?.home??m?.home_score??0,P=j?.away??m?.away_score??0,F=p.is_home?M:P,I=p.is_home?P:M,L=r(p.starts_at);o.innerHTML=`
    <div class="match-detail-hero">
      <div>
        <p class="eyebrow">${i([S?.name,x?.league].filter(Boolean).join(` · `)||`Punktspiel`)}</p>
        <div class="match-detail-titleline"><img src="${i(e(`branding/tennis-logo.png`))}" alt="TSV Feldkirchen Tennis" /><h1>${i(D)} <span>vs.</span> ${i(k)}</h1></div>
        <p class="hero__lead">${i(L)} · ${p.is_home?`Heimspiel`:`Auswärtsspiel`}</p>
        ${T(p)}
        <div class="actions">
          ${w(p)}
          <a class="button secondary" href="/mannschaften/${i(b?.slug||``)}/">Zur Mannschaft</a>
          ${A===`live`&&!j?`<a class="button" href="/live/?match=${encodeURIComponent(p.id)}">Liveticker öffnen</a>`:``}
          ${p.external_url?`<a class="button ghost" href="${i(p.external_url)}" target="_blank" rel="noreferrer">BTV / Details ↗</a>`:``}
        </div>
      </div>
    </div>`,s.innerHTML=A!==`scheduled`||j?`<div class="match-detail-score"><span class="status-pill ${!j&&A===`live`?`live`:``}">${j?`Offizielles BTV-Ergebnis`:A===`live`?`LIVE`:`Liveticker beendet`}</span><strong>${F} : ${I}</strong><span>aus Sicht des TSV${j?` · BTV ist maßgeblich; Liveticker-Einträge bleiben als Verlauf erhalten`:``}</span></div>`:`<div class="match-detail-score"><span class="status-pill">Geplant</span><strong>– : –</strong><span>Noch kein Ergebnis vorhanden</span></div>`;let R=g??[],z=t=>{let n=[t.tsv_player_1_name,t.tsv_player_2_name].filter(Boolean).join(` / `)||`Aufstellung folgt`,r=[t.opponent_slot_1,t.opponent_slot_2].filter(e=>e!=null).map(e=>`Gegner ${e}`).join(` / `)||(t.discipline===`singles`?`Gegner ${t.position}`:`Doppelaufstellung folgt`),a=`
      <div class="match-detail-encounter-side is-tsv">
        <img src="${i(e(`branding/tennis-logo.png`))}" alt="" />
        <div><span>TSV Feldkirchen</span><strong>${i(n)}</strong></div>
      </div>`,o=`
      <div class="match-detail-encounter-side">
        <span class="live-opponent-mark">G</span>
        <div><span>${i(p.opponent)}</span><strong>${i(r)}</strong></div>
      </div>`;return`
      <article class="match-detail-encounter ${t.status===`live`?`is-live`:``}">
        <div class="match-detail-encounter__head">
          <strong>${t.discipline===`singles`?`Einzel`:`Doppel`} ${t.position}</strong>
          <span class="status-pill ${t.status===`live`?`live`:``}">${t.status===`live`?`LIVE`:t.status===`finished`?`Beendet`:`Geplant`}</span>
        </div>
        <div class="match-detail-encounter__matchup">
          ${p.is_home?a:o}
          <div class="match-detail-encounter__result">${c(p,t)}</div>
          ${p.is_home?o:a}
        </div>
      </article>`};if(l.innerHTML=R.length?`
      <div class="page-head"><div><p class="eyebrow">Spieltag</p><h2>Einzel & Doppel</h2></div><span class="status-pill">${p.lineup_format===`4_2`?`4 + 2`:`6 + 3`}</span></div>
      <div class="match-detail-encounter-groups">
        <section><h3>Einzel</h3><div class="match-detail-encounter-list">${R.filter(e=>e.discipline===`singles`).map(z).join(``)}</div></section>
        <section><h3>Doppel</h3><div class="match-detail-encounter-list">${R.filter(e=>e.discipline===`doubles`).map(z).join(``)}</div></section>
      </div>`:`<div class="empty-gallery"><p class="eyebrow">Spieltag</p><h2>Aufstellung folgt</h2><p class="muted">Einzel und Doppel werden vor dem Spieltag eingetragen.</p></div>`,v?.length){let n=v.map(e=>e.id),{data:r}=await t.from(`gallery_items`).select(`*`).in(`gallery_id`,n).order(`sort_order`),a=new Map(v.map(e=>[e.id,e]));u.innerHTML=`
      <div class="page-head">
        <div><p class="eyebrow">Spieltag in Bildern</p><h2>${v.length===1?i(v[0].title):`Galerien zum Punktspiel`}</h2></div>
        <span class="status-pill">${(r??[]).length} Bilder</span>
      </div>
      <div class="gallery-grid">
        ${(r??[]).map(t=>{let n=a.get(t.gallery_id);return`<figure class="gallery-item">
            <img src="${i(e(t.storage_path))}" alt="${i(t.alt_text||n?.title||C)}" loading="lazy" />
            <figcaption class="muted">${i(t.caption||n?.title||``)}</figcaption>
          </figure>`}).join(``)}
      </div>`}else u.innerHTML=`<div class="empty-gallery"><p class="eyebrow">Spieltag in Bildern</p><h2>Noch keine Galerie</h2><p class="muted">Sobald Bilder zu diesem Punktspiel veröffentlicht wurden, erscheinen sie hier.</p></div>`;if(d){let{data:e,error:r}=await t.from(`news`).select(`id,title,excerpt,body,published_at`).eq(`match_id`,n).eq(`status`,`published`).order(`published_at`,{ascending:!1});d.innerHTML=r?`<p class="muted">Spielberichte sind gerade nicht abrufbar.</p>`:e?.length?`<p class="eyebrow">Aus dem Vereinsleben</p><h2>Spielberichte</h2>${e.map(e=>`<article class="match-report"><h3>${i(e.title)}</h3><p class="muted">${i(e.excerpt||``)}</p>
      <details><summary>Spielbericht lesen</summary><p class="report-body">${i(e.body||``)}</p></details></article>`).join(``)}`:`<p class="eyebrow">Spielberichte</p><p class="muted">Zu diesem Spiel wurde noch kein Bericht veröffentlicht.</p>`}await y(`#match-detail-sponsor`,[`match`],{teamId:b?.id,matchId:n});let B=document.querySelector(`#match-detail-timeline`);if(B){let{data:e,error:a}=await t.from(`live_ticker_entries`).select(`*`).eq(`match_id`,n).is(`deleted_at`,null).order(`created_at`,{ascending:!1}).limit(25);B.innerHTML=`<div class="page-head"><div><p class="eyebrow">Spielverlauf</p><h2>Tickermeldungen</h2></div>
      <a class="button ghost" href="/live/?match=${encodeURIComponent(n)}">Ticker-Archiv öffnen</a></div>`+(a?`<p class="muted">Tickermeldungen sind momentan nicht verfügbar.</p>`:e?.length?e.map(e=>`<div class="timeline-row"><div><strong>${i(e.message)}</strong>
        <div class="match-meta">${i(r(e.created_at))}</div></div></div>`).join(``):`<p class="muted">Noch keine Tickermeldungen zu diesem Spiel.</p>`)}A===`live`&&window.setTimeout(()=>N(n),3e4)}async function P(){let e=document.querySelector(`#calendar-list`),a=document.querySelector(`#calendar-month-grid`),o=document.querySelector(`#calendar-month-title`),s=document.querySelector(`#calendar-day-heading`),c=document.querySelector(`#calendar-day-count`),l=document.querySelector(`#calendar-day-list`),u=document.querySelector(`#calendar-day-modal`),d=document.querySelector(`#calendar-modal-heading`),f=document.querySelector(`#calendar-modal-count`),p=document.querySelector(`#calendar-modal-list`),m=document.querySelector(`#calendar-day-agenda`),g=document.querySelector(`#calendar-month-board`),_=document.querySelector(`#calendar-back-to-month`),v=document.querySelector(`#calendar-next-list`),y=document.querySelector(`#calendar-data-status`),b=document.querySelector(`#calendar-team`),x=document.querySelector(`#calendar-category`),S=document.querySelector(`#calendar-kind`),C=document.querySelector(`#calendar-range`),w=document.querySelector(`#calendar-subscriptions`),T=document.querySelector(`#calendar-view`),D=document.querySelector(`#calendar-favorite`),O=document.querySelector(`#calendar-favorite-status`),A=document.querySelector(`#calendar-week-range`);if(!e||!a||!o||!s||!c||!l||!v||!b||!x||!S||!w||!y)return;let j=new Intl.DateTimeFormat(`en-GB`,{timeZone:`Europe/Berlin`,day:`2-digit`,month:`2-digit`,year:`numeric`}),M=new Intl.DateTimeFormat(`de-DE`,{timeZone:`UTC`,month:`long`,year:`numeric`}),N=new Intl.DateTimeFormat(`de-DE`,{timeZone:`UTC`,weekday:`long`,day:`numeric`,month:`long`,year:`numeric`}),P=new Intl.DateTimeFormat(`de-DE`,{timeZone:`UTC`,day:`numeric`,month:`short`}),F=e=>{let t=j.formatToParts(new Date(e)),n=e=>t.find(t=>t.type===e)?.value||``;return`${n(`year`)}-${n(`month`)}-${n(`day`)}`},I=e=>{let[t,n,r]=e.split(`-`).map(Number);return new Date(Date.UTC(t,n-1,r,12))},L=e=>e.toISOString().slice(0,10),R=F(new Date),[z,B]=R.split(`-`).map(Number),V={seasons:[],categories:[],teams:[],teamSeasons:[],btvLinks:[]},H=[],U=[],W=[],G=!1,K=!1,q=`tsv-tennis-favorite-team`,J=``;try{J=localStorage.getItem(q)||``}catch{}let Y=864e5,X=[`men`,`women`,`youth`,`event`,`other`],Z={men:`Herren`,women:`Damen`,youth:`Jugend`,event:`Veranstaltung`,other:`Weitere Punktspiele`},ee=e=>{let t=V.categories.find(t=>t.id===e?.category_id),n=e?.gender||t?.slug;return n===`men`||n===`herren`?`men`:n===`women`||n===`damen`?`women`:n===`youth`||n===`jugend`?`youth`:`other`},Q=()=>{let e=b.value,t=x.value,n=S.value,a=(n===`events`?[]:H).filter(n=>{let{team:r}=E(n,V);return(!e||r?.id===e)&&(!t||r?.category_id===t)}).map(e=>{let{team:t}=E(e,V);return{id:e.id,endAt:e.ends_at||null,location:[e.venue_name,e.venue_address].filter(Boolean).join(`, `),at:e.starts_at,key:F(e.starts_at),kind:`match`,marker:ee(t),title:`${t?.name||`TSV Feldkirchen`} gegen ${e.opponent}`,href:`/spiel/?match=${encodeURIComponent(e.id)}`,html:k(e,V,W)}}),o=(n===`matches`?[]:U).filter(n=>{if(e&&n.team_id!==e)return!1;if(t){let e=V.teams.find(e=>e.id===n.team_id);if(!e||e.category_id!==t)return!1}return!0}).map(e=>({id:e.id,endAt:e.ends_at||null,location:e.location_name||``,at:e.starts_at,key:F(e.starts_at),kind:`event`,marker:`event`,title:e.title,href:e.rsvp_enabled?`/veranstaltung/?slug=${encodeURIComponent(e.slug)}`:``,html:`<div class="calendar-event-detail">
        <div><span class="calendar-event-type">Veranstaltung</span><strong>${i(e.title)}</strong>
          <div class="match-meta">${e.all_day?`Ganztägig`:i(r(e.starts_at))} · ${i(e.location_name||`TSV Feldkirchen`)}</div>
          ${e.description?`<p class="muted">${i(e.description)}</p>`:``}
          ${e.rsvp_enabled?`<a class="button secondary calendar-rsvp-link" href="/veranstaltung/?slug=${encodeURIComponent(e.slug)}">Teilnahme zusagen oder absagen ↗</a>`:``}
        </div></div>`})),s=C?.value||`all`,c=new Date,l=F(c),u=Number(l.slice(0,4)),d=`${u}-01-01`,f=`${u+1}-01-01`,p=F(new Date(c.getTime()-7776e6));return[...a,...o].filter(e=>s===`upcoming`?e.key>=l:s===`year`?e.key>=d&&e.key<f:s!==`recent`||e.key>=p&&e.key<=l).sort((e,t)=>new Date(e.at).getTime()-new Date(t.at).getTime())},$=()=>{let t=Q(),r=F(new Date),u=T?.value===`week`,m=I(R),h=(m.getUTCDay()+6)%7,g=new Date(m.getTime()-h*Y),_=u?0:(new Date(Date.UTC(z,B-1,1)).getUTCDay()+6)%7,y=new Date(Date.UTC(z,B,0)).getUTCDate(),C=u?7:Math.ceil((_+y)/7)*7,E=u?g.getTime():Date.UTC(z,B-1,1);if(o.textContent=u?`Kalenderwoche`:M.format(new Date(Date.UTC(z,B-1,1,12))),A){A.classList.toggle(`hidden`,!u);let e=new Date(g.getTime()+6*Y);A.textContent=u?`${P.format(g)} – ${P.format(e)}`:``}let D=new Map;t.forEach(e=>{let t=D.get(e.key)||{men:0,women:0,youth:0,event:0,other:0};t[e.marker]+=1,D.set(e.key,t)});let O=[];for(let e=0;e<C;e++){let t=new Date(E+(e-_)*864e5),n=L(t),a=D.get(n)||{men:0,women:0,youth:0,event:0,other:0},o=X.reduce((e,t)=>e+a[t],0),s=!u&&t.getUTCMonth()!==B-1,c=n===r,l=n===R,d=N.format(t),f=X.filter(e=>a[e]>0).map(e=>`${Z[e]}: ${a[e]}`).join(`, `),p=X.filter(e=>a[e]>0).map(e=>`<i class="calendar-dot calendar-dot--${e}"></i>`).join(``),m=`${d}${c?`, heute`:``}, ${f||`keine Termine`}`;O.push(`<button type="button" class="calendar-day${s?` calendar-day--outside`:``}${c?` calendar-day--today`:``}${l?` calendar-day--selected`:``}${o?` calendar-day--busy`:``}" data-calendar-day="${n}" tabindex="${l?`0`:`-1`}" aria-label="${i(m)}" aria-pressed="${l?`true`:`false`}" ${c?`aria-current="date"`:``}>
        <span class="calendar-day__number">${t.getUTCDate()}</span>
        <span class="calendar-day__dots" aria-hidden="true">${p}</span>
        ${o?`<small class="calendar-day__count">${o} ${o===1?`Termin`:`Termine`}</small>`:``}
      </button>`)}a.innerHTML=O.join(``);let k=t.filter(e=>e.key===R);s.textContent=`${R===r?`Heute · `:``}${N.format(I(R))}`,c.textContent=G?K?`Einige Termine sind momentan nicht abrufbar.`:k.length?`${k.length} ${k.length===1?`Termin`:`Termine`} an diesem Tag`:`Keine Termine für diesen Tag`:`Termine werden geladen …`,l.innerHTML=G?k.length?k.map((e,t)=>`<div class="calendar-day-entry"><span class="calendar-entry-type calendar-entry-type--${e.marker}"><i class="calendar-dot calendar-dot--${e.marker}" aria-hidden="true"></i>${i(Z[e.marker])}</span>${e.html}<button type="button" class="button ghost" data-calendar-save="${t}">Diesen Termin zu meinem Kalender hinzufügen (.ics)</button></div>`).join(``):`<div class="calendar-agenda-empty"><span aria-hidden="true">✦</span><strong>Hier ist noch nichts geplant.</strong><p class="muted">Wähle einen markierten Tag im Kalender oder entdecke die nächsten Termine.</p></div>`:`<p class="muted">Die Termine werden ermittelt …</p>`,d&&(d.textContent=s.textContent),f&&(f.textContent=c.textContent),p&&(p.innerHTML=l.innerHTML,p.querySelectorAll(`.calendar-event-detail p.muted`).forEach(e=>{if((e.textContent?.trim()||``).length<=180)return;let t=e.cloneNode(!0);t.classList.add(`calendar-event-excerpt`);let n=document.createElement(`details`);n.className=`calendar-event-more`;let r=document.createElement(`summary`);r.textContent=`Mehr →`,n.append(r),e.replaceWith(t,n),n.append(e),n.addEventListener(`toggle`,()=>{t.hidden=n.open,r.textContent=n.open?`Weniger ↑`:`Mehr →`})}));let j=t.filter(e=>e.key>=r).slice(0,4);if(v.innerHTML=G?j.length?j.map(e=>{let t=P.format(I(e.key));return`<div class="calendar-next-item"><span class="calendar-next-date">${i(t)}</span><div>${e.href?`<a href="${i(e.href)}">${i(e.title)}</a>`:`<strong>${i(e.title)}</strong>`}<small class="calendar-next-type"><i class="calendar-dot calendar-dot--${e.marker}" aria-hidden="true"></i>${i(Z[e.marker])}</small></div></div>`}).join(``):`<p class="muted">Derzeit keine weiteren Termine angekündigt.</p>`:`<p class="muted">Nächste Termine werden geladen …</p>`,G){let n=t.filter(e=>e.key>=r),i=t.filter(e=>e.key<r).reverse();e.innerHTML=t.length?`<section class="calendar-time-group"><h3>Kommende Termine (${n.length})</h3>${n.length?n.map(e=>e.html).join(``):`<p class="muted">Keine weiteren Termine angekündigt.</p>`}</section>
        ${i.length?`<details class="calendar-past"><summary>Vergangene Termine (${i.length}) anzeigen</summary>${i.map(e=>e.html).join(``)}</details>`:``}`:`<p class="muted">Für diese Auswahl sind keine Termine eingetragen.</p>`}let V={};S.value!==`all`&&(V.type=S.value);let H=b.selectedOptions[0],U=x.selectedOptions[0];b.value&&H?.dataset.slug?V.team=H.dataset.slug:x.value&&U?.dataset.slug&&(V.category=U.dataset.slug),w.innerHTML=`<a class="button" href="${i(n(V))}">Auswahl abonnieren</a>
      <a class="button secondary" href="${i(n({type:`matches`}))}">Alle Punktspiele</a>
      <a class="button secondary" href="${i(n({type:`events`}))}">Vereinstermine</a>`},te=e=>{e?.scrollIntoView({behavior:window.matchMedia(`(prefers-reduced-motion: reduce)`).matches?`auto`:`smooth`,block:`start`})},ne=(e,t=`none`)=>{R=e,[z,B]=e.split(`-`).map(Number),$(),t===`calendar`?a.querySelector(`[data-calendar-day="${e}"]`)?.focus():t===`modal`?u&&!u.open&&u.showModal():t===`agenda`&&(s.focus({preventScroll:!0}),te(m))},re=e=>{if(T?.value===`week`)ne(L(new Date(I(R).getTime()+e*7*Y)));else{let t=new Date(Date.UTC(z,B-1+e,1,12));ne(L(t))}},ie=e=>e.replace(/\\/g,`\\\\`).replace(/\n/g,`\\n`).replace(/,/g,`\\,`).replace(/;/g,`\\;`),ae=e=>e.toISOString().replace(/[-:]/g,``).replace(/\.\d{3}/,``),oe=e=>{let t=e.target;if(!(t instanceof Element))return;let n=t.closest(`[data-calendar-save]`);if(!n)return;let r=Number(n.dataset.calendarSave),i=Q().filter(e=>e.key===R)[r];if(!i)return;let a=new Date(i.at),o=i.endAt?new Date(i.endAt):new Date(a.getTime()+72e5),s=[`BEGIN:VCALENDAR`,`VERSION:2.0`,`PRODID:-//TSV Feldkirchen Tennis//DE`,`BEGIN:VEVENT`,`UID:${i.id}@tsvfeldkirchen.de`,`DTSTAMP:${ae(new Date)}`,`DTSTART:${ae(a)}`,`DTEND:${ae(o)}`,`SUMMARY:${ie(i.title)}`,`LOCATION:${ie(i.location)}`,`END:VEVENT`,`END:VCALENDAR`,``],c=URL.createObjectURL(new Blob([s.join(`\r
`)],{type:`text/calendar;charset=utf-8`})),l=document.createElement(`a`);l.href=c,l.download=`tsv-termin.ics`,document.body.append(l),l.click(),l.remove(),window.setTimeout(()=>URL.revokeObjectURL(c),1500)};l.addEventListener(`click`,oe),p?.addEventListener(`click`,oe);let se=()=>{u?.open&&u.close()};document.querySelector(`#calendar-modal-close`)?.addEventListener(`click`,se),document.querySelector(`#calendar-modal-dismiss`)?.addEventListener(`click`,se),document.querySelector(`#calendar-modal-details`)?.addEventListener(`click`,()=>{se(),s.focus({preventScroll:!0}),te(m)}),u?.addEventListener(`click`,e=>{e.target===u&&se()}),document.querySelector(`#calendar-prev`)?.addEventListener(`click`,()=>re(-1)),document.querySelector(`#calendar-next`)?.addEventListener(`click`,()=>re(1)),document.querySelector(`#calendar-today`)?.addEventListener(`click`,()=>ne(F(new Date),`modal`)),_?.addEventListener(`click`,()=>{a.querySelector(`[data-calendar-day="${R}"]`)?.focus({preventScroll:!0}),te(g)}),a.addEventListener(`click`,e=>{let t=e.target;if(!(t instanceof Element))return;let n=t.closest(`button[data-calendar-day]`);n?.dataset.calendarDay&&ne(n.dataset.calendarDay,`modal`)}),a.addEventListener(`keydown`,e=>{let t=e.target;if(!(t instanceof HTMLButtonElement)||!t.dataset.calendarDay)return;let n={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(n===void 0)return;e.preventDefault();let r=L(new Date(I(t.dataset.calendarDay).getTime()+n*864e5));ne(r,`calendar`)}),[b,x,S,C,T].filter(e=>!!e).forEach(e=>e.addEventListener(`change`,$)),D?.addEventListener(`change`,()=>{let e=V.teams.find(e=>e.slug===D.value);b.value=e?.id||``,x.value=``,$()}),document.querySelector(`#calendar-save-favorite`)?.addEventListener(`click`,()=>{J=D?.value||``;try{J?localStorage.setItem(q,J):localStorage.removeItem(q)}catch{}O&&(O.textContent=J?`Lieblingsmannschaft auf diesem Gerät gespeichert.`:`Favorit entfernt.`),$()}),$();let ce=window.setTimeout(()=>{G||(K=!0,G=!0,y.classList.remove(`hidden`),y.textContent=`Die Datenabfrage dauert ungewöhnlich lange. Der Kalender lässt sich bereits bedienen; Termine werden nachgeladen.`,$())},12e3);try{if(V=await h(),b.innerHTML+=V.teams.map(e=>`<option value="${e.id}" data-slug="${i(e.slug)}">${i(e.name)}</option>`).join(``),D){D.innerHTML=`<option value="">Keine / alle Mannschaften</option>`+V.teams.map(e=>`<option value="${i(e.slug)}">${i(e.name)}</option>`).join(``);let e=V.teams.find(e=>e.slug===J);e&&(D.value=e.slug,b.value=e.id)}x.innerHTML+=V.categories.map(e=>`<option value="${e.id}" data-slug="${i(e.slug)}">${i(e.name)}</option>`).join(``);let[e,n]=await Promise.all([t.from(`matches`).select(`*`).eq(`is_published`,!0).order(`starts_at`),t.from(`events`).select(`*`).eq(`status`,`published`).order(`starts_at`)]);H=e.data??[],U=n.data??[],K=!!(e.error||n.error),H.length&&(W=(await t.from(`match_live_state`).select(`*`).in(`match_id`,H.map(e=>e.id))).data??[])}catch(e){K=!0,console.warn(`Kalenderdaten konnten nicht vollständig geladen werden:`,e)}finally{window.clearTimeout(ce),G=!0,K?(y.classList.remove(`hidden`),y.textContent=`Ein Teil der Termine ist momentan nicht erreichbar. Der Kalender bleibt bedienbar; die angezeigten Termine können unvollständig sein.`):(y.classList.add(`hidden`),y.textContent=``),$()}}async function F(){_(`#news-list`);let n=document.querySelector(`#news-list`);if(!n)return;let{data:a,error:o}=await t.from(`news`).select(`*`).eq(`status`,`published`).order(`published_at`,{ascending:!1});n.innerHTML=a?.length?a.map(t=>`
    <article class="card ${t.slug?.startsWith(`btv-spielverlegung-`)?`news-card--reschedule`:``}">
      ${t.hero_image_path?`<img src="${i(e(t.hero_image_path))}" alt="" loading="lazy" style="border-radius:14px;aspect-ratio:16/9;object-fit:cover;margin-bottom:16px">`:``}
      ${t.slug?.startsWith(`btv-spielverlegung-`)?`<p class="news-reschedule-label">BTV · Spielverlegung</p>`:``}
      <p class="eyebrow">${t.published_at?i(r(t.published_at)):`Aktuelles`}</p>
      <h2>${i(t.title)}</h2>
      <p class="muted">${i(t.excerpt||(t.body||``).slice(0,220))}</p>
      <details><summary>Weiterlesen</summary><p style="white-space:pre-wrap">${i(t.body)}</p></details>
    </article>
  `).join(``):`<p class="muted">${o?`Beiträge sind momentan nicht abrufbar.`:`Noch keine Beiträge veröffentlicht.`}</p>`}async function I(e){_(`#managed-page-content`);let n=document.querySelector(`#managed-title`),r=document.querySelector(`#managed-page-content`);if(!r)return;let{data:i,error:a}=await t.from(`pages`).select(`*`).eq(`slug`,e).eq(`published`,!0).maybeSingle();if(a||!i){r.innerHTML=`<p class="muted">${a?`Dieser Inhalt ist momentan nicht abrufbar.`:`Der Inhalt wird noch gepflegt.`}</p>`;return}n&&(n.textContent=i.title),r.textContent=i.body}async function L(){_(`#sponsors-grid`);let n=document.querySelector(`#sponsors-grid`);if(!n)return;let{data:r,error:a}=await t.from(`sponsors`).select(`*`).eq(`active`,!0).order(`sort_order`);n.innerHTML=r?.length?r.map(t=>`
    <article class="card team-card">
      ${t.logo_path?`<img src="${i(e(t.logo_path))}" alt="Logo ${i(t.name)}" loading="lazy">`:``}
      <h3>${i(t.name)}</h3>
      <p class="muted">${i(t.description||``)}</p>
      ${t.url?`<a class="button ghost" href="${i(t.url)}" target="_blank" rel="noreferrer">Website ↗</a>`:``}
    </article>
  `).join(``):`<p class="muted">${a?`Sponsoren sind momentan nicht abrufbar.`:`Sponsoren werden derzeit eingepflegt.`}</p>`}async function R(){_(`#officials-grid`);let n=document.querySelector(`#officials-grid`);if(!n)return;let{data:r,error:a}=await t.from(`officials`).select(`*`).eq(`published`,!0).order(`sort_order`);n.innerHTML=r?.length?r.map(t=>`
    <article class="card team-card">
      ${t.photo_path?`<img src="${i(e(t.photo_path))}" alt="${i(t.name)}" loading="lazy">`:`<div class="official-placeholder" aria-hidden="true"><span>🎾</span><strong>${i(String(t.name).split(` `).map(e=>e[0]).join(``).slice(0,2))}</strong></div>`}
      <div><p class="eyebrow">${i(t.title)}</p><h3>${i(t.name)}</h3></div>
      <p class="muted">${t.email?`<a href="mailto:${i(t.email)}">${i(t.email)}</a>`:``}${t.email&&t.phone?`<br>`:``}${t.phone?i(t.phone):``}</p>
    </article>
  `).join(``):`<p class="muted">${a?`Funktionäre sind momentan nicht abrufbar.`:`Funktionäre werden derzeit eingepflegt.`}</p>`}async function z(n){_(`#live-match-head`),_(`#live-score`),_(`#live-encounters`),_(`#live-timeline`);let a=document.querySelector(`#live-match-head`),s=document.querySelector(`#live-score`),l=document.querySelector(`#live-encounters`),u=document.querySelector(`#live-timeline`);if(!a||!s||!l||!u)return;let d=`all`,f=()=>{l.querySelectorAll(`[data-live-view]`).forEach(e=>{let t=e.dataset.liveView===d;e.classList.toggle(`is-active`,t),e.setAttribute(`aria-pressed`,String(t))});let e=0;l.querySelectorAll(`[data-live-encounter-status]`).forEach(t=>{let n=d===`all`||t.dataset.liveEncounterStatus===d;t.hidden=!n,n&&e++}),l.querySelectorAll(`.live-encounter-group`).forEach(e=>{e.hidden=!e.querySelector(`[data-live-encounter-status]:not([hidden])`)});let t=l.querySelector(`#live-view-empty`);t&&(t.hidden=e>0)};if(l.addEventListener(`click`,e=>{if(!(e.target instanceof Element))return;let t=e.target.closest(`[data-live-view]`);t&&(d=t.dataset.liveView||`all`,f())}),!n){a.innerHTML=`<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>`;return}let p=await h(),m=e(`branding/tennis-logo.png`),g=e=>`
    <div class="live-team live-team--tsv">
      <img src="${i(m)}" alt="TSV Feldkirchen Tennis" />
      <div><span>${i(e)}</span><strong>TSV Feldkirchen</strong></div>
    </div>`,v=(e,t)=>`
    <div class="live-team live-team--opponent">
      <span class="live-opponent-mark">G</span>
      <div><span>${i(e)}</span><strong>${i(t)}</strong></div>
    </div>`,b=(e,t,n)=>{if(n){let e=[t.tsv_player_1_name,t.tsv_player_2_name].filter(Boolean);return`
        <div class="live-encounter-side live-encounter-side--tsv">
          <img src="${i(m)}" alt="" />
          <div>
            <span>TSV Feldkirchen</span>
            <strong>${i(e.join(` / `)||`Aufstellung folgt`)}</strong>
          </div>
        </div>`}let r=[t.opponent_slot_1,t.opponent_slot_2].filter(e=>e!=null).map(e=>`Gegner ${e}`),a=t.discipline===`singles`?`Gegner ${t.position}`:`Doppelaufstellung folgt`;return`
      <div class="live-encounter-side live-encounter-side--opponent">
        <span class="live-opponent-mark">G</span>
        <div>
          <span>${i(e.opponent)}</span>
          <strong>${i(r.join(` / `)||a)}</strong>
        </div>
      </div>`},x=(e,t)=>{let n=b(e,t,!0),r=b(e,t,!1),a=t.status===`live`?`Läuft gerade`:t.status===`finished`?`Abgeschlossen`:`Noch offen`,s=o(t.result_text),l=t.status===`finished`&&s.winner?s.winner===`tsv`?`TSV gewinnt`:`Gegner gewinnt`:t.status===`live`&&s.hasResult?`Zwischenstand`:``;return`
      <article class="live-encounter-row ${t.status===`live`?`is-live`:``} ${t.status===`finished`?`is-finished`:``}"
        data-live-encounter-status="${i(t.status)}">
        <div class="live-encounter-row__head">
          <div class="live-encounter-row__identity">
            <span class="live-encounter-number">${t.discipline===`singles`?`E`:`D`}${t.position}</span>
            <strong>${t.discipline===`singles`?`Einzel`:`Doppel`} ${t.position}</strong>
          </div>
          <div class="live-encounter-row__flags">
            ${l?`<span class="live-result-note">${i(l)}</span>`:``}
            <span class="status-pill ${t.status===`live`?`live`:``}">${a}</span>
          </div>
        </div>
        <div class="live-encounter-matchup">
          ${e.is_home?n:r}
          <div class="live-encounter-result">
            ${c(e,t)}
          </div>
          ${e.is_home?r:n}
        </div>
      </article>`},S=async()=>{let[{data:e},{data:o},{data:c},{data:d}]=await Promise.all([t.from(`matches`).select(`*`).eq(`id`,n).maybeSingle(),t.from(`match_live_state`).select(`*`).eq(`match_id`,n).maybeSingle(),t.from(`live_ticker_entries`).select(`*`).eq(`match_id`,n).is(`deleted_at`,null).order(`created_at`,{ascending:!1}),t.from(`match_encounters`).select(`*`).eq(`match_id`,n).order(`sort_order`).order(`position`)]);if(!e){a.innerHTML=`<div class="card"><h1>Spiel nicht gefunden</h1></div>`;return}let{team:m}=E(e,p),h=m?.name??`TSV Feldkirchen`,_=e.is_home?h:e.opponent,y=e.is_home?e.opponent:h;a.innerHTML=`
      <div class="live-match-heading">
        <p class="eyebrow">Der Spieltag im Überblick</p>
        <h1>${i(_)} <span>gegen</span> ${i(y)}</h1>
        <p class="live-match-heading__meta">
          <span>${i(r(e.starts_at))}</span>
          <span class="live-match-heading__separator" aria-hidden="true">·</span>
          <span>${e.is_home?`TSV mit Heimrecht`:`TSV auswärts`}</span>
        </p>
        <div class="live-match-heading__venue">${T(e)}${w(e)}</div>
      </div>`;let b=O(e),S=b?.home??o?.home_score??0,C=b?.away??o?.away_score??0,D=e.is_home?g(`Heim`):v(`Heim`,e.opponent),k=e.is_home?v(`Auswärts`,e.opponent):g(`Auswärts`),A=d??[],j=A.filter(e=>e.discipline===`singles`),M=A.filter(e=>e.discipline===`doubles`),N=A.filter(e=>e.status===`finished`).length,P=A.filter(e=>e.status===`live`).length,F=A.length?Math.round(N/A.length*100):0;s.innerHTML=`
      <div class="live-score-topline">
        <div class="live-score-status">
          <div class="live-badge ${o?.status===`live`?`is-running`:``}">
            <span class="live-dot" aria-hidden="true"></span>
            ${b?`BTV-Ergebnis bestätigt`:o?.status===`live`?`Spieltag läuft`:o?.status===`finished`?`Spieltag beendet`:`Spieltag geplant`}
          </div>
          <span class="live-score-topline__hint">${b?`Offizielles BTV-Endergebnis · Heim : Gast`:`Liveticker-Zwischenstand · Heim : Gast`}</span>
        </div>
        <span class="live-score-topline__updated">${b?`Offizielle Wertung hat Vorrang`:`Aktuelle Spielstände`}</span>
      </div>
      <div class="live-scoreboard">
        ${D}
        <div class="live-scoreboard__score" aria-label="Heim ${S}, Gast ${C}">
          <span>Begegnungen</span>
          <strong><b>${S}</b><i aria-hidden="true">:</i><b>${C}</b></strong>
        </div>
        ${k}
      </div>
      <div class="live-match-progress">
        <div class="live-match-progress__info">
          <span><strong>${N} von ${A.length}</strong> Begegnungen beendet</span>
          <span>${P?`<span class="live-inline-dot" aria-hidden="true"></span>${P} gerade live`:`Noch keine Begegnung läuft`}</span>
        </div>
        <div class="live-match-progress__track" role="progressbar" aria-valuenow="${F}" aria-valuemin="0" aria-valuemax="100" aria-label="Abgeschlossene Begegnungen">
          <span style="width:${F}%"></span>
        </div>
      </div>`,l.innerHTML=A.length?`
        <div class="live-encounters__toolbar">
          <div><p class="matchday-kicker">Alle Matches im Blick</p><h2>Einzel &amp; Doppel</h2></div>
          <div class="live-encounters__filters" role="group" aria-label="Begegnungen filtern">
            <button type="button" data-live-view="all" aria-pressed="true">Alle <span>${A.length}</span></button>
            <button type="button" data-live-view="live" aria-pressed="false">Live <span>${P}</span></button>
            <button type="button" data-live-view="finished" aria-pressed="false">Beendet <span>${N}</span></button>
          </div>
        </div>
        ${j.length?`<section class="live-encounter-group">
          <div class="live-encounter-group__title"><h3>Einzel</h3><span>${j.length} Begegnungen</span></div>
          <div class="live-encounter-list">${j.map(t=>x(e,t)).join(``)}</div>
        </section>`:``}
        ${M.length?`<section class="live-encounter-group">
          <div class="live-encounter-group__title"><h3>Doppel</h3><span>${M.length} Begegnungen</span></div>
          <div class="live-encounter-list">${M.map(t=>x(e,t)).join(``)}</div>
        </section>`:``}
        <p class="live-encounter-empty" id="live-view-empty" hidden role="status">In dieser Auswahl gibt es aktuell keine Begegnungen.</p>`:`<div class="live-encounter-empty"><strong>Die Aufstellung wird noch vorbereitet.</strong><p class="muted">Sobald Einzel und Doppel eingetragen sind, erscheinen sie hier.</p></div>`,A.length&&f(),u.innerHTML=c?.length?c.map(e=>`
          <div class="timeline-row">
            <div><strong>${i(e.message)}</strong><div class="match-meta">${i(r(e.created_at))}</div></div>
            ${e.home_score!=null&&e.away_score!=null?`<span class="score">${e.home_score} : ${e.away_score}</span>`:``}
          </div>`).join(``):`<p class="muted">Noch keine Tickermeldungen.</p>`};await S(),await y(`#live-sponsor`,[`live`,`match`],{matchId:n});let C=[t.channel(`public-match:${n}`).on(`postgres_changes`,{event:`*`,schema:`public`,table:`match_live_state`,filter:`match_id=eq.${n}`},S).on(`postgres_changes`,{event:`*`,schema:`public`,table:`match_encounters`,filter:`match_id=eq.${n}`},S).on(`postgres_changes`,{event:`*`,schema:`public`,table:`live_ticker_entries`,filter:`match_id=eq.${n}`},S).subscribe()];try{let{data:e}=await t.auth.getSession();if(e.session){await t.realtime.setAuth(e.session.access_token);let r=t.channel(`match:${n}:ticker`,{config:{private:!0}}).on(`broadcast`,{event:`INSERT`},S).on(`broadcast`,{event:`UPDATE`},S).on(`broadcast`,{event:`DELETE`},S).subscribe();C.push(r)}}catch{}window.addEventListener(`beforeunload`,()=>{C.forEach(e=>{t.removeChannel(e)})}),window.setInterval(S,3e4)}export{N as a,L as c,I as i,M as l,A as n,F as o,z as r,R as s,P as t,j as u};