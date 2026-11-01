import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8');
const image=new URL('../public/images/tsv-feldkirchen-tennisanlage-hero.avif',import.meta.url);

test('actual uploaded TSV photo exists in static assets and homepage hero',()=>{
  const bytes=readFileSync(image);
  assert.equal(bytes.toString('ascii',4,8),'ftyp');
  assert.ok(bytes.includes(Buffer.from('avif','ascii')));
  assert.ok(statSync(image).size>15000);
  assert.match(home,/images\/tsv-feldkirchen-tennisanlage-hero\.avif/);
  assert.match(home,/premium-hero__photo/);
  assert.match(home,/loading="eager" fetchpriority="high"/);
  assert.doesNotMatch(home,/news\/platzaufbau\.png/);
});
test('desktop page fills exactly four fifths of viewport, white gutters on sides',()=>{
  assert.match(css,/body\{background:#fff\}/);
  assert.match(css,/\.site-header,main,\.site-footer\{\s*width:80%/);
  assert.match(css,/@media\(max-width:1023px\)\{\s*\.site-header,main,\.site-footer\{width:100%\}/);
  assert.match(css,/\.container\{\s*width:calc\(100% - 48px\)/);
  assert.match(css,/\.premium-hero__photo\{[\s\S]*?object-fit:cover/);
});

test('welcome and three-day tennis weather share a responsive homepage row',()=>{
  const script=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  assert.match(home, /class="home-intro-grid"/);
  assert.match(home, /class="card home-welcome"/);
  assert.match(home, /class="card home-weather"/);
  const intro=home.indexOf('class="home-intro-grid"');
  const weather=home.indexOf('class="card home-weather"',intro);
  const close=home.indexOf('    </div>',weather);
  assert.ok(intro>=0 && weather>intro && close>weather);
  assert.match(css,/\.home-intro-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:820px\)\{\.premium-content\{gap:22px\}\.home-intro-grid,\.home-columns\{grid-template-columns:1fr;gap:22px\}/);
  assert.match(css,/\.weather-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(script,/forecast_days=3/);
  assert.match(script,/weatherResult\.daily\.time\.slice\(0, 3\)/);
  assert.doesNotMatch(script,/forecast_days=4/);
});

test('homepage cards have consistent spacing between both rows and columns',()=>{
  assert.match(css,/\.premium-content\{display:flex;flex-direction:column;gap:28px;/);
  assert.match(css,/\.home-intro-grid\{[^}]*gap:28px;/);
  assert.match(css,/\.home-columns\{[^}]*gap:28px;/);
  assert.match(css,/\.home-columns\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:28px;align-items:stretch\}/);
  assert.match(home, /class="home-columns home-columns--equal"/);
  assert.match(css, /\.home-columns--equal\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  const firstGrid = css.match(/\.home-intro-grid\{[^}]*grid-template-columns:([^;]+);/);
  const secondGrid = css.match(/\.home-columns\{[^}]*grid-template-columns:([^;]+);/);
  assert.ok(firstGrid && secondGrid);
  assert.equal(secondGrid[1], 'repeat(2,minmax(0,1fr))', 'Aktuelles und Kommende Spiele müssen 50/50 aufgeteilt sein');
  assert.equal(firstGrid[1], secondGrid[1], 'Willkommen/Wetter und Aktuelles/Spiele müssen alle dieselben 50/50-Spalten haben');

  assert.match(css,/@media\(max-width:820px\)\{\.premium-content\{gap:22px\}/);
  assert.match(css,/@media\(max-width:520px\)\{\.premium-content,\.home-intro-grid,\.home-columns\{gap:18px\}/);
});

test('mobile TSV dock offers five icon tabs, accessible more links and login',()=>{
  const header=readFileSync(new URL('../src/components/SiteHeader.astro',import.meta.url),'utf8');
  assert.match(header,/class="mobile-dock"/);
  assert.match(header,/aria-label="Mobile Hauptnavigation"/);
  const dockStart = header.indexOf('<nav class="mobile-dock"');
  const dockEnd = header.indexOf('</nav>', dockStart);
  const dockMarkup = header.slice(dockStart, dockEnd);
  const primaryLabels = Array.from(dockMarkup.matchAll(/<span>(Live-Ticker|Aktuelles|Training|Kalender|Mehr)<\/span>/g), match => match[1]);
  assert.deepEqual(primaryLabels, ['Live-Ticker', 'Aktuelles', 'Training', 'Kalender', 'Mehr']);
  const topLinks = dockMarkup.slice(0, dockMarkup.indexOf('<details class="mobile-dock__more">'));
  const primaryHrefs = Array.from(topLinks.matchAll(/href="([^"]+)"/g), match => match[1]);
  assert.deepEqual(primaryHrefs, ['/spieltag/', '/aktuelles/', '/training/', '/termine/']);
  assert.match(header, /const activeMore = !activePlay && !active\('\/aktuelles\/'\) && !active\('\/training\/'\) && !active\('\/termine\/'\);/);
  for(const href of ['/', '/mannschaften/', '/spieltag/', '/termine/']) {
    assert.ok(header.includes('href="' + href + '"'), 'Missing mobile navigation route ' + href);
  }
  for(const href of ['/aktuelles/', '/training/', '/ueber-uns/', '/mitglied-werden/', '/sponsoren/', '/kontakt/', '/admin/']) {
    assert.ok(header.includes('href="' + href + '"'), 'Missing further menu route ' + href);
  }
  assert.match(header, /class="mobile-dock__more"/);
  assert.match(header, /data-auth-link>Login/);
  assert.match(header, /aria-current=\{activePlay \? 'page' : undefined\}/);
  assert.match(header, /dockMore\.open = false/);
  assert.match(css,/\.mobile-dock\{display:none\}/);
  assert.match(css,/@media\(max-width:980px\)\{[\s\S]*?\.mobile-dock\{[\s\S]*?position:fixed;/);
  assert.match(css,/\.mobile-dock__panel\{/);
  assert.match(css,/\.site-header \.mobile-nav\{display:none\}/);
});

test('small screens have shorter hero, closer card spacing and usable bottom dock space',()=>{
  assert.match(css,/\.premium-hero\{min-height:365px\}/);
  assert.match(css,/\.premium-metrics>div\{padding:12px 8px\}/);
  assert.match(css,/\.premium-content\{padding-top:15px;padding-bottom:24px;gap:13px\}/);
  assert.match(css,/\.home-welcome>p:nth-of-type\(2\)\{display:none\}/);
  assert.match(css,/body\{padding-bottom:calc\(90px \+ env\(safe-area-inset-bottom,0px\)\)\}/);
  assert.match(css,/@media\(max-width:370px\)/);
});

test('Live-Ticker hero logo remains on desktop and is hidden only on mobile',()=>{
  const ticker=readFileSync(new URL('../src/pages/spieltag/index.astro',import.meta.url),'utf8');
  assert.match(ticker,/class="matchday-hero__mark"/);
  assert.match(ticker,/mediaUrl\("branding\/tennis-logo.png"\)/);
  assert.doesNotMatch(ticker,/matchday-hero__grid--single/);
  assert.match(css,/@media\(max-width:760px\)\{\s*\.matchday-page \.matchday-hero__mark\{display:none\}/);
  assert.match(css,/\.matchday-page \.matchday-hero__grid\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('Spieltag "Heute" never falls back to a later match date',()=>{
  const publicScript=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  const spieltag=readFileSync(new URL('../src/pages/spieltag/index.astro',import.meta.url),'utf8');
  const startpage=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
  assert.match(spieltag, /<p class="matchday-kicker">Heute<\/p>/);
  assert.match(spieltag, /id="upcoming-matches"/);
  assert.match(startpage, /id="today-matches"/);
  assert.doesNotMatch(startpage, /id="upcoming-matches"/);
  assert.match(publicScript, /timeZone: 'Europe\/Berlin', year: 'numeric'/);
  assert.match(publicScript, /const todaysFixtures = \(todayResult\.data \?\? \[\]\)\.filter\(m => berlinDayKey\(m\.starts_at\) === currentDayKey\)/);
  assert.match(publicScript, /const focus = today\.length \? today : \(upcomingTarget \? \[\] : next\.slice\(0, 3\)\)/);
  assert.match(publicScript, /!liveIds\.includes\(m\.id\) && \(!upcomingTarget \|\| !todayIds\.has\(m\.id\)\)/);
  assert.match(publicScript, /Heute finden keine Punktspiele statt/);
  assert.match(publicScript, /Heutige Punktspiele/);
  assert.match(publicScript, /const start = new Date\(midnightUtc - 2 \* 3600000\)/);
});

test('every listed team and detail offers tennis.de access without invented portraits',()=>{
  const script=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  assert.ok(script.includes('const TENNIS_DE_CLUB_SEARCH_URL'));
  assert.ok(script.includes('mannschaftssuche.html?verband=btv&verein=01012#teamview/23391'));
  assert.ok(script.includes('function tennisDeTeamDestination'));
  assert.ok(script.includes('href: portrait || TENNIS_DE_CLUB_SEARCH_URL, isDirect: !!portrait'));
  assert.ok(script.includes('function officialTennisDePortraitUrl'));
  assert.ok(script.includes('const tennisDeTarget = tennisDeTeamDestination(ts);'));
  assert.ok(script.includes('const tennisDeTarget = tennisDeTeamDestination(current);'));
  assert.ok(script.includes('tennis.de Portrait ↗'));
  assert.ok(script.includes('tennis.de Team suchen ↗'));
  assert.ok(script.includes('tennis.de Mannschaftsporträt ↗'));
  assert.ok(script.includes('tennis.de Mannschaftssuche ↗'));
});

test('Live-Ticker focuses on encounters and hides the Heute block without actual today fixtures',()=>{
  const page=readFileSync(new URL('../src/pages/spieltag/index.astro',import.meta.url),'utf8');
  const header=readFileSync(new URL('../src/components/SiteHeader.astro',import.meta.url),'utf8');
  const homepage=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
  const script=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  assert.match(page,/title="Live-Ticker \| TSV Feldkirchen Tennis"/);
  assert.match(page,/class="matchday-page matchday-page--ticker"/);
  assert.match(page,/id="live-center"/);
  assert.match(page,/id="today-fixtures-panel" class="matchday-panel matchday-today-panel hidden"/);
  assert.match(page,/id="today-matches"/);
  assert.match(page,/id="upcoming-matches"/);
  assert.match(page,/id="recent-matches"/);
  for (const removed of ['facility-card','home-court-count','home-team-count','home-news','matchday-newsgrid','phase8-install']) {
    assert.ok(!page.includes(removed), 'Unrelated card still present: '+removed);
  }
  assert.match(script,/const todayPanel = document\.querySelector<HTMLElement>\('#today-fixtures-panel'\)/);
  assert.match(script,/todayPanel\.classList\.toggle\('hidden', !!todayResult\.error \|\| !!activeResult\.error \|\| today\.length === 0\)/);
  assert.match(script,/const todaysFixtures = \(todayResult\.data \?\? \[\]\)\.filter\(m => berlinDayKey\(m\.starts_at\) === currentDayKey\)/);
  assert.match(header,/<a href="\/spieltag\/">Live-Ticker<\/a>/);
  assert.match(homepage,/href="\/spieltag\/">Zum Live-Ticker<\/a>/);
  assert.match(homepage,/href="\/spieltag\/">Live-Ticker öffnen →<\/a>/);
  assert.match(css,/\.matchday-page--ticker \.matchday-fixture-grid\{margin:0;gap:18px;align-items:start\}/);
});

test('calendar date opens dismissible modal and retains full day navigation and buttons',()=>{
  const calendar=readFileSync(new URL('../src/pages/termine/index.astro',import.meta.url),'utf8');
  const script=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  assert.ok(calendar.includes('id="calendar-day-modal"'));
  assert.ok(calendar.includes('aria-labelledby="calendar-modal-heading"'));
  assert.ok(calendar.includes('id="calendar-modal-list"'));
  assert.ok(calendar.includes('id="calendar-modal-close"'));
  assert.ok(calendar.includes('id="calendar-modal-dismiss"'));
  assert.ok(calendar.includes('id="calendar-modal-details"'));
  assert.ok(calendar.includes('id="calendar-day-agenda"'));
  assert.ok(calendar.includes('id="calendar-month-board"'));
  assert.ok(calendar.includes('id="calendar-back-to-month"'));
  assert.ok(calendar.includes('id="calendar-day-heading" tabindex="-1"'));
  assert.ok(script.includes("chooseDay(button.dataset.calendarDay, 'modal')"));
  assert.ok(script.includes("chooseDay(dateKey(new Date()), 'modal')"));
  assert.ok(script.includes("chooseDay(key, 'calendar')"));
  assert.ok(script.includes('if (dayModal && !dayModal.open) dayModal.showModal()'));
  assert.ok(script.includes('if (event.target === dayModal) closeDayModal()'));
  assert.ok(script.includes("document.querySelector('#calendar-modal-close')?.addEventListener('click', closeDayModal)"));
  assert.ok(script.includes("document.querySelector('#calendar-modal-dismiss')?.addEventListener('click', closeDayModal)"));
  assert.ok(script.includes("document.querySelector('#calendar-modal-details')?.addEventListener('click'"));
  assert.ok(script.includes('scrollToCalendarElement(agenda)'));
  assert.ok(script.includes('scrollToCalendarElement(monthBoard)'));
  assert.ok(script.includes('modalList.innerHTML = dayList.innerHTML'));
  assert.ok(script.includes("modalList?.addEventListener('click', handleCalendarSave)"));
  assert.ok(script.includes("dayList.addEventListener('click', handleCalendarSave)"));
  assert.ok(script.includes("link.download = 'tsv-termin.ics'"));
  assert.ok(script.includes('href: `/spiel/?match='));
  assert.ok(css.includes('.calendar-day-modal::backdrop'));
  assert.ok(css.includes('body:has(.calendar-day-modal[open])'));
  assert.ok(css.includes('.calendar-back-to-month{display:inline-flex'));
  assert.ok(css.includes('.calendar-board,.calendar-agenda{scroll-margin-top:20px}'));
});


test('long calendar event text is shortened only in the modal and reveals all details with Mehr',()=>{
  const script=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  assert.ok(script.includes('modalList.innerHTML = dayList.innerHTML'));
  assert.ok(script.includes("modalList.querySelectorAll<HTMLElement>('.calendar-event-detail p.muted')"));
  assert.ok(script.includes('if (fullText.length <= 180) return'));
  assert.ok(script.includes("excerpt.classList.add('calendar-event-excerpt')"));
  assert.ok(script.includes("const more = document.createElement('details')"));
  assert.ok(script.includes("more.className = 'calendar-event-more'"));
  assert.ok(script.includes("toggle.textContent = 'Mehr →'"));
  assert.ok(script.includes("toggle.textContent = more.open ? 'Weniger ↑' : 'Mehr →'"));
  assert.ok(script.includes('excerpt.hidden = more.open'));
  assert.ok(script.includes("more.append(description)"));
  assert.ok(script.includes("modalList?.addEventListener('click', handleCalendarSave)"));
  assert.ok(script.includes("dayList.addEventListener('click', handleCalendarSave)"));
  assert.ok(css.includes('.calendar-day-modal .calendar-event-excerpt{'));
  assert.ok(css.includes('-webkit-line-clamp:3'));
  assert.ok(css.includes('.calendar-day-modal .calendar-event-more>summary{'));
});
