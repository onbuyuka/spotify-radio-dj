import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages project site lives under /spotify-radio-dj/.
  base: '/spotify-radio-dj/',
  // Vitest sets process.env.VITEST before loading this config, so tests and
  // builds use separate dep caches. Sharing one cache corrupts it and makes
  // Vitest fail with "Cannot read properties of undefined (reading 'config')".
  cacheDir: process.env.VITEST ? 'node_modules/.vitest-cache' : 'node_modules/.vite',
  server: {
    // 127.0.0.1:3000 is a valid Spotify redirect URI for local dev (Spotify
    // rejects plain "localhost"); 0.0.0.0 binds it so that loopback IP resolves.
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
