/**
 * Confidential RSVP report, generated locally in the super-admin's browser.
 * Minimal self-contained PDF (A4, selectable text, multiple pages).
 * No data is uploaded to a third party.
 */
export type RsvpPdfRow = {
  member_name:string; member_email?:string|null; attendance:string; updated_at:string;
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
const sorted=(entries:string[])=>entries.slice().sort((a,b)=>nameCompare(a.split(/: | - | \s\(/)[0],b.split(/: | - | \s\(/)[0]));
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
type PdfLogo={width:number;height:number;data:Uint8Array};

/** All CSV/PDF data remain in the browser. No report is sent to a rendering service. */
function rawJpegBytes(data:Uint8Array):string{
  let result='';
  for(let i=0;i<data.length;i+=8192)result+=String.fromCharCode(...data.subarray(i,i+8192));
  return result;
}
function wrap(text:string,maxWidth:number,size:number,bold=false):string[]{
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):null;
  const ctx=canvas?.getContext('2d') || null;
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

export function buildRsvpPdf(event:RsvpPdfEvent,records:RsvpPdfRow[],logo:PdfLogo|null=null):Uint8Array {
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
  // TSV Feldkirchen Tennis brand palette: official red, white and neutral ink.
  const RED='0.890 0.024 0.075';
  const RED_DARK='0.710 0.039 0.088';
  const INK='0.125 0.153 0.145';
  const MUTED='0.35 0.40 0.38';
  const PAPER='0.960 0.965 0.957';
  const WHITE='1 1 1';
  const pages:string[][]=[[]];
  let y=PAGE_H-167;
  const current=()=>pages[pages.length-1];
  const drawText=(x:number,baseline:number,text:string,size=9,bold=false,color=INK)=>{
    current().push(color+' rg BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+
      x.toFixed(2)+' '+baseline.toFixed(2)+' Tm ('+pdfEsc(text)+') Tj ET');
  };
  const fill=(x:number,bottom:number,width:number,height:number,rgb:string)=>{
    current().push(rgb+' rg '+x.toFixed(2)+' '+bottom.toFixed(2)+' '+
      width.toFixed(2)+' '+height.toFixed(2)+' re f');
  };
  const stroke=(x1:number,yy1:number,x2:number,yy2:number,color='0.87 0.88 0.87',size=0.45)=>{
    current().push(color+' RG '+size+' w '+x1.toFixed(2)+' '+yy1.toFixed(2)+' m '+
      x2.toFixed(2)+' '+yy2.toFixed(2)+' l S');
  };
  const circle=(cx:number,cy:number,r:number,rgb:string)=>{
    const k=0.5522847498*r;
    current().push(rgb+' rg '+(cx+r)+' '+cy+' m '+(cx+r)+' '+(cy+k)+' '+(cx+k)+' '+(cy+r)+' '+cx+' '+(cy+r)+
      ' c '+(cx-k)+' '+(cy+r)+' '+(cx-r)+' '+(cy+k)+' '+(cx-r)+' '+cy+
      ' c '+(cx-r)+' '+(cy-k)+' '+(cx-k)+' '+(cy-r)+' '+cx+' '+(cy-r)+
      ' c '+(cx+k)+' '+(cy-r)+' '+(cx+r)+' '+(cy-k)+' '+(cx+r)+' '+cy+' c f');
  };
  const drawBrandMark=()=>{
    const x=LEFT,yBottom=PAGE_H-127,size=94;
    if(logo?.data.length&&logo.width>0&&logo.height>0){
      // The current public Supabase branding logo is embedded only in the
      // downloaded PDF. White background preserves transparent originals.
      fill(x,yBottom,size,size,WHITE);
      const ratio=Math.min((size-4)/logo.width,(size-4)/logo.height);
      const w=logo.width*ratio,h=logo.height*ratio;
      const px=x+(size-w)/2,py=yBottom+(size-h)/2;
      current().push('q '+w.toFixed(2)+' 0 0 '+h.toFixed(2)+' '+
        px.toFixed(2)+' '+py.toFixed(2)+' cm /ClubLogo Do Q');
    }else{
      // Offline fallback mirrors the existing red/yellow TSV tennis app icon.
      fill(x,yBottom,94,94,RED);
      circle(x+47,yBottom+55,27,'0.850 0.941 0.431');
      current().push('1 1 1 RG 2.2 w '+(x+33)+' '+(yBottom+75)+' m '+
        (x+56)+' '+(yBottom+58)+' '+(x+56)+' '+(yBottom+51)+' '+(x+33)+' '+(yBottom+35)+' c S');
      current().push('1 1 1 RG 2.2 w '+(x+61)+' '+(yBottom+75)+' m '+
        (x+38)+' '+(yBottom+58)+' '+(x+38)+' '+(yBottom+51)+' '+(x+61)+' '+(yBottom+35)+' c S');
      fill(x+13,yBottom+8,68,24,WHITE);
      drawText(x+26,yBottom+13,'TSV',17,true,RED);
    }
  };
  const eventWhen=new Date(event.starts_at).toLocaleString('de-DE',{
    dateStyle:'long',timeStyle:'short',timeZone:'Europe/Berlin',
  });
  const exportWhen=new Date().toLocaleString('de-DE',{timeZone:'Europe/Berlin'});
  const drawBrandHeader=()=>{
    fill(0,PAGE_H-9,PAGE_W,9,RED);
    drawBrandMark();
    drawText(153,PAGE_H-47,'TSV FELDKIRCHEN',22,true,INK);
    drawText(154,PAGE_H-65,'TENNIS  /  VEREINSVERANSTALTUNGEN',9,true,RED);
    drawText(154,PAGE_H-87,'ANMELDUNGEN & TEILNEHMER',12.5,true,INK);
    const titles=wrap(event.title,INNER_W-126,11,true).slice(0,2);
    titles.forEach((t,i)=>drawText(154,PAGE_H-105-i*13,t,11,true,RED_DARK));
    drawText(154,PAGE_H-137,'Termin: '+eventWhen+'  |  Stand: '+exportWhen,8.1,false,MUTED);
    fill(LEFT,PAGE_H-149,INNER_W,2,RED);
    y=PAGE_H-167;
  };
  const addPage=()=>{pages.push([]);drawBrandHeader();};
  // First page and all continuations share one consistent club letterhead.
  drawBrandHeader();
  const lineBetween=(x1:number,yy1:number,x2:number,yy2:number)=>{
    stroke(x1,yy1,x2,yy2);
  };
  // Landscape A4: one column for each requested RSVP field.
  // Disabled event options do not appear in the confidential export.
  const columns=[
    {label:'Name',width:162,value:(r:RsvpPdfRow)=>people(r)},
    {label:'Teilnahme',width:74,value:(r:RsvpPdfRow)=>r.attendance==='yes'?'Zusage':r.attendance==='maybe'?'Vielleicht':'Absage'},
    {label:'Erwachsene',width:60,value:(r:RsvpPdfRow)=>r.attendance==='yes'?String(Number(r.adults_count||0)):'-'},
    {label:'Kinder',width:48,value:(r:RsvpPdfRow)=>r.attendance==='yes'?String(Number(r.children_count||0)):'-'},
    ...(config.show_contributions!==false?[
      {label:'Essen / Salat',width:139,value:(r:RsvpPdfRow)=>r.attendance==='yes'?(r.salad_contribution||'-'):'-'},
      {label:'Kuchen / Nachtisch',width:139,value:(r:RsvpPdfRow)=>r.attendance==='yes'?(r.dessert_contribution||'-'):'-'},
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
    fill(LEFT,y-height,INNER_W,height,RED);
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
      if(index%2===0)fill(LEFT,bottom,INNER_W,height,PAPER);
      fill(LEFT,bottom,2.2,height,RED);
      let x=LEFT;
      columns.forEach((col,i)=>{
        cells[i].forEach((part,j)=>drawText(x+5,top-13-j*11.5,part,8.2,false,INK));
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
    const leading=row.size*1.4+3;
    const specialSummary=row.text.startsWith('Bestätigte Rückmeldungen:')||
      row.text.startsWith('Teilnehmende Personen:');
    if(y-row.spaceBefore-(wrapped.length*leading)-(specialSummary?7:0)<BOTTOM)addPage();
    y-=row.spaceBefore;
    if(row.size===14&&row.bold&&row.indent===0){
      fill(LEFT,y-7,4,16,RED);
      wrapped.forEach((value)=>{
        drawText(LEFT+14,y,value,12.5,true,INK);
        y-=19;
      });
      stroke(LEFT,y+10,LEFT+INNER_W,y+10,'0.91 0.92 0.91',0.55);
      y-=3;
      continue;
    }
    if(specialSummary){
      const height=wrapped.length*leading+9;
      fill(LEFT+2,y-height+6,INNER_W-2,height,PAPER);
      fill(LEFT+2,y-height+6,3,height,RED);
      y-=5;
      for(const value of wrapped){drawText(LEFT+12,y,value,10.2,true,INK);y-=leading;}
      y-=4;
      continue;
    }
    for(const value of wrapped){
      if(y<BOTTOM+18)addPage();
      write(value,row.size,row.bold,row.indent);
    }
  }
  const pageCount=pages.length;

  const objects:string[]=[];
  const obj=(text:string)=>{objects.push(text);return objects.length};
  const pagesObj=obj('');
  const fontRegular=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const clubLogo=logo?.data.length&&logo.width>0&&logo.height>0
    ? obj('<< /Type /XObject /Subtype /Image /Width '+logo.width+' /Height '+logo.height+
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+logo.data.length+
      ' >>\nstream\n'+rawJpegBytes(logo.data)+'\nendstream')
    : 0;
  const pageRefs:number[]=[];
  for(let i=0;i<pageCount;i++){
    pages[i].push(RED+' rg 36 46 m 806 46 l S');
    pages[i].push(MUTED+' rg BT /F1 8 Tf 1 0 0 1 36 27 Tm (TSV Feldkirchen Tennis | Vertraulich - nur fuer die Vereinsorganisation) Tj ET');
    pages[i].push(RED+' rg BT /F2 8 Tf 1 0 0 1 750 27 Tm (Seite '+(i+1)+'/'+pageCount+') Tj ET');
    const stream=pages[i].join('\n')+'\n';
    const contents=obj(`<< /Length ${toBytes(stream).length} >>\nstream\n${stream}endstream`);
    const logoResource=clubLogo?' /XObject << /ClubLogo '+clubLogo+' 0 R >>':'';
    const page=obj(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>${logoResource} >> /Contents ${contents} 0 R >>`);
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
  return toBytes(pdf);
}


/** Embed the current TSV club logo from the existing public Supabase media bucket.
 *  The jpeg is only transiently created in browser memory and embedded in the
 *  locally downloaded PDF. Network/CORS failures degrade to the vector mark. */
async function loadClubPdfLogo():Promise<PdfLogo|null>{
  if(typeof document==='undefined'||typeof Image==='undefined')return null;
  try{
    const {mediaUrl}=await import('../lib/supabase');
    return await new Promise<PdfLogo|null>(resolve=>{
      const image=new Image();
      let complete=false;
      const finish=(result:PdfLogo|null)=>{
        if(complete)return;
        complete=true;
        clearTimeout(timeout);
        image.onload=null;
        image.onerror=null;
        resolve(result);
      };
      const timeout=window.setTimeout(()=>finish(null),4500);
      image.crossOrigin='anonymous';
      image.onload=()=>{
        try{
          const max=460,ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
          canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
          const ctx=canvas.getContext('2d');
          if(!ctx){finish(null);return;}
          ctx.fillStyle='#fff';
          ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(image,0,0,canvas.width,canvas.height);
          const jpg=canvas.toDataURL('image/jpeg',0.9).split(',')[1];
          const raw=atob(jpg);
          finish({width:canvas.width,height:canvas.height,data:Uint8Array.from(raw,part=>part.charCodeAt(0))});
        }catch{finish(null);}
      };
      image.onerror=()=>finish(null);
      image.src=mediaUrl('branding/tennis-logo.png');
    });
  }catch{return null;}
}

export async function downloadRsvpPdf(event:RsvpPdfEvent,records:RsvpPdfRow[]):Promise<void> {
  const pdf=buildRsvpPdf(event,records,await loadClubPdfLogo());
  const url=URL.createObjectURL(new Blob([new Uint8Array(pdf)],{type:'application/pdf'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='tsv-feldkirchen-'+(event.slug||'veranstaltung')+'-teilnehmerliste.pdf';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
