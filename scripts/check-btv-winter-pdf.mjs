// Verify public BTV winter 2026/27 competition PDF endpoints from OFFICIAL group ids.
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const groups=[2257673,2257681,2257828];
const d=mkdtempSync(join(tmpdir(),'btv-winter-pdf-'));
try{
 for(const group of groups){
   const url=new URL('https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument');
   url.searchParams.set('dokument','ScheduleReportFOP');
   url.searchParams.set('group',String(group));
   const response=await fetch(url,{headers:{Accept:'application/pdf','User-Agent':'TSV Feldkirchen Tennis verified winter group PDF checker'},signal:AbortSignal.timeout(20000)});
   const bytes=Buffer.from(await response.arrayBuffer());
   console.log('PDF_META',JSON.stringify({group,status:response.status,contentType:response.headers.get('content-type'),length:bytes.length,isPdf:bytes.toString('ascii',0,4)==='%PDF'}));
   if(!response.ok || bytes.toString('ascii',0,4)!=='%PDF')continue;
   const file=join(d,group+'.pdf');writeFileSync(file,bytes);
   const txt=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:16000,maxBuffer:2e6});

   const metadata=execFileSync('pdfinfo',[file],{encoding:'utf8'});
   const dimensions=metadata.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m);
   if(!dimensions)throw Error('No expected PDF size for group '+group);
   const width=Number(dimensions[1]),height=Number(dimensions[2]);
   const left=execFileSync('pdftotext',['-layout','-f','1','-l','1','-x','0','-y','0','-W',String(Math.floor(width/2)),'-H',String(Math.ceil(height)),file,'-'],{encoding:'utf8'});
   const right=execFileSync('pdftotext',['-layout','-f','1','-l','1','-x',String(Math.floor(width/2)),'-y','0','-W',String(Math.ceil(width/2)),'-H',String(Math.ceil(height)),file,'-'],{encoding:'utf8'});
   console.log('PDF_TWO_COLUMNS',JSON.stringify({group,width,height,left:left.slice(0,3500),right:right.slice(0,11500)}));

   const lines=txt.split('\n');
   const rows=[];
   for(let i=0;i<lines.length;i++) if(/TSV Feldkirchen|Winter 2026\/2027|Gr\. 0(18|20)|Gr\. 166/.test(lines[i]))rows.push(lines.slice(Math.max(0,i-2),Math.min(i+3,lines.length)).join('  ').slice(0,420));
   console.log('WINTER_PDF_TEXT',JSON.stringify({group,header:txt.slice(0,1300),matches:rows.slice(0,34),pages:execFileSync('pdfinfo',[file],{encoding:'utf8'}).match(/^Pages:\s+\d+/m)?.[0]}).slice(0,14000));
 }
}finally{rmSync(d,{recursive:true,force:true})}
