// TEMPORARY diagnostic (public BTV group PDFs only, no database, no secrets).
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {officialGroupPdfUrl} from './btv-withdrawal-source.mjs';
for(const group of [2257673,2257681,2257828]){
  const res=await fetch(officialGroupPdfUrl(group),{headers:{Accept:'application/pdf','User-Agent':'TSV-Feldkirchen-Tennis-OfficialWithdrawalAudit/1.0 (public group table)'}});
  const bytes=Buffer.from(await res.arrayBuffer());
  const dir=mkdtempSync(join(tmpdir(),'d-'));const f=join(dir,'g.pdf');writeFileSync(f,bytes);
  const text=execFileSync('pdftotext',['-layout',f,'-'],{encoding:'utf8'});
  const lines=text.split(/\r?\n/);
  console.log('===== GROUP '+group+' status '+res.status+' lines '+lines.length);
  const tIdx=lines.findIndex(l=>/Tabelle/i.test(l));
  console.log('--- table region');
  for(const l of lines.slice(Math.max(0,tIdx-2),tIdx+18))console.log('| '+l);
  console.log('--- marker lines');
  lines.forEach((l,i)=>{if(/zurück|gesperrt|Feldkirchen|\bz\b/i.test(l))console.log(String(i).padStart(4)+'| '+l);});
  await new Promise(r=>setTimeout(r,1500));
}
