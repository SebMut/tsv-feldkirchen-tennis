import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type Slot = {
  venueId: "aschheim" | "kirchheim";
  date: string;
  start: string;
  end: string;
  court?: string;
  availableCourts?: number;
  price?: string;
  bookingUrl: string;
};

const ASCHHEIM_URL = "https://tcaschheim.ebusy.de/court-module/372";
const KIRCHHEIM_URL = "https://tckirchheim.tennisplatz.info/reservierung?c=2015";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z")));
}

function dateRange(from: string, to: string) {
  const first = new Date(from + "T12:00:00Z");
  const last = new Date(to + "T12:00:00Z");
  const days = Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > 7) throw new Error("invalid_date_range");
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function attrs(tag: string) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

async function providerHtml(url: string) {
  const response = await fetch(url, {
    headers: { "Accept": "text/html", "User-Agent": "TSV-Feldkirchen-Hallenfinder/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("provider_http_" + response.status);
  return response.text();
}

function aschheimDate(date: string) {
  const [year, month, day] = date.split("-");
  return month + "/" + day + "/" + year;
}

function parseAschheim(html: string, expectedDate: string): Slot[] {
  const grouped = new Map<string, Slot>();
  for (const match of html.matchAll(/(<td\s+class="slot[^"]*"[\s\S]*?>)([\s\S]*?)<\/td>/gi)) {
    if (!/slot-label\s+bookable/i.test(match[2])) continue;
    const data = attrs(match[1]);
    if (data["data-date-iso"] !== expectedDate) continue;
    const start = data["data-minor-begin"];
    const end = data["data-minor-end"];
    if (!/^\d{2}:\d{2}$/.test(start || "") || !/^\d{2}:\d{2}$/.test(end || "")) continue;
    const key = expectedDate + "|" + start + "|" + end;
    const existing = grouped.get(key);
    if (existing) existing.availableCourts = (existing.availableCourts || 1) + 1;
    else grouped.set(key, {
      venueId: "aschheim",
      date: expectedDate,
      start,
      end,
      availableCourts: 1,
      bookingUrl: ASCHHEIM_URL + "?selectedDate=" + encodeURIComponent(aschheimDate(expectedDate)),
    });
  }
  return [...grouped.values()];
}

function berlinParts(epochSeconds: number) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(epochSeconds * 1000)).map((part) => [part.type, part.value]));
  return { date: parts.year + "-" + parts.month + "-" + parts.day, time: parts.hour + ":" + parts.minute };
}

function addHours(time: string, hours: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + hours * 60;
  return String(Math.floor(total / 60) % 24).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function parseKirchheim(html: string, allowedDates: ReadonlySet<string>): Slot[] {
  const prices = Object.fromEntries([...html.matchAll(/class="price\s+price(\d+)"[^>]*>\s*(?:&euro;|€)\s*(\d+)/gi)]
    .map((match) => ["price" + match[1], match[2] + " €"]));
  const courtStarts = [...html.matchAll(/<div\s+class="court\s*(?:last)?"\s+data-cid="[^"]+"[^>]*>/gi)];
  const slots: Slot[] = [];
  courtStarts.forEach((courtMatch, courtIndex) => {
    const begin = courtMatch.index! + courtMatch[0].length;
    const end = courtStarts[courtIndex + 1]?.index ?? html.length;
    const courtHtml = html.slice(begin, end);
    for (const match of courtHtml.matchAll(/class="slot\s+av\s+([^"]*)"[^>]*data-begin="(\d+)"[^>]*data-size="(\d+)"/gi)) {
      const epoch = Number(match[2]);
      const duration = Math.max(1, Number(match[3]));
      const parts = berlinParts(epoch);
      if (!allowedDates.has(parts.date)) continue;
      const priceClass = match[1].match(/price\d+/)?.[0];
      const dayEpoch = Math.floor(Date.parse(parts.date + "T12:00:00Z") / 1000);
      slots.push({
        venueId: "kirchheim",
        date: parts.date,
        start: parts.time,
        end: addHours(parts.time, duration),
        court: "Platz " + ((courtIndex % 2) + 7),
        ...(priceClass && prices[priceClass] ? { price: prices[priceClass] } : {}),
        bookingUrl: KIRCHHEIM_URL + "&d=" + dayEpoch,
      });
    }
  });
  return slots;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isIsoDate(from) || !isIsoDate(to)) return json({ error: "invalid_date" }, 400);

  let dates: string[];
  try { dates = dateRange(from, to); }
  catch { return json({ error: "invalid_date_range" }, 400); }

  const slots: Slot[] = [];
  const sources: Record<string, { status: string; message?: string }> = {
    sporttraum: { status: "provider_security", message: "Live-Verfügbarkeit beim Anbieter prüfen" },
    rothof: { status: "provider_security", message: "Live-Verfügbarkeit beim Anbieter prüfen" },
    haar: { status: "provider_security", message: "Live-Verfügbarkeit beim Anbieter prüfen" },
  };

  const aschheimResults = await Promise.allSettled(dates.map(async (date) => {
    const html = await providerHtml(ASCHHEIM_URL + "?selectedDate=" + encodeURIComponent(aschheimDate(date)));
    return parseAschheim(html, date);
  }));
  const aschheimOk = aschheimResults.filter((result) => result.status === "fulfilled");
  for (const result of aschheimOk) slots.push(...result.value);
  sources.aschheim = aschheimOk.length
    ? { status: "live", ...(aschheimOk.length < dates.length ? { message: "Einzelne Tage nicht abrufbar" } : {}) }
    : { status: "unavailable", message: "Anbieter derzeit nicht erreichbar" };

  try {
    const midpoint = dates[Math.floor(dates.length / 2)];
    const dayEpoch = Math.floor(Date.parse(midpoint + "T12:00:00Z") / 1000);
    const html = await providerHtml(KIRCHHEIM_URL + "&d=" + dayEpoch);
    slots.push(...parseKirchheim(html, new Set(dates)));
    sources.kirchheim = { status: "live" };
  } catch {
    sources.kirchheim = { status: "unavailable", message: "Anbieter derzeit nicht erreichbar" };
  }

  return json({ checkedAt: new Date().toISOString(), from, to, sources, slots });
});
