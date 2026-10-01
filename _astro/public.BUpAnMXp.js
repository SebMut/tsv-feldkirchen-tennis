import{n as e,r as t,t as n}from"./supabase.BgDdE24J.js";import{n as r,t as i}from"./ui.DpEpU-0S.js";var a=`data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22960%22%20height%3D%22540%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e7f0ed%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%20font-family%3D%22Arial%22%20font-size%3D%2238%22%20fill%3D%22%23216052%22%3ETSV%20Feldkirchen%20Tennis%3C%2Ftext%3E%3C%2Fsvg%3E`;function o(t){return t.gender===`men`?e(`teams/herren.png`):t.gender===`women`?e(`teams/damen.png`):t.gender===`youth`?e(`teams/jugend.png`):a}function s(e=``){return e.split(/\s+/).filter(Boolean).slice(0,2).map(e=>e[0]?.toUpperCase()||``).join(``)||`TSV`}async function c(){let[{data:e},{data:n},{data:r},{data:i}]=await Promise.all([t.from(`seasons`).select(`*`).order(`year`,{ascending:!1}),t.from(`team_categories`).select(`*`).order(`sort_order`),t.from(`teams`).select(`*`).eq(`active`,!0).order(`sort_order`),t.from(`team_seasons`).select(`*`)]);return{seasons:e??[],categories:n??[],teams:r??[],teamSeasons:i??[]}}function l(e){return new Map(e.map(e=>[e.id,e]))}async function u(n,r,a={}){let o=document.querySelector(n);if(!o)return;let{data:s,error:c}=await t.from(`sponsor_placements`).select(`*`).eq(`active`,!0).in(`placement`,r);if(c||!s?.length){o.classList.add(`hidden`),o.innerHTML=``;return}let l=new Date().toISOString().slice(0,10),u=s.filter(e=>e.starts_on&&e.starts_on>l||e.ends_on&&e.ends_on<l?!1:e.placement===`team`?!!a.teamId&&e.team_id===a.teamId:e.placement===`match`?!!a.matchId&&e.match_id===a.matchId:e.placement===`live`&&e.match_id?e.match_id===a.matchId:e.team_id&&a.teamId?e.team_id===a.teamId:!e.team_id&&!e.match_id);if(!u.length){o.classList.add(`hidden`),o.innerHTML=``;return}let d=[...new Set(u.map(e=>e.sponsor_id))],{data:f}=await t.from(`sponsors`).select(`*`).in(`id`,d).eq(`active`,!0).order(`sort_order`);if(!f?.length){o.classList.add(`hidden`),o.innerHTML=``;return}let p=r.includes(`live`)||r.includes(`match`)?`Sponsor des Spieltags`:r.includes(`team`)?`Mannschaftspartner`:`Unsere Partner`;o.classList.remove(`hidden`),o.innerHTML=`
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
    </div>`}function d(e,t){let n=t.teamSeasons.find(t=>t.id===e.team_season_id);return{ts:n,team:t.teams.find(e=>e.id===n?.team_id),season:t.seasons.find(e=>e.id===n?.season_id)}}function f(e,t){return t.find(t=>t.match_id===e.id)}function p(t,n,a=[],o=new Set){let{team:s}=d(t,n),c=f(t,a),l=c?.status??`scheduled`,u=c?.home_score??0,p=c?.away_score??0,m=t.is_home?u:p,h=t.is_home?p:u,g=t.is_home?`Heim`:`Auswärts`,_=`/spiel/?match=${encodeURIComponent(t.id)}`;return`
    <div class="match-row">
      <a class="match-row__main" href="${_}">
        <span class="match-row__teamline"><img class="match-row__tsv-logo" src="${i(e(`branding/tennis-logo.png`))}" alt="" /><strong>${i(s?.name??`TSV Feldkirchen`)} · ${i(g)}</strong></span>
        <div class="match-meta">${i(r(t.starts_at))} · gegen ${i(t.opponent)}</div>
      </a>
      <div class="actions">
        ${l===`live`?`<span class="status-pill live">LIVE</span>`:l===`finished`?`<span class="status-pill">Beendet</span>`:``}
        ${l===`scheduled`?``:`<span class="score">${m} : ${h}</span>`}
        <a class="button ghost" href="${_}">${o.has(t.id)?`Spiel & Bilder`:`Spiel öffnen`}</a>
        ${l===`live`?`<a class="button" href="/live/?match=${encodeURIComponent(t.id)}">Liveticker</a>`:``}
      </div>
    </div>`}async function m(){let e=document.querySelector(`#facility-card`),n=document.querySelector(`#live-center`),a=document.querySelector(`#today-matches`),o=document.querySelector(`#home-news`),s=await c(),l=new Date(new Date);l.setHours(0,0,0,0);let d=new Date(l);d.setDate(d.getDate()+1);let[{data:f},{data:h},{data:g},{data:_},{data:v},{data:y}]=await Promise.all([t.from(`facility_status`).select(`*`).limit(1),t.from(`courts`).select(`*`).eq(`active`,!0).order(`sort_order`),t.from(`match_live_state`).select(`*`).eq(`status`,`live`),t.from(`matches`).select(`*`).gte(`starts_at`,l.toISOString()).lt(`starts_at`,d.toISOString()).order(`starts_at`),t.from(`news`).select(`*`).eq(`status`,`published`).order(`published_at`,{ascending:!1}).limit(4),t.from(`site_settings`).select(`key,value`).in(`key`,[`team_count`,`court_count`])]),b=new Map((y??[]).map(e=>[e.key,e.value])),x=document.querySelector(`#home-team-count`),S=document.querySelector(`#home-court-count`);if(x&&b.has(`team_count`)){let e=String(b.get(`team_count`));x.textContent=x.dataset.countOnly===`true`?e:`${e} Mannschaften`}if(S&&b.has(`court_count`)){let e=String(b.get(`court_count`));S.textContent=S.dataset.countOnly===`true`?e:`${e} Sandplätze`}if(e){let t=f?.[0],n=t?.status===`closed`?`Plätze gesperrt`:t?.status===`limited`?`Teilweise geöffnet`:`Plätze geöffnet`,r=t?.status===`closed`?`closed`:``,a=(h??[]).filter(e=>e.status!==`open`);e.innerHTML=`
      <p class="eyebrow">Anlagenstatus</p>
      <div class="page-head">
        <div><h2>${i(n)}</h2><p class="muted">${i(t?.message??`Aktueller Status der Tennisanlage.`)}</p></div>
        <span class="status-pill ${r}">${t?.status===`open`?`🟢 offen`:t?.status===`closed`?`🔴 gesperrt`:`🟡 eingeschränkt`}</span>
      </div>
      ${a.length?`<p class="muted">${a.map(e=>`${i(e.name)}: ${i(e.status_message||e.status)}`).join(` · `)}</p>`:``}
    `}let C=g??[];if(n&&C.length){let e=(await t.from(`matches`).select(`*`).in(`id`,C.map(e=>e.match_id))).data??[];n.classList.remove(`hidden`),n.innerHTML=`
      <div class="live-badge"><span class="live-dot"></span>Live Center</div>
      <h2>${C.length===1?`Eine Begegnung läuft gerade`:`${C.length} Begegnungen laufen gerade`}</h2>
      <div class="match-list">${e.map(e=>p(e,s,C)).join(``)}</div>
    `}else n&&n.classList.add(`hidden`);a&&(a.innerHTML=_?.length?_.map(e=>p(e,s,g??[])).join(``):`<p class="muted">Heute sind keine Punktspiele eingetragen.</p>`),o&&(o.innerHTML=v?.length?v.map(e=>`
          <div class="news-row">
            <div><strong>${i(e.title)}</strong><div class="match-meta">${e.published_at?i(r(e.published_at)):``}</div></div>
          </div>`).join(``):`<p class="muted">Noch keine aktuellen Beiträge.</p>`),await u(`#home-sponsors`,[`home`]),window.setTimeout(m,3e4)}async function h(){let t=document.querySelector(`#teams-grid`),n=document.querySelector(`#teams-season`),r=document.querySelector(`#teams-category`);if(!t||!n||!r)return;let a=await c(),s=a.seasons.find(e=>e.is_current)??a.seasons[0];n.innerHTML=a.seasons.map(e=>`<option value="${e.id}" ${e.id===s?.id?`selected`:``}>${i(e.name)}</option>`).join(``),r.innerHTML+=a.categories.map(e=>`<option value="${e.id}">${i(e.name)}</option>`).join(``);let l=()=>{let s=n.value,c=r.value,l=a.teamSeasons.filter(e=>e.season_id===s&&e.is_published).map(e=>({ts:e,team:a.teams.find(t=>t.id===e.team_id)})).filter(e=>e.team&&(!c||e.team.category_id===c)).sort((e,t)=>(e.team.sort_order??0)-(t.team.sort_order??0));t.innerHTML=l.length?l.map(({ts:t,team:n})=>`
      <article class="card team-card">
        <img src="${i(e(t.team_image_path||n.image_path)||o(n))}" alt="${i(n.name)}" loading="lazy" />
        <div><p class="eyebrow">${i(t.league||`Mannschaft`)}</p><h3>${i(n.name)}</h3></div>
        <p class="muted">${i([t.league,t.group_name].filter(Boolean).join(` · `))}</p>
        <div class="actions"><a class="button" href="/mannschaften/${i(n.slug)}/">Mannschaft öffnen</a>${t.btv_url?`<a class="button ghost" href="${i(t.btv_url)}" target="_blank" rel="noreferrer">BTV ↗</a>`:``}</div>
      </article>
    `).join(``):`<p class="muted">Für diese Auswahl sind keine Mannschaften hinterlegt.</p>`};n.addEventListener(`change`,l),r.addEventListener(`change`,l),l()}async function g(r){let a=document.querySelector(`[data-team-slug]`);if(!a)return;let d=await c(),f=d.teams.find(e=>e.slug===r);if(!f){a.innerHTML=`<div class="card"><h1>Mannschaft nicht gefunden</h1></div>`;return}let m=d.teamSeasons.filter(e=>e.team_id===f.id&&e.is_published).sort((e,t)=>{let n=d.seasons.find(t=>t.id===e.season_id)?.year??0;return(d.seasons.find(e=>e.id===t.season_id)?.year??0)-n}),h=m.find(e=>d.seasons.find(t=>t.id===e.season_id)?.is_current)??m[0],g=document.querySelector(`#team-header`);g&&(g.innerHTML=`
    <section class="hero">
      <div><p class="eyebrow">Mannschaft</p><h1>${i(f.name)}</h1><p class="hero__lead">${i(f.description||[h?.league,h?.group_name].filter(Boolean).join(` · `)||`TSV Feldkirchen Tennis`)}</p><div class="actions">${h?.btv_url?`<a class="button" href="${i(h.btv_url)}" target="_blank" rel="noreferrer">BTV Spielplan ↗</a>`:``}<a class="button secondary" href="${i(n({team:r}))}">Kalender abonnieren</a></div></div>
      <div class="card"><img src="${i(e(h?.team_image_path||f.image_path)||o(f))}" alt="Mannschaftsfoto ${i(f.name)}" /></div>
    </section>
  `);let _=document.querySelector(`#team-season`);if(_&&(_.innerHTML=m.map(e=>{let t=d.seasons.find(t=>t.id===e.season_id);return`<p><strong>${i(t?.name??``)}</strong><br><span class="muted">${i([e.league,e.group_name].filter(Boolean).join(` · `))}</span></p>`}).join(``)||`<p class="muted">Noch keine Saisoninformationen.</p>`),!h)return;let v=m.map(e=>e.id),[{data:y},{data:b},{data:x},{data:S},{data:C}]=await Promise.all([t.from(`team_players`).select(`*`).eq(`team_season_id`,h.id).eq(`public_visible`,!0).order(`is_captain`,{ascending:!1}).order(`sort_order`),t.from(`matches`).select(`*`).eq(`team_season_id`,h.id).order(`starts_at`),v.length?t.from(`matches`).select(`*`).in(`team_season_id`,v).eq(`is_published`,!0).order(`starts_at`):Promise.resolve({data:[]}),t.from(`news`).select(`*`).eq(`team_id`,f.id).eq(`status`,`published`).order(`published_at`,{ascending:!1}),t.from(`galleries`).select(`*`).eq(`team_id`,f.id).eq(`published`,!0).order(`created_at`,{ascending:!1})]),w=(y??[]).map(e=>e.player_id),T=l(w.length?(await t.from(`players`).select(`*`).in(`id`,w)).data??[]:[]),E=document.querySelector(`#team-roster`);E&&(E.innerHTML=y?.length?`
    <div class="roster-grid">
      ${y.map(t=>{let n=T.get(t.player_id);return n?`<article class="player-card">
          ${n.photo_path?`<img class="player-card__photo" src="${i(e(n.photo_path))}" alt="${i(n.display_name)}" loading="lazy" />`:`<span class="player-card__placeholder" aria-hidden="true">${i(s(n.display_name))}</span>`}
          <div>
            <strong>${i(n.display_name)}</strong>
            ${t.is_captain?`<div class="match-meta">Mannschaftsführung</div>`:``}
          </div>
        </article>`:``}).join(``)}
    </div>`:`<p class="muted">Der öffentliche Kader wird noch gepflegt.</p>`);let D=x??b??[],O=D.length?(await t.from(`match_live_state`).select(`*`).in(`match_id`,D.map(e=>e.id))).data??[]:[],k=document.querySelector(`#team-next-match`);if(k){let e=Date.now(),t=D.find(e=>O.find(t=>t.match_id===e.id)?.status===`live`),n=D.filter(t=>t.is_published!==!1&&new Date(t.starts_at).getTime()>e).sort((e,t)=>new Date(e.starts_at).getTime()-new Date(t.starts_at).getTime())[0],r=t??n;if(r){let t=O.find(e=>e.match_id===r.id)?.status===`live`,n=new Date(r.starts_at),a=new Intl.DateTimeFormat(`de-DE`,{weekday:`long`,day:`2-digit`,month:`long`}).format(n),o=new Intl.DateTimeFormat(`de-DE`,{hour:`2-digit`,minute:`2-digit`}).format(n),s=Math.max(1,Math.ceil((n.getTime()-e)/864e5)),c=t?`Jetzt live`:s===1?`Morgen`:s<=7?`In ${s} Tagen`:`Nächstes Punktspiel`,l=r.is_home?f.name:r.opponent,u=r.is_home?r.opponent:f.name,d=r.venue_name||(r.is_home?`TSV Feldkirchen`:`Auswärts`),p=`/spiel/?match=${encodeURIComponent(r.id)}`;k.classList.remove(`hidden`),k.innerHTML=`
        <article class="next-match-card ${t?`next-match-card--live`:``}">
          <div class="next-match-card__top">
            <div>
              <span class="next-match-card__badge">${t?`● LIVE`:i(c)}</span>
              <p class="eyebrow">${r.is_home?`Heimspiel`:`Auswärtsspiel`}</p>
            </div>
            <div class="next-match-card__date">
              <strong>${i(a)}</strong>
              <span>${i(o)} Uhr</span>
            </div>
          </div>
          <a class="next-match-card__teams" href="${p}">
            <div class="${r.is_home?`is-tsv`:``}"><span>${i(l)}</span></div>
            <strong>VS</strong>
            <div class="${r.is_home?``:`is-tsv`}"><span>${i(u)}</span></div>
          </a>
          <div class="next-match-card__bottom">
            <div>
              <span class="match-meta">Ort</span>
              <strong>${i(d)}</strong>
              ${r.venue_address?`<span class="match-meta">${i(r.venue_address)}</span>`:``}
            </div>
            <div class="actions">
              <a class="button secondary" href="${p}">Spiel öffnen</a>
              ${t?`<a class="button" href="/live/?match=${encodeURIComponent(r.id)}">Liveticker</a>`:``}
            </div>
          </div>
        </article>`}else k.classList.add(`hidden`),k.innerHTML=``}let A=new Set((C??[]).filter(e=>e.match_id).map(e=>e.match_id)),j=document.querySelector(`#team-matches`);j&&(j.innerHTML=b?.length?b.map(e=>p(e,d,O,A)).join(``):`<p class="muted">Noch keine Spiele eingetragen.</p>`);let M=document.querySelector(`#team-news`);M&&(M.innerHTML=S?.length?S.map(e=>`<div class="news-row"><div><strong>${i(e.title)}</strong><p class="muted">${i(e.excerpt||``)}</p></div></div>`).join(``):`<p class="muted">Noch keine Mannschaftsberichte.</p>`);let N=document.querySelector(`#team-gallery`),P=(C??[]).filter(e=>!e.match_id);if(N&&P.length){let n=P.map(e=>e.id),r=(await t.from(`gallery_items`).select(`*`).in(`gallery_id`,n).order(`sort_order`)).data??[];N.classList.add(`gallery-grid`),N.innerHTML=r.slice(0,12).map(t=>`<figure class="gallery-item"><img src="${i(e(t.storage_path))}" alt="${i(t.alt_text||f.name)}" loading="lazy" /><figcaption class="muted">${i(t.caption||``)}</figcaption></figure>`).join(``)}else N&&(N.classList.remove(`gallery-grid`),N.innerHTML=`<p class="muted">Noch keine allgemeinen Mannschaftsbilder veröffentlicht. Bilder einzelner Punktspiele findest du direkt beim jeweiligen Spiel.</p>`);await u(`#team-sponsors`,[`team`],{teamId:f.id})}async function _(n){let a=document.querySelector(`#match-detail-root`),o=document.querySelector(`#match-detail-head`),s=document.querySelector(`#match-detail-score`),l=document.querySelector(`#match-detail-encounters`),f=document.querySelector(`#match-detail-gallery`);if(!a||!o||!s||!l||!f)return;if(!n){o.innerHTML=`<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>`;return}let p=await c(),[{data:m},{data:h},{data:g},{data:_}]=await Promise.all([t.from(`matches`).select(`*`).eq(`id`,n).eq(`is_published`,!0).maybeSingle(),t.from(`match_live_state`).select(`*`).eq(`match_id`,n).maybeSingle(),t.from(`match_encounters`).select(`*`).eq(`match_id`,n).order(`sort_order`).order(`position`),t.from(`galleries`).select(`*`).eq(`match_id`,n).eq(`published`,!0).order(`created_at`,{ascending:!1})]);if(!m){o.innerHTML=`<div class="card"><h1>Spiel nicht gefunden</h1></div>`;return}let{team:v,ts:y,season:b}=d(m,p),x=v?.name??`TSV Feldkirchen`,S=m.is_home?x:m.opponent,C=m.is_home?m.opponent:x,w=h?.status??`scheduled`,T=m.is_home?h?.home_score??0:h?.away_score??0,E=m.is_home?h?.away_score??0:h?.home_score??0,D=r(m.starts_at),O=m.venue_name||(m.is_home?`TSV Feldkirchen`:`Auswärts`);o.innerHTML=`
    <div class="match-detail-hero">
      <div>
        <p class="eyebrow">${i([b?.name,y?.league].filter(Boolean).join(` · `)||`Punktspiel`)}</p>
        <div class="match-detail-titleline"><img src="${i(e(`branding/tennis-logo.png`))}" alt="TSV Feldkirchen Tennis" /><h1>${i(S)} <span>vs.</span> ${i(C)}</h1></div>
        <p class="hero__lead">${i(D)} · ${i(O)}</p>
        <div class="actions">
          <a class="button secondary" href="/mannschaften/${i(v?.slug||``)}/">Zur Mannschaft</a>
          ${w===`live`?`<a class="button" href="/live/?match=${encodeURIComponent(m.id)}">Liveticker öffnen</a>`:``}
          ${m.external_url?`<a class="button ghost" href="${i(m.external_url)}" target="_blank" rel="noreferrer">BTV / Details ↗</a>`:``}
        </div>
      </div>
    </div>`,s.innerHTML=w===`scheduled`?`<div class="match-detail-score"><span class="status-pill">Geplant</span><strong>– : –</strong><span>Spiel noch nicht begonnen</span></div>`:`<div class="match-detail-score"><span class="status-pill ${w===`live`?`live`:``}">${w===`live`?`LIVE`:`Beendet`}</span><strong>${T} : ${E}</strong><span>aus Sicht des TSV</span></div>`;let k=g??[],A=t=>{let n=[t.tsv_player_1_name,t.tsv_player_2_name].filter(Boolean).join(` / `)||`Aufstellung folgt`,r=[t.opponent_slot_1,t.opponent_slot_2].filter(e=>e!=null).map(e=>`Gegner ${e}`).join(` / `)||(t.discipline===`singles`?`Gegner ${t.position}`:`Doppelaufstellung folgt`),a=`
      <div class="match-detail-encounter-side is-tsv">
        <img src="${i(e(`branding/tennis-logo.png`))}" alt="" />
        <div><span>TSV Feldkirchen</span><strong>${i(n)}</strong></div>
      </div>`,o=`
      <div class="match-detail-encounter-side">
        <span class="live-opponent-mark">G</span>
        <div><span>${i(m.opponent)}</span><strong>${i(r)}</strong></div>
      </div>`;return`
      <article class="match-detail-encounter ${t.status===`live`?`is-live`:``}">
        <div class="match-detail-encounter__head">
          <strong>${t.discipline===`singles`?`Einzel`:`Doppel`} ${t.position}</strong>
          <span class="status-pill ${t.status===`live`?`live`:``}">${t.status===`live`?`LIVE`:t.status===`finished`?`Beendet`:`Geplant`}</span>
        </div>
        <div class="match-detail-encounter__matchup">
          ${m.is_home?a:o}
          <div class="match-detail-encounter__result"><span>Ergebnis</span><strong>${i(t.result_text||`–`)}</strong></div>
          ${m.is_home?o:a}
        </div>
      </article>`};if(l.innerHTML=k.length?`
      <div class="page-head"><div><p class="eyebrow">Spieltag</p><h2>Einzel & Doppel</h2></div><span class="status-pill">${m.lineup_format===`4_2`?`4 + 2`:`6 + 3`}</span></div>
      <div class="match-detail-encounter-groups">
        <section><h3>Einzel</h3><div class="match-detail-encounter-list">${k.filter(e=>e.discipline===`singles`).map(A).join(``)}</div></section>
        <section><h3>Doppel</h3><div class="match-detail-encounter-list">${k.filter(e=>e.discipline===`doubles`).map(A).join(``)}</div></section>
      </div>`:`<div class="empty-gallery"><p class="eyebrow">Spieltag</p><h2>Aufstellung folgt</h2><p class="muted">Einzel und Doppel werden vor dem Spieltag eingetragen.</p></div>`,_?.length){let n=_.map(e=>e.id),{data:r}=await t.from(`gallery_items`).select(`*`).in(`gallery_id`,n).order(`sort_order`),a=new Map(_.map(e=>[e.id,e]));f.innerHTML=`
      <div class="page-head">
        <div><p class="eyebrow">Spieltag in Bildern</p><h2>${_.length===1?i(_[0].title):`Galerien zum Punktspiel`}</h2></div>
        <span class="status-pill">${(r??[]).length} Bilder</span>
      </div>
      <div class="gallery-grid">
        ${(r??[]).map(t=>{let n=a.get(t.gallery_id);return`<figure class="gallery-item">
            <img src="${i(e(t.storage_path))}" alt="${i(t.alt_text||n?.title||x)}" loading="lazy" />
            <figcaption class="muted">${i(t.caption||n?.title||``)}</figcaption>
          </figure>`}).join(``)}
      </div>`}else f.innerHTML=`<div class="empty-gallery"><p class="eyebrow">Spieltag in Bildern</p><h2>Noch keine Galerie</h2><p class="muted">Sobald Bilder zu diesem Punktspiel veröffentlicht wurden, erscheinen sie hier.</p></div>`;await u(`#match-detail-sponsor`,[`match`],{teamId:v?.id,matchId:n})}async function v(){let e=document.querySelector(`#calendar-list`),a=document.querySelector(`#calendar-team`),o=document.querySelector(`#calendar-category`),s=document.querySelector(`#calendar-kind`),l=document.querySelector(`#calendar-subscriptions`);if(!e||!a||!o||!s||!l)return;let u=await c();a.innerHTML+=u.teams.map(e=>`<option value="${e.id}" data-slug="${i(e.slug)}">${i(e.name)}</option>`).join(``),o.innerHTML+=u.categories.map(e=>`<option value="${e.id}" data-slug="${i(e.slug)}">${i(e.name)}</option>`).join(``);let[{data:f},{data:m}]=await Promise.all([t.from(`matches`).select(`*`).order(`starts_at`),t.from(`events`).select(`*`).eq(`status`,`published`).order(`starts_at`)]),h=f?.length?(await t.from(`match_live_state`).select(`*`).in(`match_id`,f.map(e=>e.id))).data??[]:[],g=()=>{let t=a.value,c=o.value,g=s.value,_=(f??[]).filter(e=>{let{team:n}=d(e,u);return(!t||n?.id===t)&&(!c||n?.category_id===c)}).map(e=>({at:e.starts_at,html:p(e,u,h)})),v=(m??[]).filter(e=>{if(t&&e.team_id!==t)return!1;if(c&&e.team_id){if(u.teams.find(t=>t.id===e.team_id)?.category_id!==c)return!1}else if(c&&!e.team_id)return!1;return!0}).map(e=>({at:e.starts_at,html:`<div class="match-row"><div><strong>${i(e.title)}</strong><div class="match-meta">${i(r(e.starts_at))} · ${i(e.location_name||`TSV Feldkirchen`)}</div></div><span class="status-pill">Veranstaltung</span></div>`})),y=[...g===`events`?[]:_,...g===`matches`?[]:v].sort((e,t)=>new Date(e.at).getTime()-new Date(t.at).getTime());e.innerHTML=y.length?y.map(e=>e.html).join(``):`<p class="muted">Keine Termine für diese Auswahl.</p>`;let b={};g!==`all`&&(b.type=g);let x=a.selectedOptions[0],S=o.selectedOptions[0];t&&x?.dataset.slug?b.team=x.dataset.slug:c&&S?.dataset.slug&&(b.category=S.dataset.slug),l.innerHTML=`
      <a class="button" href="${i(n(b))}">Auswahl als ICS</a>
      <a class="button secondary" href="${i(n({type:`matches`}))}">Alle Punktspiele</a>
      <a class="button secondary" href="${i(n({type:`events`}))}">Veranstaltungen</a>
    `};[a,o,s].forEach(e=>e.addEventListener(`change`,g)),g()}async function y(){let n=document.querySelector(`#news-list`);if(!n)return;let{data:a}=await t.from(`news`).select(`*`).eq(`status`,`published`).order(`published_at`,{ascending:!1});n.innerHTML=a?.length?a.map(t=>`
    <article class="card">
      ${t.hero_image_path?`<img src="${i(e(t.hero_image_path))}" alt="" loading="lazy" style="border-radius:14px;aspect-ratio:16/9;object-fit:cover;margin-bottom:16px">`:``}
      <p class="eyebrow">${t.published_at?i(r(t.published_at)):`Aktuelles`}</p>
      <h2>${i(t.title)}</h2>
      <p class="muted">${i(t.excerpt||t.body.slice(0,220))}</p>
      <details><summary>Weiterlesen</summary><p style="white-space:pre-wrap">${i(t.body)}</p></details>
    </article>
  `).join(``):`<p class="muted">Noch keine Beiträge veröffentlicht.</p>`}async function b(e){let n=document.querySelector(`#managed-title`),r=document.querySelector(`#managed-page-content`);if(!r)return;let{data:i,error:a}=await t.from(`pages`).select(`*`).eq(`slug`,e).eq(`published`,!0).maybeSingle();if(a||!i){r.innerHTML=`<p class="muted">Der Inhalt wird noch gepflegt.</p>`;return}n&&(n.textContent=i.title),r.textContent=i.body}async function x(){let n=document.querySelector(`#sponsors-grid`);if(!n)return;let{data:r}=await t.from(`sponsors`).select(`*`).eq(`active`,!0).order(`sort_order`);n.innerHTML=r?.length?r.map(t=>`
    <article class="card team-card">
      ${t.logo_path?`<img src="${i(e(t.logo_path))}" alt="Logo ${i(t.name)}" loading="lazy">`:``}
      <h3>${i(t.name)}</h3>
      <p class="muted">${i(t.description||``)}</p>
      ${t.url?`<a class="button ghost" href="${i(t.url)}" target="_blank" rel="noreferrer">Website ↗</a>`:``}
    </article>
  `).join(``):`<p class="muted">Sponsoren werden derzeit eingepflegt.</p>`}async function S(){let n=document.querySelector(`#officials-grid`);if(!n)return;let{data:r}=await t.from(`officials`).select(`*`).eq(`published`,!0).order(`sort_order`);n.innerHTML=r?.length?r.map(t=>`
    <article class="card team-card">
      ${t.photo_path?`<img src="${i(e(t.photo_path))}" alt="${i(t.name)}" loading="lazy">`:``}
      <div><p class="eyebrow">${i(t.title)}</p><h3>${i(t.name)}</h3></div>
      <p class="muted">${t.email?`<a href="mailto:${i(t.email)}">${i(t.email)}</a>`:``}${t.email&&t.phone?`<br>`:``}${t.phone?i(t.phone):``}</p>
    </article>
  `).join(``):`<p class="muted">Funktionäre werden derzeit eingepflegt.</p>`}async function C(n){let a=document.querySelector(`#live-match-head`),o=document.querySelector(`#live-score`),s=document.querySelector(`#live-encounters`),l=document.querySelector(`#live-timeline`);if(!a||!o||!s||!l)return;if(!n){a.innerHTML=`<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>`;return}let f=await c(),p=e(`branding/tennis-logo.png`),m=e=>`
    <div class="live-team live-team--tsv">
      <img src="${i(p)}" alt="TSV Feldkirchen Tennis" />
      <div><span>${i(e)}</span><strong>TSV Feldkirchen</strong></div>
    </div>`,h=(e,t)=>`
    <div class="live-team live-team--opponent">
      <span class="live-opponent-mark">G</span>
      <div><span>${i(e)}</span><strong>${i(t)}</strong></div>
    </div>`,g=(e,t,n)=>{if(n){let e=[t.tsv_player_1_name,t.tsv_player_2_name].filter(Boolean);return`
        <div class="live-encounter-side live-encounter-side--tsv">
          <img src="${i(p)}" alt="" />
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
      </div>`},_=(e,t)=>{let n=g(e,t,!0),r=g(e,t,!1),a=t.status===`live`?`LIVE`:t.status===`finished`?`Beendet`:`Geplant`;return`
      <article class="live-encounter-row ${t.status===`live`?`is-live`:``}">
        <div class="live-encounter-row__head">
          <strong>${t.discipline===`singles`?`Einzel`:`Doppel`} ${t.position}</strong>
          <span class="status-pill ${t.status===`live`?`live`:``}">${a}</span>
        </div>
        <div class="live-encounter-matchup">
          ${e.is_home?n:r}
          <div class="live-encounter-result">
            <span>Ergebnis</span>
            <strong>${i(t.result_text||`–`)}</strong>
          </div>
          ${e.is_home?r:n}
        </div>
      </article>`},v=async()=>{let[{data:e},{data:c},{data:u},{data:p}]=await Promise.all([t.from(`matches`).select(`*`).eq(`id`,n).maybeSingle(),t.from(`match_live_state`).select(`*`).eq(`match_id`,n).maybeSingle(),t.from(`live_ticker_entries`).select(`*`).eq(`match_id`,n).is(`deleted_at`,null).order(`created_at`,{ascending:!1}),t.from(`match_encounters`).select(`*`).eq(`match_id`,n).order(`sort_order`).order(`position`)]);if(!e){a.innerHTML=`<div class="card"><h1>Spiel nicht gefunden</h1></div>`;return}let{team:g}=d(e,f),v=g?.name??`TSV Feldkirchen`,y=e.is_home?v:e.opponent,b=e.is_home?e.opponent:v;a.innerHTML=`
      <p class="eyebrow">Liveticker</p>
      <h1>${i(y)} <span>vs.</span> ${i(b)}</h1>
      <p class="muted">${i(r(e.starts_at))} · ${e.is_home?`Heimspiel`:`Auswärtsspiel`}</p>`;let x=c?.home_score??0,S=c?.away_score??0,C=e.is_home?m(`Heim`):h(`Heim`,e.opponent),w=e.is_home?h(`Auswärts`,e.opponent):m(`Auswärts`);o.innerHTML=`
      <div class="live-score-status">
        <div class="live-badge"><span class="live-dot"></span>${c?.status===`live`?`LIVE`:c?.status===`finished`?`BEENDET`:`SPIELTAG`}</div>
      </div>
      <div class="live-scoreboard">
        ${C}
        <div class="live-scoreboard__score"><strong>${x} : ${S}</strong></div>
        ${w}
      </div>`;let T=p??[],E=T.filter(e=>e.discipline===`singles`),D=T.filter(e=>e.discipline===`doubles`);s.innerHTML=T.length?`
        <section class="live-encounter-group">
          <div class="live-encounter-group__title"><p class="matchday-kicker">Begegnungen</p><h2>Einzel</h2></div>
          <div class="live-encounter-list">${E.map(t=>_(e,t)).join(``)}</div>
        </section>
        <section class="live-encounter-group">
          <div class="live-encounter-group__title"><p class="matchday-kicker">Begegnungen</p><h2>Doppel</h2></div>
          <div class="live-encounter-list">${D.map(t=>_(e,t)).join(``)}</div>
        </section>`:`<div class="live-encounter-empty"><strong>Die Aufstellung wird noch vorbereitet.</strong><p class="muted">Sobald Einzel und Doppel eingetragen sind, erscheinen sie hier.</p></div>`,l.innerHTML=u?.length?u.map(e=>`
          <div class="timeline-row">
            <div><strong>${i(e.message)}</strong><div class="match-meta">${i(r(e.created_at))}</div></div>
            ${e.home_score!=null&&e.away_score!=null?`<span class="score">${e.home_score} : ${e.away_score}</span>`:``}
          </div>`).join(``):`<p class="muted">Noch keine Tickermeldungen.</p>`};await v(),await u(`#live-sponsor`,[`live`,`match`],{matchId:n});let y=[t.channel(`public-match:${n}`).on(`postgres_changes`,{event:`*`,schema:`public`,table:`match_live_state`,filter:`match_id=eq.${n}`},v).on(`postgres_changes`,{event:`*`,schema:`public`,table:`match_encounters`,filter:`match_id=eq.${n}`},v).on(`postgres_changes`,{event:`*`,schema:`public`,table:`live_ticker_entries`,filter:`match_id=eq.${n}`},v).subscribe()];try{let{data:e}=await t.auth.getSession();if(e.session){await t.realtime.setAuth(e.session.access_token);let r=t.channel(`match:${n}:ticker`,{config:{private:!0}}).on(`broadcast`,{event:`INSERT`},v).on(`broadcast`,{event:`UPDATE`},v).on(`broadcast`,{event:`DELETE`},v).subscribe();y.push(r)}}catch{}window.addEventListener(`beforeunload`,()=>{y.forEach(e=>{t.removeChannel(e)})}),window.setInterval(v,3e4)}export{_ as a,x as c,b as i,g as l,m as n,y as o,C as r,S as s,v as t,h as u};