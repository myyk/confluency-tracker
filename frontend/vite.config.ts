/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind 0.0.0.0. Inside a container the default localhost bind answers
    // nothing from the host, however the port is published.
    host: true,
    /*
     * No `watch: { usePolling }` here, deliberately. It is the standard answer
     * to a bind mount that delivers no inotify events, and on Vite 8 it does
     * nothing: the dev server watches through rolldown's native watcher, and
     * `usePolling` survives only in the type definitions -- nothing in
     * vite/dist reads it, and CHOKIDAR_USEPOLLING does not reach it either.
     * Measured, not assumed; see the README's note on hot reload.
     *
     * It is not needed where it would matter anyway: a bind mount backed by a
     * Linux filesystem propagates inotify normally and reloads in ~130ms.
     */
    proxy: {
      // Dev-only: the browser talks to Vite on :5173, which forwards
      // /api to the Django dev server. Same-origin, so no CORS setup.
      '/api': {
        // Under compose the backend is a service name on the compose network;
        // natively it is a process on localhost.
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
