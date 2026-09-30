# Zielarchitektur

## Systeme

- **GitHub**: Quellcode, Versionshistorie und Deployment.
- **Astro**: statisches Frontend.
- **United Domains**: Hosting der erzeugten `dist/`-Dateien.
- **Supabase Postgres**: Teams, Saisons, Spiele, Liveticker, News und Termine.
- **Supabase Auth**: Mannschafts-Nutzer und SuperAdmins.
- **Supabase Storage**: Mannschafts-, Spieler- und Newsbilder.
- **Supabase Realtime**: Liveticker über Broadcast.
- **Courtbooking**: bleibt führend für Platzreservierungen.

## Rollen

- Besucher: lesen veröffentlichte Inhalte und Live-Daten.
- Mannschafts-Nutzer: bearbeiten nur zugeordnete Teams.
- SuperAdmin: verwaltet alles.

## Geplantes Datenmodell

`profiles`, `seasons`, `teams`, `team_memberships`, `players`, `team_players`, `matches`, `live_ticker_entries`, `news`, `events`, `sponsors`, `officials`, `site_settings`.

Die Datenbank wird mit RLS abgesichert. Für den Liveticker wird Supabase Realtime Broadcast vorgesehen.
