import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.tennis-tsvfeldkirchen.de',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    format: 'directory',
  },
});
