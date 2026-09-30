import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const assets = [
  ["branding/tennis-logo.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/Tennis_Logo.png"],
  ["officials/placeholder.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png"],
  ["sponsors/aen.jpg","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/aen.jpg"],
  ["sponsors/hotelbauer.jpg","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/hotelbauer.jpg"],
  ["sponsors/head.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/head.png"],
  ["sponsors/keil_ktm.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/keil_ktm.png"],
  ["sponsors/landschaftsbau_may.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/landschaftsbau_may.png"],
  ["sponsors/munig.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/munig.png"],
  ["sponsors/omv.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/omv.png"],
  ["sponsors/zehemerbraeu.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/zehemerbraeu.png"],
  ["sponsors/smartwerk_logo.webp","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/smartwerk_logo.webp"],
  ["news/schnuppertag.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/schnuppertag_TSVFeldkirchen.png"],
  ["news/jhv.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/jhv-e1773388201203.png"],
  ["news/platzaufbau.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/platz-aufbau-e1773267028120.png"],
  ["news/kalender.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/kalender_beitrag-e1774133597168.png"],
  ["teams/herren.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/herrenmannschaft.png"],
  ["teams/damen.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/damenmannschaften.png"],
  ["teams/jugend.png","https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/juniorenmannschaften.png"],
] as const;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const results: Array<Record<string, unknown>> = [];
  for (const [path, source] of assets) {
    try {
      const response = await fetch(source, {
        headers: { "user-agent": "TSV-Feldkirchen-Migration/1.0" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("file exceeds 8 MiB");
      const { error } = await supabase.storage.from("media").upload(path, bytes, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      });
      if (error) throw error;
      results.push({ path, ok: true, bytes: bytes.byteLength });
    } catch (error) {
      results.push({ path, ok: false, error: String(error) });
    }
  }

  const failed = results.filter((item) => !item.ok);
  return Response.json({ ok: failed.length === 0, migrated: results.length - failed.length, failed });
});
