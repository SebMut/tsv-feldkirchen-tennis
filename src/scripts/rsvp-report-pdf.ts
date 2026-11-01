/**
 * Confidential RSVP report, generated locally in the super-admin's browser.
 * Minimal self-contained PDF (A4, selectable text, multiple pages).
 * No data is uploaded to a third party.
 */
export type RsvpPdfRow = {
  member_name:string; member_email?:string|null; attendance:string;
  party_size:number; adults_count:number; children_count:number;
  dessert_contribution?:string|null; salad_contribution?:string|null;
  help_setup?:boolean; help_cleanup?:boolean;
  youth_registrations?:{name:string;category:string}[];
  women_registrations?:string[]; men_registrations?:string[];
};
export type RsvpPdfEvent = {
  title:string;slug:string;starts_at:string;
  rsvp_details?:{
    tournament_youth_enabled?:boolean;
    tournament_women_enabled?:boolean;
    tournament_men_enabled?:boolean;
  }|null;
};

const sorted=(entries:string[])=>entries.sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
const label:Record<string,string>={
  'u10-mixed':'U10 gemischt','u12-m':'U12 männlich',
  'u15-m':'U15 männlich','u18-m':'U18 männlich','u18-w':'U18 weiblich',
};

// PDF standard fonts use WinAnsi (not UTF-8). Preserve German umlauts.
const winAnsi=(value:string)=>Array.from(value).map(ch=>{
  if(ch==='\u2013'||ch==='\u2014')return '-';
  if(ch==='\u2018'||ch==='\u2019')return "'";
  if(ch==='\u201c'||ch==='\u201d')return '"';
  if(ch==='\u2022')return '*';
  const n=ch.codePointAt(0)||0;
  return n>=32&&n<=255 ? ch : '?';
}).join('');
const pdfEsc=(text:string)=>winAnsi(text).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const toBytes=(text:string)=>Uint8Array.from(text,c=>c.charCodeAt(0)&255);

type Line={text:string;size:number;bold:boolean;indent:number;spaceBefore:number};
function wrap(text:string,maxWidth:number,size:number,bold=false):string[]{
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  if(ctx)ctx.font=`${bold?'bold ':''}${size}px Helvetica,Arial,sans-serif`;
  const lines:string[]=[];
  let current='';
  for(const word of (text.trim()||'–').split(/\s+/)){
    const combined=current?current+' '+word:word;
    const measure=(part:string)=>ctx?.measureText(part).width??part.length*size*.56;
    if(measure(combined)<=maxWidth){current=combined;continue}
    if(current){lines.push(current);current=''}
    let fragment='';
    for(const char of word) {
      if(measure(fragment+char)>maxWidth && fragment){lines.push(fragment);fragment=''}
      fragment+=char;
    }
    current=fragment;
  }
  if(current)lines.push(current);
  return lines.length?lines:['–'];
}

