import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// A build id (git short hash, "+edits" when the tree has uncommitted changes, and the build time) shown in Settings and on /design,
// so it is always clear which build is on screen. Vercel builds have no .git folder, so fall back to its commit env var.
const git = (cmd) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const hash = git('git rev-parse --short HEAD') || (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'nogit';
const dirty = git('git status --porcelain') ? '+edits' : '';

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(`${hash}${dirty}`),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], map: ['leaflet', 'react-leaflet'], charts: ['recharts'] } },
    },
  },
  server: { proxy: { '/api': process.env.API_PROXY || 'http://localhost:3001' } },
});
