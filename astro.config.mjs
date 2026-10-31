import { defineConfig } from 'astro/config';

const base = process.env.PREVIEW_BASE?.trim() || '/';

export default defineConfig({
  site: 'https://www.tennis-tsvfeldkirchen.de',
  base,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    format: 'directory',
  },
});
