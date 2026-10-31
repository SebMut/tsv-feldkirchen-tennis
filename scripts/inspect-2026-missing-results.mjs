// One official BTV TSV Feldkirchen (01012) Sommer 2026 Vereinsspielplan PDF.
// Compare each unresolved DB match, no personal data and no database write.
import {getClubSchedule,normalizedName} from './btv-schedule.mjs';

const missing=[
  ['c0f0c3d0-ac1c-4e16-8627-c33d720b68d5','knaben-15-ii','TS Jahn München II',false,'2026-05-02'],
  ['414ad6aa-55b2-47ed-a120-db6ab1fdce09','bambini-12-ii','TS Jahn München II',false,'2026-05-09'],
  ['e98813ec-5cfd-4bf9-aad5-89fc731e6c02','herren-50-ii','ETC Siegertsbrunn II',false,'2026-05-16'],
  ['83a6f586-126e-47e2-a4aa-69f346f1ced2','herren-40','TC Malgersdorf',false,'2026-06-13'],
  ['30261461-6e38-4835-ad37-06dc9691052a','damen','TC Oberding',false,'2026-06-14'],
  ['12610129-ef1a-4f97-9d3f-40d33b368d94','knaben-15','TC Moosburg',true,'2026-06-19'],
  ['6533cb1a-c344-4f4b-a517-1214db28ffa8','herren-40-ii','VfB Forstinning',true,'2026-07-04'],
  ['9c436c08-e5ec-4b69-95f4-327bbbc484c8','herren-50-ii','SV DJK Taufkirchen',false,'2026-07-04'],
  ['af4a1a76-5b38-4cda-b2ee-054e7cad27ea','knaben-15','TC Unterföhring',true,'2026-07-10'],
  ['0abb5a8e-ebed-4f1e-8bd7-22f8c9a91817','knaben-15-ii','STK Garching',false,'2026-07-10'],
  ['457e71f0-0f65-489d-8fda-02f0b4724a94','bambini-12','TSV Oberpframmern II',false,'2026-07-11'],
  ['94f86a2f-a457-47f8-a87a-4ffc4e4ec966','herren-iii','SV Heimstetten',false,'2026-07-12'],
  ['0b37c20b-391a-4a60-a18c-8ec8fba4db08','herren-iii','Team München',false,'2026-07-19'],
];
const out=await getClubSchedule(2026);
console.log('BTV_SUMMER_2026_SOURCE='+JSON.stringify({url:out.sourceUrl,rows:out.rawRows,fixtures:out.fixtures.length,pages:out.pages,unrecognized:out.unrecognized.length}));
console.log('BTV_SUMMER_2026_ALL='+JSON.stringify(out.fixtures.map(({slug,opponent,isHome,score,date,time,sourcePage})=>({slug,opponent,isHome,score,date,time,sourcePage}))));
for(const [matchId,slug,opponent,home,dbDate] of missing){
 const exact=out.fixtures.filter(x=>x.slug===slug && x.isHome===home &&
   normalizedName(x.opponent)===normalizedName(opponent));
 const sameDay=exact.filter(x=>x.date===dbDate);
 const similar=out.fixtures.filter(x=>x.slug===slug && x.opponent.toLocaleLowerCase('de-DE').includes(opponent.split(' ')[0].toLocaleLowerCase('de-DE'))).slice(0,4);
 console.log('BTV_SUMMER_2026_UNRESOLVED='+JSON.stringify({
  matchId,slug,opponent,home,dbDate,
  exact:exact.map(x=>({date:x.date,time:x.time,opponent:x.opponent,
    home:x.isHome,score:x.score,sourcePage:x.sourcePage,league:x.leagueCode})),
  sameDay:sameDay.length,similar:exact.length?[]:similar.map(x=>({date:x.date,opponent:x.opponent,home:x.isHome,score:x.score}))
 }));
}
