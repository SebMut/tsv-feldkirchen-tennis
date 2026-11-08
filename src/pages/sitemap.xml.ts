import type { APIRoute } from 'astro';

const teamSlugs = [
  'herren', 'herren-ii', 'herren-iii', 'herren-40', 'herren-40-ii', 'herren-50', 'herren-50-ii',
  'damen', 'damen-30', 'damen-40', 'damen-50',
  'junioren-18', 'junioren-18-ii', 'knaben-15', 'knaben-15-ii', 'maedchen-15',
  'bambini-12', 'bambini-12-ii', 'bambini-12-iii', 'kleinfeld-u9',
];

const paths = [
  '/', '/aktuelles/', '/termine/', '/spieltag/', '/mannschaften/', '/training/',
  '/mitglied-werden/', '/hallenplaetze/', '/sponsoren/', '/ueber-uns/', '/funktionaere/', '/kontakt/',
  '/live/', '/spieltag/live-ticker/',
  ...teamSlugs.map((slug) => `/mannschaften/${slug}/`),
];

export const GET: APIRoute = () => {
  // Canonical URLs belong to the eventual production domain, even in a
  // noindex preview. The preview is separately blocked via robots.txt.
  const root = 'https://www.tennis-tsvfeldkirchen.de';
  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${root}${path}</loc><lastmod>${lastmod}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
