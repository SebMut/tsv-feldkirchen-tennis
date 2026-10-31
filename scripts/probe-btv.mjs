// One-request, read-only BTV accessibility/format probe. Never bypass bot protections.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = 'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?club=23391&dokument=ScheduleReportFOP&season=18105';
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 18000);
let response;
try {
  response = await fetch(url, { headers: { 'User-Agent': 'TSV-Feldkirchen-Tennis-ClubScheduleChecker/1.0 (one daily public schedule request)', 'Accept': 'application/pdf' }, signal: controller.signal });
} catch (e) {
  console.error('BTV SOURCE UNAVAILABLE:', String(e).slice(0,250));
  process.exit(2);
} finally { clearTimeout(timeout); }
console.log('BTV HTTP', response.status, 'content-type', response.headers.get('content-type'), 'bytes', response.headers.get('content-length'));
if (!response.ok) process.exit(response.status === 429 || response.status === 403 ? 3 : 2);
const buffer = Buffer.from(await response.arrayBuffer());
if (buffer.length > 10000000 || buffer.toString('ascii',0,4) !== '%PDF') {
  console.error('BTV unexpected non-PDF response; no import');
  process.exit(2);
}
const dir = mkdtempSync(join(tmpdir(),'tsv-btv-'));
try {
  const file = join(dir,'btv.pdf');
  writeFileSync(file,buffer);
  const text = execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:16000,maxBuffer:1024*1024});
  console.log('PDF VERIFIED:', /TSV Feldkirchen\s*\(01012\)/.test(text), 'year 2026:', /Sommer 2026/.test(text), 'characters',text.length);
  const segments = text.split('Spielplan');
  console.log('PDF SEGMENTS',segments.length);
  for(let i=1;i<Math.min(3,segments.length);i++) console.log('SCHEDULE EXCERPT:',segments[i].split('\n').slice(0,27).join('\n').slice(0,4200));
  const info = execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:10000});
  console.log('PDF PAGE INFO:',info.split('\n').filter(x=>/Pages:|Page size:/.test(x)).join(' | '));
  for (const region of [
    ['page1-right',1,1,600,0,650,1000],
    ['page2-left',2,2,0,0,600,1000],
    ['page2-right',2,2,600,0,650,1000],
  ]) {
    const [label,first,last,x,y,width,height] = region;
    try {
      const section = execFileSync('pdftotext',['-layout','-f',String(first),'-l',String(last),'-x',String(x),'-y',String(y),'-W',String(width),'-H',String(height),file,'-'],{encoding:'utf8',timeout:16000});
      console.log('CROP '+label+' LINES:'+section.split('\n').slice(0,33).join('\n').slice(0,3900));
    } catch(error) { console.log('CROP ERROR '+label+': '+String(error).slice(0,140)); }
  }
  if (!/TSV Feldkirchen\s*\(01012\)/.test(text) || !/Sommer 2026/.test(text)) process.exitCode = 4;
} finally { rmSync(dir,{recursive:true,force:true}); }
