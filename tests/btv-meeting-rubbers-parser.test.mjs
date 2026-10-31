import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRubberSnapshot,parseOfficialMeetingText} from '../scripts/btv-meeting-rubbers-parser.mjs';

// Synthetic BTV PDF layout, no actual player names/IDs.
function row(fields){
 const result=Array.from({length:246},()=> ' ');
 for(const [col,value] of fields){
  for(let i=0;i<String(value).length;i++)result[col+i]=String(value)[i];
 }
 return result.join('').trimEnd();
}
const names=['Muster, Max','Beispiel, Erika','Test, Lina','Probe, Theo','Format, Tessa','Spiel, Sam'];
const singles=names.slice(0,4).map((_,i)=>row([
 [3,i+1],[14,i+1],[23,'12345678'],[47,names[i]+' GER (LK20,1)'],
 [89,i+1],[98,'87654321'],[122,'Gast, Greta GER (LK15,4)'],
 [159,i===0?'3:6':'6:2'],[172,i===0?'3:6':'6:3']
]));
const dbl=(pos,a,b,away1,away2,homeWins)=>[
 row([[14,1],[47,a+' GER'],[89,1],[122,away1+' GER']]),
 row([[3,pos],[35,3],[110,3],[159,homeWins?'6:3':'2:6'],[172,homeWins?'6:4':'3:6']]),
 row([[14,2],[47,b+' GER'],[89,2],[122,away2+' GER']])
];
function report(sets){
 return ['Südbayern | Sommer 2026','Gr. 999','TSV Feldkirchen (01012) : TC Beispiel (01001) 4:2',
 'Einzel','Heimmannschaft Gastmannschaft 1. Satz 2. Satz 3. Satz',
 ...sets,'Doppel','Heimmannschaft Gastmannschaft 1. Satz 2. Satz 3. Satz',
 ...dbl(1,names[4],names[5],'Gast, Eva','Gegen, Laura',true),
 ...dbl(2,names[1],names[3],'Gast, Nela','Gegen, Lisa',false),
 'Gesamt 4:2'].join('\n');
}
test('exact 4+2 report preserves each actual player and each actual set',()=>{
 const x=parseOfficialMeetingText(report(singles),{expectedHomePoints:4,expectedAwayPoints:2});
 assert.equal(x.verification_status,'verified',x.errors.join(','));
 assert.equal(x.singles.length,4);
 assert.equal(x.doubles.length,2);
 assert.ok([...x.singles,...x.doubles].every(r=>r.special_status==='played'));
 assert.equal(x.total,6);
 assert.deepEqual(x.singles[0].home_participants,[{name:'Muster, Max'}]);
 assert.equal(x.doubles[0].home_participants.length,2);
 assert.equal(x.doubles[0].away_participants.length,2);
 assert.deepEqual(x.singles[0].set_results,[{home:3,away:6},{home:3,away:6}]);
 assert.deepEqual(x.doubles[1].set_results,[{home:2,away:6},{home:3,away:6}]);
});
test('canonical snapshot ignores database metadata and JSON object key order',()=>{
 const parsed=parseOfficialMeetingText(report(singles),{expectedHomePoints:4,expectedAwayPoints:2});
 const original=[...parsed.singles,...parsed.doubles];
 const stored=[...original].reverse().map(row=>({...row,id:'database-only',
   home_participants:row.home_participants.map(x=>({name:x.name})),
   set_results:row.set_results.map(x=>({away:x.away,home:x.home}))}));
 assert.deepEqual(canonicalRubberSnapshot(stored),canonicalRubberSnapshot(original));
});
test('incomplete report stays partial rather than inventing missing doubles',()=>{
 const t=report(singles).split('\n');
 t.splice(t.indexOf('Doppel')+2,3);
 const x=parseOfficialMeetingText(t.join('\n'),{expectedHomePoints:4,expectedAwayPoints:2});
 assert.equal(x.verification_status,'partial');
 assert.ok(x.errors.includes('RUBBER_COUNT_MISMATCH'));
});
test('team-score conflicts block verification',()=>{
 const x=parseOfficialMeetingText(report(singles),{expectedHomePoints:5,expectedAwayPoints:1});
 assert.equal(x.verification_status,'partial');
 assert.ok(x.errors.includes('RUBBER_WINNERS_DISAGREE_WITH_REPORT'));
});
test('cannot fabricate results from a 2026 fixture PDF',()=>{
 assert.throws(()=>parseOfficialMeetingText('Gr. 999 Tabelle und Spielplan\n1 TSV Feldkirchen 4:2\n',{expectedHomePoints:4,expectedAwayPoints:2}),/REPORT_TEXT_INVALID/);
});


test('explicit BTV w.o. on home participant counts as guest win without fake sets',()=>{
  const line=row([[3,1],[14,1],[23,'12345678'],
    [47,'Muster, Max GER (LK20,1) (w.o.)'],
    [89,1],[98,'87654321'],[122,'Gast, Greta GER (LK15,4)'],
    [159,'0:0'],[172,'0:0'],[184,'0:0']]);
  const data=report([line,...singles.slice(1)]);
  const x=parseOfficialMeetingText(data,{expectedHomePoints:4,expectedAwayPoints:2});
  assert.equal(x.verification_status,'verified',x.errors.join(','));
  assert.equal(x.singles[0].winner_side,'away');
  assert.equal(x.singles[0].special_status,'walkover');
  assert.deepEqual(x.singles[0].set_results,[]);
});
