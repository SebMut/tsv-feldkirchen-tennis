import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401, headers: cors });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await admin.auth.getUser(authHeader.slice(7));
  if (userError || !userData.user) {
    return Response.json({ error: "Ungültige Sitzung." }, { status: 401, headers: cors });
  }

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { head: true, count: "exact" })
    .eq("global_role", "super_admin");

  if (countError) return Response.json({ error: countError.message }, { status: 500, headers: cors });
  if ((count ?? 0) > 0) {
    return Response.json({ error: "Die Ersteinrichtung wurde bereits abgeschlossen." }, { status: 409, headers: cors });
  }

  let body: { display_name?: string } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const displayName = body.display_name?.trim() || userData.user.email?.split("@")[0] || "SuperAdmin";
  const { error } = await admin.from("profiles").upsert({
    id: userData.user.id,
    display_name: displayName,
    email: userData.user.email ?? null,
    global_role: "super_admin",
  });

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  return Response.json({ ok: true, role: "super_admin" }, { headers: cors });
});
