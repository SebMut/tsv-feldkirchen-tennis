import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type Slot = {
  venueId: "aschheim" | "sporttraum" | "haar" | "kirchheim";
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
const EVERSPORTS_ORIGIN = "https://www.eversports.de";
const TENNIS = { id: "433", slug: "tennis", name: "Tennis", uuid: "b38729e9-69de-11e8-bdc6-02bd505aa7b2" };
const eversportsVenues = {
  sporttraum: { shortId: "6yi8rm", facilityId: "69336", bookingUrl: EVERSPORTS_ORIGIN + "/widget/w/6yi8rm" },
  haar: { shortId: "hwhk63", facilityId: "24105", bookingUrl: EVERSPORTS_ORIGIN + "/sb/racket-park-tsv-haar" },
} as const;

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

type AschheimReservation = { court?: number | string; date?: string; fromTime?: string; toTime?: string };

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function parseAschheim(html: string, expectedDate: string, reservations: AschheimReservation[]): Slot[] {
  const grouped = new Map<string, Slot>();
  for (const match of html.matchAll(/(<td\s+class="slot[^"]*"[\s\S]*?>)([\s\S]*?)<\/td>/gi)) {
    if (!/slot-label\s+bookable/i.test(match[2]) || !/>\s*Buchen\s*</i.test(match[2])) continue;
    const data = attrs(match[1]);
    if (data["data-date-iso"] !== expectedDate) continue;
    const start = data["data-minor-begin"];
    const end = data["data-minor-end"];
    if (!/^\d{2}:\d{2}$/.test(start || "") || !/^\d{2}:\d{2}$/.test(end || "")) continue;
    const court = data["data-court"];
    const providerDate = data["data-date"];
    const occupied = reservations.some((reservation) =>
      String(reservation.court) === court && reservation.date === providerDate
      && /^\d{2}:\d{2}$/.test(reservation.fromTime || "") && /^\d{2}:\d{2}$/.test(reservation.toTime || "")
      && minutes(reservation.fromTime!) < minutes(end) && minutes(reservation.toTime!) > minutes(start));
    if (occupied) continue;
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

async function fetchAschheim(date: string) {
  const selectedDate = aschheimDate(date);
  const url = ASCHHEIM_URL + "?selectedDate=" + encodeURIComponent(selectedDate);
  const [html, occupancyResponse] = await Promise.all([
    providerHtml(url),
    fetch(url, {
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": url,
      },
      signal: AbortSignal.timeout(12_000),
    }),
  ]);
  if (!occupancyResponse.ok) throw new Error("aschheim_occupancy_" + occupancyResponse.status);
  const occupancy = await occupancyResponse.json();
  return parseAschheim(html, date, Array.isArray(occupancy?.reservations) ? occupancy.reservations : []);
}

function setCookies(response: Response) {
  const values = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function eversportsRequest(path: string, init: RequestInit = {}, cookie = "") {
  return fetch(EVERSPORTS_ORIGIN + path, {
    ...init,
    headers: {
      "Accept": init.method === "POST" ? "text/html, */*; q=0.01" : "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36",
      "Referer": EVERSPORTS_ORIGIN + "/widget/w/" + path,
      "X-Requested-With": "XMLHttpRequest",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
}

function compactTime(value: string) {
  return value.slice(0, 2) + ":" + value.slice(2, 4);
}

function parseEversportsCalendar(
  html: string,
  venueId: "sporttraum" | "haar",
  bookingUrl: string,
  allowedDates: ReadonlySet<string>,
  booked: ReadonlySet<string>,
): Slot[] {
  const slots: Slot[] = [];
  for (const dateMatch of html.matchAll(/<tbody[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>([\s\S]*?)<\/tbody>/gi)) {
    const date = dateMatch[1];
    if (!allowedDates.has(date)) continue;
    for (const courtMatch of dateMatch[2].matchAll(/<tr[^>]*class="[^"]*court[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const courtId = courtMatch[1].match(/<td[^>]*data-court="(\d+)"[^>]*>/i)?.[1];
      const court = courtMatch[1].match(/class="court-name[^"]*"[^>]*>([^<]+)</i)?.[1]?.trim();
      if (!courtId) continue;
      for (const cell of courtMatch[1].matchAll(/<td([^>]*)data-state="free"([^>]*)>([\s\S]*?)<\/td>/gi)) {
        const data = attrs("<td" + cell[1] + ' data-state="free"' + cell[2] + ">");
        const start = data["data-start"], end = data["data-end"];
        if (!/^\d{4}$/.test(start || "") || !/^\d{4}$/.test(end || "")) continue;
        if (booked.has(courtId + "|" + date + "|" + start)) continue;
        const price = data["data-price"];
        slots.push({
          venueId, date, start: compactTime(start), end: compactTime(end),
          ...(court ? { court } : {}),
          ...(price && /^\d+(?:[.,]\d+)?$/.test(price) ? { price: price.replace(".", ",") + " €" } : {}),
          bookingUrl,
        });
      }
    }
  }
  return slots;
}

async function fetchEversports(venueId: "sporttraum" | "haar", dates: string[]) {
  const venue = eversportsVenues[venueId];
  const landing = await eversportsRequest("/widget/w/" + venue.shortId);
  if (!landing.ok) throw new Error("eversports_landing_" + landing.status);
  const cookie = setCookies(landing);
  const form = new URLSearchParams({
    facilityShortId: venue.shortId,
    "sport[id]": TENNIS.id,
    "sport[slug]": TENNIS.slug,
    "sport[name]": TENNIS.name,
    "sport[uuid]": TENNIS.uuid,
    date: dates[0], calendarDays: String(dates.length),
  });
  const calendar = await eversportsRequest("/widget/api/booking/calendar/update", {
    method: "POST", body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
  }, cookie);
  if (!calendar.ok) throw new Error("eversports_calendar_" + calendar.status);
  const html = await calendar.text();
  const courts = [...new Set([...html.matchAll(/<td[^>]*data-court="(\d+)"[^>]*>/gi)].map((match) => match[1]))];
  const query = new URLSearchParams({ facilityId: venue.facilityId, sport: "tennis", startDate: dates[0] });
  courts.forEach((court) => query.append("courts[]", court));
  const occupancy = await eversportsRequest("/widget/api/slot?" + query, {}, cookie);
  if (!occupancy.ok) throw new Error("eversports_slots_" + occupancy.status);
  const payload = await occupancy.json();
  const booked = new Set<string>();
  for (const slot of Array.isArray(payload?.slots) ? payload.slots : []) {
    const court = String(slot.court ?? slot.courtId ?? slot.court_id ?? slot.court?.id ?? "");
    const date = String(slot.date ?? slot.startDate ?? "").slice(0, 10);
    const start = String(slot.start ?? "").replace(":", "").slice(0, 4);
    if (court && date && start) booked.add(court + "|" + date + "|" + start);
  }
  return parseEversportsCalendar(html, venueId, venue.bookingUrl, new Set(dates), booked);
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

function berlinNoonEpoch(date: string) {
  for (let utcHour = 9; utcHour <= 12; utcHour++) {
    const epoch = Math.floor(Date.parse(date + "T" + String(utcHour).padStart(2, "0") + ":00:00Z") / 1000);
    const parts = berlinParts(epoch);
    if (parts.date === date && parts.time === "12:00") return epoch;
  }
  throw new Error("invalid_berlin_date");
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
          const dayEpoch = berlinNoonEpoch(parts.date);
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
    sporttraum: { status: "loading" },
    haar: { status: "loading" },
  };

  const aschheimResults = await Promise.allSettled(dates.map(fetchAschheim));
  const aschheimOk = aschheimResults.filter((result) => result.status === "fulfilled");
  for (const result of aschheimOk) slots.push(...result.value);
  sources.aschheim = aschheimOk.length
    ? { status: "live", ...(aschheimOk.length < dates.length ? { message: "Einzelne Tage nicht abrufbar" } : {}) }
    : { status: "unavailable", message: "Anbieter derzeit nicht erreichbar" };

  const eversportsResults = await Promise.allSettled([
    fetchEversports("sporttraum", dates), fetchEversports("haar", dates),
  ]);
  (["sporttraum", "haar"] as const).forEach((venueId, index) => {
    const result = eversportsResults[index];
    if (result.status === "fulfilled") {
      slots.push(...result.value);
      sources[venueId] = { status: "live" };
    } else sources[venueId] = { status: "unavailable", message: "Live-Kalender beim Anbieter öffnen" };
  });

  try {
    const dayEpoch = berlinNoonEpoch(dates[0]);
    const html = await providerHtml(KIRCHHEIM_URL + "&d=" + dayEpoch);
    slots.push(...parseKirchheim(html, new Set(dates)));
    sources.kirchheim = { status: "live" };
  } catch {
    sources.kirchheim = { status: "unavailable", message: "Anbieter derzeit nicht erreichbar" };
  }

  return json({ checkedAt: new Date().toISOString(), from, to, sources, slots });
});
