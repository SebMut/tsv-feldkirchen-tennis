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
    show_contributions?:boolean;
    show_help?:boolean;
    tournament_youth_enabled?:boolean;
    tournament_women_enabled?:boolean;
    tournament_men_enabled?:boolean;
  }|null;
};

const surnameKey=(name:string)=>{
  const parts=name.trim().replace(/\s+/g,' ').split(' ');
  if(parts.length<2)return name.trim();
  let start=parts.length-1;
  while(start>1 && /^(von|van|vom|zu|zur|de|del|der|den|di|da)$/i.test(parts[start-1]))start--;
  return parts.slice(start).join(' ')+' '+parts.slice(0,start).join(' ');
};
const nameCompare=(a:string,b:string)=>surnameKey(a).localeCompare(surnameKey(b),'de',{sensitivity:'base'})||
  a.localeCompare(b,'de',{sensitivity:'base'});
const sorted=(entries:string[])=>entries.slice().sort(nameCompare);
export const sortRsvpBySurname=(rows:RsvpPdfRow[]):RsvpPdfRow[]=>rows
  .filter(row=>!!String(row.member_name||'').trim()).slice()
  .sort((a,b)=>nameCompare(a.member_name,b.member_name));
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

type Line={text:string;size:number;bold:boolean;indent:number;spaceBefore:number}|{table:true};
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
  const rows=sortRsvpBySurname(records);
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

  section('Teilnehmer alphabetisch nach Nachnamen');
  lines.push({table:true});

  const config=event.rsvp_details||{};
  if(config.show_contributions!==false){
    section('2. Buffet: Salate, Vorspeisen und Nachspeisen');
    items(yes.filter(r=>r.salad_contribution||r.dessert_contribution).map(r=>
      people(r)+': '+[
        r.salad_contribution?'Salat / Vorspeise: '+r.salad_contribution:'',
        r.dessert_contribution?'Kuchen / Nachspeise: '+r.dessert_contribution:'',
      ].filter(Boolean).join('; ')));
  }
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

  if(config.show_help!==false){
  section('6. Helfer');
  items(rows.filter(r=>r.help_setup||r.help_cleanup).map(r=>people(r)+' - '+
    [r.help_setup?'Aufbau / Vorbereitung':'',r.help_cleanup?'Abbau / Aufräumen':''].filter(Boolean).join(' und ')));

  }

  const PAGE_W=842, PAGE_H=595, LEFT=36, INNER_W=PAGE_W-LEFT*2, BOTTOM=54;
  const pages:string[][]=[[]];
  let y=PAGE_H-53;
  const addPage=()=>{pages.push([]);y=PAGE_H-53;};
  const current=()=>pages[pages.length-1];
  const drawText=(x:number,baseline:number,text:string,size=9,bold=false,color='0.13 0.21 0.16')=>{
    current().push(color+' rg BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+
      x.toFixed(2)+' '+baseline.toFixed(2)+' Tm ('+pdfEsc(text)+') Tj ET');
  };
  const fill=(x:number,bottom:number,width:number,height:number,rgb:string)=>{
    current().push(rgb+' rg '+x.toFixed(2)+' '+bottom.toFixed(2)+' '+
      width.toFixed(2)+' '+height.toFixed(2)+' re f');
  };
  const lineBetween=(x1:number,yy1:number,x2:number,yy2:number)=>{
    current().push('0.87 0.89 0.88 RG 0.45 w '+x1.toFixed(2)+' '+yy1.toFixed(2)+' m '+
      x2.toFixed(2)+' '+yy2.toFixed(2)+' l S');
  };
  // Landscape A4: one column for each requested RSVP field.
  // Disabled event options do not appear in the confidential export.
  const columns=[
    {label:'Name',width:162,value:(r:RsvpPdfRow)=>people(r)},
    {label:'Teilnahme',width:74,value:(r:RsvpPdfRow)=>r.attendance==='yes'?'Zusage':r.attendance==='maybe'?'Vielleicht':'Absage'},
    {label:'Erw.',width:48,value:(r:RsvpPdfRow)=>r.attendance==='yes'?String(Number(r.adults_count||0)):'-'},
    {label:'Kinder',width:48,value:(r:RsvpPdfRow)=>r.attendance==='yes'?String(Number(r.children_count||0)):'-'},
    ...(config.show_contributions!==false?[
      {label:'Essen / Salat',width:145,value:(r:RsvpPdfRow)=>r.attendance==='yes'?(r.salad_contribution||'-'):'-'},
      {label:'Kuchen / Nachtisch',width:145,value:(r:RsvpPdfRow)=>r.attendance==='yes'?(r.dessert_contribution||'-'):'-'},
    ]:[]),
    ...(config.show_help!==false?[
      {label:'Aufbau',width:72,value:(r:RsvpPdfRow)=>r.help_setup?'Ja':'-'},
      {label:'Abbau',width:72,value:(r:RsvpPdfRow)=>r.help_cleanup?'Ja':'-'},
    ]:[]),
  ];
  const total=columns.reduce((sum,col)=>sum+col.width,0);
  for(const col of columns)col.width=col.width*INNER_W/total;
  const writeTableHeader=()=>{
    const height=27;
    fill(LEFT,y-height,INNER_W,height,'0.08 0.31 0.22');
    let x=LEFT;
    for(const col of columns){
      const heading=wrap(col.label,col.width-9,8.2,true).slice(0,2);
      heading.forEach((part,i)=>drawText(x+5,y-11-i*10,part,8.2,true,'1 1 1'));
      x+=col.width;
    }
    y-=height;
  };
  const writeTable=()=>{
    if(y<105)addPage();
    writeTableHeader();
    if(!rows.length){
      drawText(LEFT+8,y-20,'Noch keine bestätigten Rückmeldungen.',9);
      y-=36;
      return;
    }
    rows.forEach((r,index)=>{
      const cells=columns.map(col=>wrap(col.value(r),col.width-11,8.2));
      const height=Math.max(27,12+11.5*Math.max(...cells.map(cell=>cell.length)));
      if(y-height<BOTTOM){addPage();writeTableHeader();}
      const top=y,bottom=y-height;
      if(index%2===0)fill(LEFT,bottom,INNER_W,height,'0.95 0.97 0.96');
      let x=LEFT;
      columns.forEach((col,i)=>{
        cells[i].forEach((part,j)=>drawText(x+5,top-13-j*11.5,part,8.2));
        x+=col.width;
        lineBetween(x,top,x,bottom);
      });
      lineBetween(LEFT,bottom,LEFT+INNER_W,bottom);
      y=bottom;
    });
    y-=8;
  };
  const write=(text:string,size:number,bold:boolean,indent:number)=>{
    drawText(LEFT+indent,y,text,size,bold);
    y-=size*1.4+3;
  };
  for(const row of lines){
    if('table' in row){writeTable();continue;}
    const wrapped=wrap(row.text,INNER_W-row.indent-8,row.size,row.bold);
    if(y-row.spaceBefore-(wrapped.length*(row.size*1.4+3))<BOTTOM)addPage();
    y-=row.spaceBefore;
    for(const text of wrapped){
      if(y<BOTTOM+18)addPage();
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
    pages[i].push('0.35 0.40 0.37 rg BT /F1 8 Tf 1 0 0 1 36 27 Tm (TSV Feldkirchen Tennis - vertrauliche Teilnehmerliste) Tj ET');
    pages[i].push('0.35 0.40 0.37 rg BT /F1 8 Tf 1 0 0 1 750 27 Tm (Seite '+(i+1)+'/'+pageCount+') Tj ET');
    const stream=pages[i].join('\n')+'\n';
    const contents=obj(`<< /Length ${toBytes(stream).length} >>\nstream\n${stream}endstream`);
    const page=obj(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contents} 0 R >>`);
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
