import type { APIRoute } from 'astro';
import { renderIconPng } from '../lib/app-icon';
export const GET: APIRoute = () => new Response(new Uint8Array(renderIconPng(192)), {
  headers: { 'Content-Type':'image/png', 'Cache-Control':'public, max-age=86400' },
});
