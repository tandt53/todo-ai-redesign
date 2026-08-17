// Dev/build config for the F-001 web client.
//
// It lives inside the module rather than at the repo root because
// MANIFEST `## Ownership.writers` scopes web-agent to `{src}/` plus the shared
// root manifests — so the scripts in package.json pass `--config` explicitly:
//   npm run dev:web     → serves this app on :5173
//   npm run build:web   → static bundle in src/assistant/web/dist/
//
// `/assistant/*` and `/tasks*` proxy to the prototype API server
// (api-contracts.md Conventions: default http://localhost:4460), so the page
// is same-origin and the client needs no base URL. QA's Playwright config
// points `baseURL` at the dev server and navigates to `/?qaUser=<user>`.

import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))
const apiTarget = process.env['ASSISTANT_API_URL'] ?? 'http://localhost:4460'

export default defineConfig({
  root: here,
  plugins: [react()],
  server: {
    port: Number(process.env['WEB_PORT'] ?? 5173),
    strictPort: true,
    proxy: {
      '/assistant': { target: apiTarget, changeOrigin: true },
      '/tasks': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port: Number(process.env['WEB_PORT'] ?? 5173),
    strictPort: true,
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
