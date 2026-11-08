import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Server-generated access emails must always return to production, even if
// an admin launches an action from the former preview website.
const PRODUCTION_ADMIN_URL = "https://www.tennis-tsvfeldkirchen.de/admin/";
const allowedRoles = new Set(["user", "super_admin"]);
const allowedTeamRoles = new Set(["manager", "editor", "ticker"]);
const allowedGlobalPermissions = new Set(["events", "news", "ticker", "pyramid"]);
function readGlobalPermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((permission) => typeof permission === "string" && allowedGlobalPermissions.has(permission))) return null;
  return [...new Set(value as string[])];
}

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
    return allowed ? PRODUCTION_ADMIN_URL : undefined;
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
      admin.from("profiles").select("id,display_name,email,global_role,global_permissions,created_at").order("display_name"),
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

  // Read-only, server-authorized permissions audit. Uses the current persisted
  // profile and active memberships (the same inputs used by private.is_super_admin,
  // private.can_edit_team, private.can_tick_team and has_global_permission).
  // Never logs in as the target user, changes a role or executes a write.
  if (action === "audit_permissions") {
    const userId = String(body.user_id ?? "");
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId))
      return Response.json({ error: "Ungültige Benutzerkennung." }, { status: 400, headers: cors });
    const [profileResult, membershipResult, teamResult] = await Promise.all([
      admin.from("profiles").select("id,global_role,global_permissions").eq("id", userId).maybeSingle(),
      admin.from("team_memberships").select("team_id,role,active").eq("user_id", userId),
      admin.from("teams").select("id,name").order("name"),
    ]);
    if (profileResult.error || membershipResult.error || teamResult.error)
      return Response.json({ error: "Die tatsächlichen Berechtigungen konnten nicht gelesen werden." }, { status: 503, headers: cors });
    const profile = profileResult.data;
    if (!profile) return Response.json({ error: "Benutzer nicht gefunden." }, { status: 404, headers: cors });
    const superAdmin = profile.global_role === "super_admin";
    const permissions = new Set<string>(profile.global_permissions ?? []);
    const assigned = new Map((membershipResult.data ?? []).filter(m => m.active).map(m => [m.team_id, m.role]));
    const news = superAdmin || permissions.has("news");
    const events = superAdmin || permissions.has("events");
    const globalTicker = superAdmin || permissions.has("ticker");
    const pyramid = superAdmin || permissions.has("pyramid");
    const teams = (teamResult.data ?? []).map(team => {
      const role = assigned.get(team.id) ?? null;
      const edit = superAdmin || role === "manager" || role === "editor";
      const ticker = globalTicker || role === "manager" || role === "editor" || role === "ticker";
      return { id: team.id, name: team.name, role, team_edit: edit, roster_edit: edit, ticker, news, events };
    });
    return Response.json({ ok: true, user_id: userId, checked_at: new Date().toISOString(),
      source: "supabase_persisted_roles", super_admin: superAdmin,
      globals: { news, events, ticker: globalTicker, pyramid },
      teams }, { headers: cors });
  }

  if (action === "system_health") {
    const [integrity, btv, restore] = await Promise.all([
      admin.rpc("admin_system_integrity"),
      admin.from("btv_import_runs")
        .select("status,started_at,completed_at,season_code,error_message")
        .order("started_at", { ascending: false }).limit(12),
      admin.from("site_settings").select("value,updated_at")
        .eq("key", "ops_restore_check").maybeSingle(),
    ]);
    if (integrity.error || btv.error || restore.error) {
      return Response.json({ error: "Systemüberwachung konnte nicht vollständig gelesen werden.",
        details: [integrity.error?.message,btv.error?.message,restore.error?.message].filter(Boolean).join(" | ") },
        { status: 503, headers: cors });
    }
    const runs = btv.data ?? [];
    return Response.json({ ok: true, supabase_reachable: true, integrity: integrity.data,
      btv_last_run: runs[0] ?? null,
      btv_last_success: runs.find(row => row.status === "success") ?? null,
      btv_failures_recent: runs.filter(row => row.status !== "success").length,
      restore_check: restore.data?.value ?? null,
      restore_check_updated_at: restore.data?.updated_at ?? null,
    }, { headers: cors });
  }

  if (action === "record_restore_check") {
    if (body.confirmed !== true || !["logical_restore","managed_backup_restore"].includes(String(body.method ?? ""))) {
      return Response.json({ error: "Eine ausdrücklich bestätigte Wiederherstellungsprüfung ist erforderlich." },
        { status: 400, headers: cors });
    }
    const notes = String(body.notes ?? "").trim().slice(0,500);
    if (notes.length < 12)
      return Response.json({ error: "Bitte Prüfumgebung und Ergebnis nachvollziehbar dokumentieren (mindestens 12 Zeichen)." },
        { status: 400, headers: cors });
    const value = { checked_at: new Date().toISOString(), checked_by: userData.user.id,
      method: body.method, notes, result: "confirmed_by_admin" };
    const { data, error } = await admin.from("site_settings").upsert(
      { key: "ops_restore_check", value, is_public: false, updated_by: userData.user.id },
      { onConflict: "key" }).select("key,value").single();
    if (error || data?.key !== "ops_restore_check") {
      return Response.json({ error: error?.message ?? "Wiederherstellungsprüfung wurde nicht bestätigt." },
        { status: 503, headers: cors });
    }
    return Response.json({ ok: true, value: data.value }, { headers: cors });
  }

  if (action === "invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim();
    const globalRole = allowedRoles.has(String(body.global_role)) ? String(body.global_role) : "user";
    const globalPermissions = globalRole === "super_admin" ? [] : readGlobalPermissions(body.global_permissions ?? []);
    if (!globalPermissions) return Response.json({ error: "Ungültige globale Berechtigungen." }, { status: 400, headers: cors });
    const redirectTo = allowedRedirect(body.redirect_to) ?? PRODUCTION_ADMIN_URL;

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

    if (Array.isArray(body.memberships) && memberships.length !== body.memberships.length) {
      return Response.json({ ok: false, error: "Mindestens eine Mannschaftsrolle ist ungültig. Keine E-Mail wurde versendet." }, { status: 200, headers: cors });
    }
    if (uniqueMemberships.size !== memberships.length) {
      return Response.json({ ok: false, error: "Mannschaften dürfen nur einmal zugeordnet werden. Keine E-Mail wurde versendet." }, { status: 200, headers: cors });
    }
    // Validate all requested team IDs before creating an Auth user or sending mail.
    if (uniqueMemberships.size) {
      const { data: validTeams, error: teamsError } = await admin.from("teams")
        .select("id").in("id", [...uniqueMemberships.keys()]);
      if (teamsError || (validTeams ?? []).length !== uniqueMemberships.size) {
        return Response.json({
          ok: false,
          error: "Mindestens eine gewählte Mannschaft konnte nicht bestätigt werden. Es wurde keine E-Mail verschickt.",
        }, { status: 200, headers: cors });
      }
    }

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
      if (normalized.includes("535") || normalized.includes("badcredentials") || normalized.includes("username and password not accepted")) {
        return Response.json({
          ok: false,
          code: "smtp_bad_credentials",
          error: "SMTP-Anmeldung fehlgeschlagen. Bitte SMTP-Benutzername, Passwort bzw. App-Passwort und den verwendeten Mailanbieter prüfen.",
        }, { status: 200, headers: cors });
      }
      if (normalized.includes("context deadline exceeded") || normalized.includes("request_timeout") || normalized.includes("timeout")) {
        return Response.json({
          ok: false,
          code: "smtp_timeout",
          error: "Der SMTP-Server hat nicht rechtzeitig geantwortet. Bitte Host, Port, Verschlüsselung und Authentifizierungsart des Mailanbieters prüfen.",
        }, { status: 200, headers: cors });
      }
      if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
        return Response.json({
          ok: false,
          code: "user_exists",
          error: "Für diese E-Mail-Adresse existiert bereits ein Benutzerzugang. Bitte Benutzerliste öffnen und dort Berechtigungen prüfen – nicht erneut einladen.",
        }, { status: 200, headers: cors });
      }
      return Response.json({ ok: false, error: message }, { status: 200, headers: cors });
    }

    const invitePartiallyCreated = (stage: string, code?: string) => {
      // No personal data or e-mail addresses in function logs.
      console.error("admin-users invitation permissions failed", { stage, code: code ?? "unknown" });
      return Response.json({
        ok: false,
        code: "invitation_partially_created",
        user_id: invited.user.id,
        error: "Die Einladungs-E-Mail wurde versendet, aber die Rechte konnten nicht vollständig gespeichert werden. Bitte diesen Benutzer in der Benutzerliste öffnen und die Rechte dort speichern. Nicht erneut einladen.",
      }, { headers: cors });
    };

    // Auth already created the user and sent an email. Only profile metadata
    // is updated separately; all roles and memberships use the EXISTING atomic RPC.
    const { error: profileError } = await admin.from("profiles").upsert({
      id: invited.user.id,
      display_name: displayName || email.split("@")[0],
      email,
    });
    if (profileError) return invitePartiallyCreated("profile", profileError.code);

    const { error: permissionsError } = await admin.rpc("admin_apply_user_permissions", {
      target_user: invited.user.id,
      desired_role: globalRole,
      desired_permissions: globalPermissions,
      desired_memberships: [...uniqueMemberships.values()],
    });
    if (permissionsError) return invitePartiallyCreated("permissions", permissionsError.code);

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
    const redirectTo = allowedRedirect(body.redirect_to) ?? PRODUCTION_ADMIN_URL;
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

  if (action === "save_permissions") {
    const userId = String(body.user_id ?? "");
    const globalRole = String(body.global_role ?? "");
    const permissions = readGlobalPermissions(body.global_permissions);
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !allowedRoles.has(globalRole) || !permissions) {
      return Response.json({ error: "Ungültige Benutzerkennung oder globale Berechtigung." }, { status: 400, headers: cors });
    }
    if (!Array.isArray(body.memberships)) {
      return Response.json({ error: "Mannschaftsrollen fehlen." }, { status: 400, headers: cors });
    }
    const rawMemberships = body.memberships;
    const memberships: Array<{team_id:string;role:string}> = [];
    for (const item of rawMemberships) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return Response.json({error:"Ungültige Mannschaftszuordnung."},{status:400,headers:cors});
      }
      const raw = item as Record<string,unknown>;
      const teamId = String(raw.team_id ?? "");
      const role = String(raw.role ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(teamId) || !allowedTeamRoles.has(role)) {
        return Response.json({error:"Ungültige Mannschaft oder Rolle."},{status:400,headers:cors});
      }
      memberships.push({team_id:teamId,role});
    }
    if (memberships.length !== new Set(memberships.map(m => m.team_id)).size ||
        (globalRole === "super_admin" && (memberships.length > 0 || permissions.length > 0))) {
      return Response.json({error:"Doppelte oder widersprüchliche Berechtigungen."},{status:400,headers:cors});
    }
    const {error} = await admin.rpc("admin_apply_user_permissions", {
      target_user:userId,
      desired_role:globalRole,
      desired_permissions:permissions,
      desired_memberships:memberships,
    });
    if (error) return Response.json({error:"Benutzerrechte konnten nicht gespeichert werden: "+error.message},{status:409,headers:cors});

    // Verify the committed database state before displaying success.
    const [profileResult, membershipResult] = await Promise.all([
      admin.from("profiles").select("global_role,global_permissions").eq("id",userId).single(),
      admin.from("team_memberships").select("team_id,role,active").eq("user_id",userId),
    ]);
    if (profileResult.error || membershipResult.error || !profileResult.data) {
      return Response.json({
        ok:false,verified:false,
        error:"Die Rechte wurden geschrieben, konnten aber nicht nachgeprüft werden. Bitte die Benutzerverwaltung aktualisieren.",
      },{status:503,headers:cors});
    }
    const saved = profileResult.data;
    const wantedMemberships = globalRole === "super_admin" ? [] : memberships;
    const normalize = (items: Array<{team_id:string;role:string}>) =>
      items.map(m => m.team_id + ":" + m.role).sort().join("|");
    const actualMembers = membershipResult.data ?? [];
    const matched = saved.global_role === globalRole
      && [...(saved.global_permissions ?? [])].sort().join("|") === [...permissions].sort().join("|")
      && actualMembers.every(m => m.active === true)
      && normalize(actualMembers) === normalize(wantedMemberships);
    if (!matched) {
      return Response.json({
        ok:false,verified:false,
        error:"Die gespeicherten Rechte stimmen nicht mit der Auswahl überein. Bitte neu laden und erneut prüfen.",
      },{status:409,headers:cors});
    }
    return Response.json({ok:true,verified:true},{headers:cors});
  }

  if (action === "set_role") {
    const userId = String(body.user_id ?? "");
    const globalRole = String(body.global_role ?? "");
    const permissionsIncluded = Object.prototype.hasOwnProperty.call(body, "global_permissions");
    const requestedPermissions = globalRole === "super_admin" ? [] : permissionsIncluded ? readGlobalPermissions(body.global_permissions) : undefined;
    if (requestedPermissions === null) return Response.json({ error: "Ungültige globale Berechtigungen." }, { status: 400, headers: cors });
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

    const patch = { global_role: globalRole, ...(requestedPermissions !== undefined ? { global_permissions: requestedPermissions } : {}) };
    const { error } = await admin.from("profiles").update(patch).eq("id", userId);
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
