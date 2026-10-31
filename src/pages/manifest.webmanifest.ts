import type { APIRoute } from 'astro';
const base = import.meta.env.BASE_URL;
export const GET: APIRoute = () => new Response(JSON.stringify({
  name: 'TSV Feldkirchen Tennis',
  short_name: 'TSV Tennis',
  description: 'Spieltage, Termine, Mannschaften und Vereinsleben des TSV Feldkirchen Tennis',
  id: base,
  start_url: base,
  scope: base,
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#e30613',
  icons: [
    { src: base + 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: base + 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    { src: base + 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
}), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control':'public, max-age=3600' } });
