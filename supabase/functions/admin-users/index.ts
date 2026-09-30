import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedRoles = new Set(["user", "super_admin"]);
const allowedTeamRoles = new Set(["manager", "editor", "ticker"]);

function allowedRedirect(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const allowed =
      (url.origin === "https://www.tennis-tsvfeldkirchen.de") ||
      (url.origin === "https://tennis-tsvfeldkirchen.de") ||
      (url.origin === "https://neu.tennis-tsvfeldkirchen.de") ||
      (url.origin === "https://sebmut.github.io" && url.pathname.startsWith("/tsv-feldkirchen-tennis/")) ||
      (url.origin === "http://localhost:4321");
    return allowed ? value : undefined;
  } catch {
    return undefined;
  }
}

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

  const { data: caller, error: callerError } = await admin
    .from("profiles")
    .select("global_role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (callerError || caller?.global_role !== "super_admin") {
    return Response.json({ error: "Nur SuperAdmins dürfen Benutzer verwalten." }, { status: 403, headers: cors });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Ungültige Anfrage." }, { status: 400, headers: cors }); }

  const action = String(body.action ?? "");

  if (action === "list") {
    const [{ data: profiles, error: profileError }, { data: memberships, error: membershipError }, { data: teams, error: teamsError }, authResult] = await Promise.all([
      admin.from("profiles").select("id,display_name,email,global_role,created_at").order("display_name"),
      admin.from("team_memberships").select("id,user_id,team_id,role,active"),
      admin.from("teams").select("id,name,slug"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (profileError) return Response.json({ error: profileError.message }, { status: 500, headers: cors });
    if (membershipError) return Response.json({ error: membershipError.message }, { status: 500, headers: cors });
    if (teamsError) return Response.json({ error: teamsError.message }, { status: 500, headers: cors });
    if (authResult.error) return Response.json({ error: authResult.error.message }, { status: 500, headers: cors });

    const authMap = new Map((authResult.data?.users ?? []).map((user) => [user.id, user]));
    const teamMap = new Map((teams ?? []).map((team) => [team.id, team]));
    const membershipMap = new Map<string, Array<Record<string, unknown>>>();

    for (const membership of memberships ?? []) {
      const list = membershipMap.get(membership.user_id) ?? [];
      list.push({
        id: membership.id,
        team_id: membership.team_id,
        role: membership.role,
        active: membership.active,
        teams: teamMap.get(membership.team_id) ?? null,
      });
      membershipMap.set(membership.user_id, list);
    }

    const users = (profiles ?? []).map((profile) => {
      const authUser = authMap.get(profile.id);
      return {
        ...profile,
        team_memberships: membershipMap.get(profile.id) ?? [],
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        email_confirmed_at: authUser?.email_confirmed_at ?? null,
        invited_at: authUser?.invited_at ?? null,
      };
    });

    return Response.json({ users }, { headers: cors });
  }

  if (action === "invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim();
    const globalRole = allowedRoles.has(String(body.global_role)) ? String(body.global_role) : "user";
    const redirectTo = allowedRedirect(body.redirect_to);

    let memberships: Array<{ team_id: string; role: string }> = [];
    if (globalRole !== "super_admin" && Array.isArray(body.memberships)) {
      memberships = body.memberships
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const raw = item as Record<string, unknown>;
          const teamId = String(raw.team_id ?? "");
          const role = String(raw.role ?? "editor");
          if (!teamId || !allowedTeamRoles.has(role)) return null;
          return { team_id: teamId, role };
        })
        .filter((item): item is { team_id: string; role: string } => item !== null);
    } else if (globalRole !== "super_admin" && Array.isArray(body.team_ids)) {
      const fallbackRole = allowedTeamRoles.has(String(body.team_role)) ? String(body.team_role) : "editor";
      memberships = [...new Set(body.team_ids.map(String).filter(Boolean))].map((teamId) => ({
        team_id: teamId,
        role: fallbackRole,
      }));
    }

    const uniqueMemberships = new Map(memberships.map((membership) => [membership.team_id, membership]));

    if (!email || !email.includes("@")) {
      return Response.json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400, headers: cors });
    }

    const options: { data?: Record<string, unknown>; redirectTo?: string } = {};
    if (displayName) options.data = { display_name: displayName };
    if (redirectTo) options.redirectTo = redirectTo;

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, options);
    if (inviteError || !invited.user) {
      const message = inviteError?.message ?? "Einladung fehlgeschlagen.";
      const normalized = message.toLowerCase();
      if (normalized.includes("rate limit") || normalized.includes("too many")) {
        return Response.json({
          ok: false,
          code: "email_rate_limit",
          error: "Supabase hat das E-Mail-Versandlimit erreicht. Bitte einige Minuten warten und dann erneut versuchen.",
        }, { status: 200, headers: cors });
      }
      if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
        return Response.json({
          ok: false,
          code: "user_exists",
          error: "Für diese E-Mail-Adresse existiert bereits ein Benutzerzugang.",
        }, { status: 200, headers: cors });
      }
      return Response.json({ ok: false, error: message }, { status: 200, headers: cors });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: invited.user.id,
      display_name: displayName || email.split("@")[0],
      email,
      global_role: globalRole,
    });
    if (profileError) return Response.json({ error: profileError.message }, { status: 500, headers: cors });

    if (uniqueMemberships.size && globalRole !== "super_admin") {
      const rows = [...uniqueMemberships.values()].map((membership) => ({
        user_id: invited.user!.id,
        team_id: membership.team_id,
        role: membership.role,
        active: true,
      }));
      const { error } = await admin.from("team_memberships").upsert(rows, { onConflict: "user_id,team_id" });
      if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    }

    return Response.json({ ok: true, user_id: invited.user.id }, { headers: cors });
  }

  if (action === "memberships") {
    const userId = String(body.user_id ?? "");
    if (!userId) return Response.json({ error: "user_id fehlt." }, { status: 400, headers: cors });

    const { data: target } = await admin.from("profiles").select("global_role").eq("id", userId).maybeSingle();
    if (target?.global_role === "super_admin") {
      const { error } = await admin.from("team_memberships").delete().eq("user_id", userId);
      if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
      return Response.json({ ok: true }, { headers: cors });
    }

    let memberships: Array<{ team_id: string; role: string }> = [];
    if (Array.isArray(body.memberships)) {
      memberships = body.memberships
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const raw = item as Record<string, unknown>;
          const teamId = String(raw.team_id ?? "");
          const role = String(raw.role ?? "editor");
          if (!teamId || !allowedTeamRoles.has(role)) return null;
          return { team_id: teamId, role };
        })
        .filter((item): item is { team_id: string; role: string } => item !== null);
    }

    const unique = new Map(memberships.map((membership) => [membership.team_id, membership]));
    const { error: deleteError } = await admin.from("team_memberships").delete().eq("user_id", userId);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500, headers: cors });

    if (unique.size) {
      const rows = [...unique.values()].map((membership) => ({
        user_id: userId,
        team_id: membership.team_id,
        role: membership.role,
        active: true,
      }));
      const { error } = await admin.from("team_memberships").insert(rows);
      if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    }

    return Response.json({ ok: true }, { headers: cors });
  }

  if (action === "send_access_mail") {
    const userId = String(body.user_id ?? "");
    const redirectTo = allowedRedirect(body.redirect_to);
    if (!userId) return Response.json({ error: "user_id fehlt." }, { status: 400, headers: cors });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return Response.json({ error: profileError?.message ?? "E-Mail-Adresse nicht gefunden." }, { status: 404, headers: cors });
    }

    const { error } = await admin.auth.resetPasswordForEmail(profile.email, {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) {
      const message = error.message ?? "Zugangs-Mail konnte nicht gesendet werden.";
      const normalized = message.toLowerCase();
      if (normalized.includes("rate limit") || normalized.includes("too many")) {
        return Response.json({
          ok: false,
          code: "email_rate_limit",
          error: "Supabase hat das E-Mail-Versandlimit erreicht. Bitte einige Minuten warten und dann erneut versuchen.",
        }, { status: 200, headers: cors });
      }
      return Response.json({ ok: false, error: message }, { status: 200, headers: cors });
    }

    return Response.json({ ok: true }, { headers: cors });
  }

  if (action === "set_role") {
    const userId = String(body.user_id ?? "");
    const globalRole = String(body.global_role ?? "");
    if (!userId || !allowedRoles.has(globalRole)) {
      return Response.json({ error: "Ungültige Rolle oder user_id." }, { status: 400, headers: cors });
    }

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("global_role")
      .eq("id", userId)
      .maybeSingle();
    if (targetError || !target) {
      return Response.json({ error: targetError?.message ?? "Benutzer nicht gefunden." }, { status: 404, headers: cors });
    }

    if (target.global_role === "super_admin" && globalRole !== "super_admin") {
      const { count, error: countError } = await admin
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("global_role", "super_admin");
      if (countError) return Response.json({ error: countError.message }, { status: 500, headers: cors });
      if ((count ?? 0) <= 1) {
        return Response.json({ error: "Der letzte SuperAdmin kann nicht herabgestuft werden." }, { status: 409, headers: cors });
      }
    }

    const { error } = await admin.from("profiles").update({ global_role: globalRole }).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });

    if (globalRole === "super_admin") {
      await admin.from("team_memberships").delete().eq("user_id", userId);
    }
    return Response.json({ ok: true }, { headers: cors });
  }

  if (action === "delete") {
    const userId = String(body.user_id ?? "");
    if (!userId) return Response.json({ error: "user_id fehlt." }, { status: 400, headers: cors });
    if (userId === userData.user.id) {
      return Response.json({ error: "Du kannst deinen eigenen SuperAdmin-Zugang hier nicht löschen." }, { status: 409, headers: cors });
    }

    const { data: target, error: targetError } = await admin.from("profiles").select("global_role").eq("id", userId).maybeSingle();
    if (targetError || !target) {
      return Response.json({ error: targetError?.message ?? "Benutzer nicht gefunden." }, { status: 404, headers: cors });
    }
    if (target.global_role === "super_admin") {
      const { count, error: countError } = await admin.from("profiles").select("id", { head: true, count: "exact" }).eq("global_role", "super_admin");
      if (countError) return Response.json({ error: countError.message }, { status: 500, headers: cors });
      if ((count ?? 0) <= 1) {
        return Response.json({ error: "Der letzte SuperAdmin kann nicht gelöscht werden." }, { status: 409, headers: cors });
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    return Response.json({ ok: true }, { headers: cors });
  }

  return Response.json({ error: "Unbekannte Aktion." }, { status: 400, headers: cors });
});
