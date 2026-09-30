# TSV Feldkirchen Tennis

Neue Website und Vereinsplattform der Tennisabteilung des TSV Feldkirchen.

## Ziel-Stack

- Astro 7
- TypeScript
- Supabase (Postgres, Auth, Storage, Realtime)
- United Domains als statischer Webspace
- Courtbooking weiterhin für Platzreservierungen

## Entwicklung

Voraussetzung: Node.js 22.12.0 oder neuer.

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Das Ergebnis liegt in `dist/` und wird später auf den United-Domains-Webspace übertragen.

## Nächste Schritte

1. neues Supabase-Projekt
2. Datenmodell + RLS
3. Auth und Mannschaftsrechte
4. Mannschaften, Spiele und Liveticker
5. WordPress-Migration


## Designentscheidung

- Öffentliche Website: Konzept **03 – Modern Premium**
- Spieltagszentrale und Liveticker: Konzept **05 – Matchday Dashboard**
