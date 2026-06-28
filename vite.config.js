import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Multi-page static site. Each HTML file is its own entry.
export default defineConfig({
  // Treat the project as a Multi-Page App (no SPA fallback).
  appType: 'mpa',
  server: {
    port: 8000,
    open: true,
    host: true,
  },
  preview: {
    port: 8000,
    open: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        world: resolve(__dirname, 'world.html'),
        characters: resolve(__dirname, 'characters.html'),
        cultivation: resolve(__dirname, 'cultivation.html'),
        story: resolve(__dirname, 'story.html'),
        gallery: resolve(__dirname, 'gallery.html'),
      },
    },
  },
});
