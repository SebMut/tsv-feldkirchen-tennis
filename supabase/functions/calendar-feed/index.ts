import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function esc(value: unknown) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function stamp(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function day(value: string) { return value.slice(0, 10).replaceAll("-", ""); }

/** iCalendar content lines must be folded at 75 UTF-8 octets (RFC 5545). */
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = "";
  let length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) {
      result += "\r\n ";
      length = 1;
    }
    result += char;
    length += bytes;
  }
  return result;
}

/** Keep these revision fields stable between polls, but update them when the record changes. */
function sequence(value?: string | null) {
  const seconds = Math.floor(Date.parse(value || "") / 1000);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function block(item: { id:string; title:string; start:string; end?:string|null; location?:string|null; description?:string|null; url?:string|null; allDay?:boolean; updated?:string|null; created?:string|null }) {
  const revision = item.updated || item.created || item.start;
  const lines = ["BEGIN:VEVENT", `UID:${esc(item.id)}@tennis-tsvfeldkirchen.de`,
    `DTSTAMP:${stamp(revision)}`, `LAST-MODIFIED:${stamp(revision)}`,
    `SEQUENCE:${sequence(revision)}`,
    item.allDay ? `DTSTART;VALUE=DATE:${day(item.start)}` : `DTSTART:${stamp(item.start)}`];
  if (item.end) lines.push(item.allDay ? `DTEND;VALUE=DATE:${day(item.end)}` : `DTEND:${stamp(item.end)}`);
  lines.push(`SUMMARY:${esc(item.title)}`);
  if (item.location) lines.push(`LOCATION:${esc(item.location)}`);
  if (item.description) lines.push(`DESCRIPTION:${esc(item.description)}`);
  if (item.url) lines.push(`URL:${esc(item.url)}`);
  lines.push("END:VEVENT");
  return lines.map(fold).join("\r\n");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "all";
  const teamSlug = url.searchParams.get("team");
  const categorySlug = url.searchParams.get("category");

  const { data: matches, error: me } = await db.from("matches")
    .select("id,opponent,is_home,starts_at,ends_at,venue_name,venue_address,external_url,is_published,created_at,updated_at,team_seasons!inner(team_id,teams!inner(name,slug,category_id,team_categories!inner(slug,name)))")
    .eq("is_published", true).order("starts_at");
  if (me) return new Response(me.message, { status: 500 });

  const { data: events, error: ee } = await db.from("events")
    .select("id,title,description,starts_at,ends_at,all_day,location_name,address,external_url,status,team_id,created_at,updated_at")
    .eq("status", "published").order("starts_at");
  if (ee) return new Response(ee.message, { status: 500 });

  const fm = (matches ?? []).filter((m:any) => {
    const team=m.team_seasons?.teams;
    return (!teamSlug || team?.slug===teamSlug) && (!categorySlug || team?.team_categories?.slug===categorySlug);
  });
  const allowedIds=new Set(fm.map((m:any)=>m.team_seasons?.team_id).filter(Boolean));
  const fe=(events ?? []).filter((e:any)=>{
    if (teamSlug || categorySlug) return e.team_id ? allowedIds.has(e.team_id) : false;
    return true;
  });

  const blocks:string[]=[];
  if (type!=="events") for (const m of fm as any[]) {
    const teamName=m.team_seasons?.teams?.name ?? "TSV Feldkirchen";
    blocks.push(block({
      id:`match-${m.id}`,
      title:m.is_home ? `${teamName}: Heimspiel gegen ${m.opponent}` : `${teamName}: Auswärtsspiel gegen ${m.opponent}`,
      start:m.starts_at,end:m.ends_at,updated:m.updated_at,created:m.created_at,
      location:[m.venue_name,m.venue_address].filter(Boolean).join(", "),
      description:m.is_home ? "Heimspiel TSV Feldkirchen" : "Auswärtsspiel TSV Feldkirchen",
      url:m.external_url,
    }));
  }
  if (type!=="matches") for (const e of fe as any[]) blocks.push(block({
    id:`event-${e.id}`,title:e.title,start:e.starts_at,end:e.ends_at,updated:e.updated_at,created:e.created_at,
    location:[e.location_name,e.address].filter(Boolean).join(", "),
    description:e.description,url:e.external_url,allDay:e.all_day,
  }));

  const name=teamSlug ? `TSV Feldkirchen Tennis – ${teamSlug}` : categorySlug ? `TSV Feldkirchen Tennis – ${categorySlug}` : "TSV Feldkirchen Tennis";
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//TSV Feldkirchen Tennis//Kalender//DE","CALSCALE:GREGORIAN",fold(`X-WR-CALNAME:${esc(name)}`),"REFRESH-INTERVAL;VALUE=DURATION:PT1H","X-PUBLISHED-TTL:PT1H",...blocks,"END:VCALENDAR",""].join("\r\n");
  return new Response(ics,{headers:{
    "Content-Type":"text/calendar; charset=utf-8",
    "Content-Disposition":'inline; filename="tsv-feldkirchen-tennis.ics"',
    "Cache-Control":"no-cache, max-age=0, must-revalidate",
    "Access-Control-Allow-Origin":"*",
  }});
});
