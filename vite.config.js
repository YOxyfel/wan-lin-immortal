import { resolve } from 'node:path';
import { cpSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';

// Keep relative URLs compatible with both local preview and GitHub Pages.
export default defineConfig({
  base: './',
  appType: 'mpa',
  server: { port: 8000, open: false, host: '127.0.0.1' },
  preview: { port: 8000, open: false, host: '127.0.0.1' },
  plugins: [{
    name: 'copy-static-catalogue',
    closeBundle() {
      const out = resolve(import.meta.dirname, 'dist');
      // Gallery and story sources are selected at runtime, so retain their paths.
      cpSync(resolve(import.meta.dirname, 'Images'), resolve(out, 'Images'), { recursive: true });
      mkdirSync(resolve(out, 'assets'), { recursive: true });
      for (const file of ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
        cpSync(resolve(import.meta.dirname, 'assets', file), resolve(out, 'assets', file));
      }
      for (const file of ['robots.txt', 'sitemap.xml', 'site.webmanifest', '.nojekyll']) {
        cpSync(resolve(import.meta.dirname, file), resolve(out, file));
      }
    },
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(['index', 'world', 'characters', 'cultivation', 'story', 'gallery', 'privacy', '404'].map(page => [page, resolve(import.meta.dirname, `${page}.html`)])),
    },
  },
});
