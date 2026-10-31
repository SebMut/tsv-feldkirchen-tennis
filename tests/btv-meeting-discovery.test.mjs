import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingIdsFromLinks,matchOfficialReport,fiveSearchWays} from '../scripts/btv-meeting-discovery-core.mjs';

test('accepts only explicit official meeting links and deduplicates them',()=>{
 const found=meetingIdsFromLinks([
  'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?dokument=MeetingReportFOP&meeting=12695005',
  'https://btv.liga.nu/x?meeting=12695005',
  'https://evil.example/x?meeting=99999999','javascript:meeting=12345678']);
 assert.deepEqual(found.map(x=>x.meetingId),[12695005]);
 assert.match(found[0].reportUrl,/dokument=MeetingReportFOP&meeting=12695005/);
});

test('matches only one exact opponent, side, date and official score',()=>{
 const base={starts_at:'2026-05-16T07:00:00Z',btv_result_text:'3:3',opponent:'ETC Siegertsbrunn II'};
 const match=matchOfficialReport({title:'ETC Siegertsbrunn II (01234) : TSV Feldkirchen II (01012) 3:3',date:'2026-05-16',score:'3:3'},[
  {id:'right',is_home:false,...base},{id:'wrong-side',is_home:true,...base}]);
 assert.equal(match.id,'right');
 assert.equal(matchOfficialReport({title:'ETC Siegertsbrunn II (01234) : TSV Feldkirchen II (01012) 3:3',date:'2026-05-16',score:'3:3'},[{id:'a',is_home:false,...base},{id:'b',is_home:false,...base}]),null);
});

test('five search ways are distinct and group/season scoped',()=>{
 const ways=fiveSearchWays({groupId:'2155116',seasonId:'18105'});
 assert.equal(ways.length,5);assert.equal(new Set(ways.map(x=>x.way)).size,5);
 assert.match(ways[0].url,/club=23391.*season=18105/);assert.match(ways[1].url,/groupid=2155116/);
 assert.equal(ways[2].url,null);assert.match(ways[4].url,/group=2155116/);
});

