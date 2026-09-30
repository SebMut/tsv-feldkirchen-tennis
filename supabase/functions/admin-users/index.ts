import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedRoles = new Set(["user", "super_admin"]);
const allowedTeamRoles = new Set(["manager", "editor", "ticker"]);

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

  const { data: caller } = await admin.from("profiles")
    .select("global_role").eq("id", userData.user.id).maybeSingle();
  if (caller?.global_role !== "super_admin") {
    return Response.json({ error: "Nur SuperAdmins dürfen Benutzer verwalten." }, { status: 403, headers: cors });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400, headers: cors });
  }

  const action = String(body.action ?? "");

  if (action === "list") {
    const { data, error } = await admin.from("profiles")
      .select("id,display_name,email,global_role,created_at,team_memberships(id,team_id,role,active,teams(name,slug))")
      .order("display_name");
    if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    return Response.json({ users: data ?? [] }, { headers: cors });
  }

  if (action === "invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim();
    const globalRole = allowedRoles.has(String(body.global_role)) ? String(body.global_role) : "user";
    const teamRole = allowedTeamRoles.has(String(body.team_role)) ? String(body.team_role) : "editor";
    const teamIds = Array.isArray(body.team_ids) ? body.team_ids.map(String) : [];
    const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : undefined;

    if (!email || !email.includes("@")) {
      return Response.json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400, headers: cors });
    }

    const options: { data?: Record<string, unknown>; redirectTo?: string } = {};
    if (displayName) options.data = { display_name: displayName };
    if (redirectTo && (
      redirectTo.startsWith("https://www.tennis-tsvfeldkirchen.de/") ||
      redirectTo.startsWith("http://localhost:4321/")
    )) options.redirectTo = redirectTo;

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, options);
    if (inviteError || !invited.user) {
      return Response.json({ error: inviteError?.message ?? "Einladung fehlgeschlagen." }, { status: 400, headers: cors });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: invited.user.id,
      display_name: displayName || email.split("@")[0],
      email,
      global_role: globalRole,
    });
    if (profileError) return Response.json({ error: profileError.message }, { status: 500, headers: cors });

    if (teamIds.length) {
      const rows = teamIds.map((teamId) => ({
        user_id: invited.user!.id, team_id: teamId, role: teamRole, active: true,
      }));
      const { error } = await admin.from("team_memberships").upsert(rows, { onConflict: "user_id,team_id" });
      if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    }
    return Response.json({ ok: true, user_id: invited.user.id }, { headers: cors });
  }

  if (action === "memberships") {
    const userId = String(body.user_id ?? "");
    const teamRole = allowedTeamRoles.has(String(body.team_role)) ? String(body.team_role) : "editor";
    const teamIds = Array.isArray(body.team_ids) ? body.team_ids.map(String) : [];
    if (!userId) return Response.json({ error: "user_id fehlt." }, { status: 400, headers: cors });

    const { error: deleteError } = await admin.from("team_memberships").delete().eq("user_id", userId);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500, headers: cors });

    if (teamIds.length) {
      const rows = teamIds.map((teamId) => ({ user_id: userId, team_id: teamId, role: teamRole, active: true }));
      const { error } = await admin.from("team_memberships").insert(rows);
      if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    }
    return Response.json({ ok: true }, { headers: cors });
  }

  if (action === "set_role") {
    const userId = String(body.user_id ?? "");
    const globalRole = String(body.global_role ?? "");
    if (!userId || !allowedRoles.has(globalRole)) {
      return Response.json({ error: "Ungültige Rolle oder user_id." }, { status: 400, headers: cors });
    }
    const { error } = await admin.from("profiles").update({ global_role: globalRole }).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    return Response.json({ ok: true }, { headers: cors });
  }

  return Response.json({ error: "Unbekannte Aktion." }, { status: 400, headers: cors });
});