export function downloadRsvpPdf(event:RsvpPdfEvent,records:RsvpPdfRow[]):void {
  const rows=records.filter(r=>!!r.member_name);
  const yes=rows.filter(r=>r.attendance==='yes');
  const maybe=rows.filter(r=>r.attendance==='maybe');
  const no=rows.filter(r=>r.attendance==='no');
  const adults=yes.reduce((n,r)=>n+Number(r.adults_count||0),0);
  const children=yes.reduce((n,r)=>n+Number(r.children_count||0),0);
  const lines:Line[]=[];
  const line=(text:string,size=10,bold=false,indent=0,spaceBefore=2)=>{
    lines.push({text,size,bold,indent,spaceBefore});
  };
  const section=(text:string)=>{
    line(text,14,true,0,16);
  };
  const items=(list:string[],empty='Keine Einträge')=>{
    (list.length?sorted(list):[empty]).forEach(x=>line(x,10,false,8,5));
  };
  const people=(row:RsvpPdfRow)=>String(row.member_name||'').trim();

  line('TSV Feldkirchen Tennis',17,true,0,0);
  line('Veranstaltungsübersicht: '+event.title,14,true,0,10);
  line('Stand: '+new Date().toLocaleString('de-DE',{timeZone:'Europe/Berlin'}),9,false,0,5);
  line('Veranstaltung: '+new Date(event.starts_at).toLocaleString('de-DE',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Berlin'}),9,false,0,4);

  section('1. Gesamtanzahl');
  line('Bestätigte Rückmeldungen: '+rows.length+'  |  Zusagen: '+yes.length+'  |  Vielleicht: '+maybe.length+'  |  Absagen: '+no.length,11,true,8,5);
  line('Teilnehmende Personen: '+(adults+children)+'  |  Erwachsene: '+adults+'  |  Kinder / Jugendliche: '+children,11,true,8,5);

  section('2. Buffet: Salate, Vorspeisen und Nachspeisen');
  items(yes.filter(r=>r.salad_contribution||r.dessert_contribution).map(r=>
    people(r)+': '+[
      r.salad_contribution?'Salat / Vorspeise: '+r.salad_contribution:'',
      r.dessert_contribution?'Kuchen / Nachspeise: '+r.dessert_contribution:'',
    ].filter(Boolean).join('; ')));

  const config=event.rsvp_details||{};
  if(config.tournament_youth_enabled!==false){
    section('3. Teilnehmer Jugendvereinsmeisterschaft');
    items(rows.flatMap(r=>(Array.isArray(r.youth_registrations)?r.youth_registrations:[])
      .map(entry=>entry.name+' ('+(label[entry.category]||entry.category)+')')));
  }
  if(config.tournament_women_enabled===true){
    section('4. Teilnehmer Damenvereinsmeisterschaft');
    items(rows.flatMap(r=>Array.isArray(r.women_registrations)?r.women_registrations:[]));
  }
  if(config.tournament_men_enabled===true){
    section('5. Teilnehmer Herrenvereinsmeisterschaft');
    items(rows.flatMap(r=>Array.isArray(r.men_registrations)?r.men_registrations:[]));
  }

  section('6. Helfer');
  items(rows.filter(r=>r.help_setup||r.help_cleanup).map(r=>people(r)+' - '+
    [r.help_setup?'Aufbau / Vorbereitung':'',r.help_cleanup?'Abbau / Aufräumen':''].filter(Boolean).join(' und ')));

  section('7. Teilnehmer alphabetisch');
  items(yes.map(r=>people(r)+' - '+Number(r.adults_count||0)+' Erwachsene, '+Number(r.children_count||0)+' Kinder / Jugendliche'));

  const pages:string[][]=[[]];
  let y=755;
  const addPage=()=>{pages.push([]);y=755};
  const write=(text:string,size:number,bold:boolean,indent:number)=>{
    const font=bold?'F2':'F1';
    const yPos=y.toFixed(1);
    pages[pages.length-1].push(`BT /${font} ${size} Tf 0.13 0.21 0.16 rg ${(43+indent).toFixed(1)} ${yPos} Td (${pdfEsc(text)}) Tj ET`);
    y-=size*1.42+3;
  };
  for(const row of lines){
    const wrapped=wrap(row.text,505-row.indent,row.size,row.bold);
    if(y-row.spaceBefore-(wrapped.length*(row.size*1.42+3))<75)addPage();
    y-=row.spaceBefore;
    for(const text of wrapped){
      if(y<65)addPage();
      write(text,row.size,row.bold,row.indent);
    }
  }
  const pageCount=pages.length;

  const objects:string[]=[];
  const obj=(text:string)=>{objects.push(text);return objects.length};
  const pagesObj=obj('');
  const fontRegular=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageRefs:number[]=[];
  for(let i=0;i<pageCount;i++){
    pages[i].push(`BT /F1 8 Tf 0.35 0.40 0.37 rg 43 35 Td (TSV Feldkirchen Tennis - interne Teilnehmerliste) Tj ET`);
    pages[i].push(`BT /F1 8 Tf 0.35 0.40 0.37 rg 505 35 Td (Seite ${i+1}/${pageCount}) Tj ET`);
    const stream=pages[i].join('\n')+'\n';
    const contents=obj(`<< /Length ${toBytes(stream).length} >>\nstream\n${stream}endstream`);
    const page=obj(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contents} 0 R >>`);
    pageRefs.push(page);
  }
  objects[pagesObj-1]=`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(n=>n+' 0 R').join(' ')}] >>`;
  const catalog=obj(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(toBytes(pdf).length);
    pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=toBytes(pdf).length;
  pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${offsets.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const url=URL.createObjectURL(new Blob([toBytes(pdf)],{type:'application/pdf'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='tsv-feldkirchen-'+(event.slug||'veranstaltung')+'-teilnehmerliste.pdf';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
