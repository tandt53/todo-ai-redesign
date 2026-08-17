import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
const here = fileURLToPath(new URL('.', import.meta.url))
const PROJ = fileURLToPath(new URL('..', import.meta.url))
export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    // The three redirects that make the REAL RN components render in a browser.
    // Nothing in src/ is modified — the swap happens at resolve time only.
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      // lucide-react-native imports only `react` + `react-native-svg`, so pointing
      // svg at its own web build is enough to make the icons work unchanged.
      { find: /^react-native-svg$/, replacement: here + 'shim-svg.tsx' },
      { find: /^lucide-react-native$/, replacement: here + 'shim-lucide.tsx' },
    ],
    mainFields: ['module', 'browser', 'main'],
    extensions: ['.web.tsx','.web.ts','.tsx','.ts','.jsx','.js'],
  },
  define: { global: 'window', __DEV__: 'true', 'process.env.NODE_ENV': '"development"' },
  optimizeDeps: {
    include: ['react','react-dom','react-native-web'],
    exclude: ['react-native','react-native-svg','lucide-react-native'],
    esbuildOptions: { mainFields: ['module','browser','main'] },
  },
  server: {
    port: 5199, strictPort: true,
    fs: { allow: [PROJ, here] },
    proxy: { '/assistant': { target: 'http://localhost:4460', changeOrigin: true },
             '/tasks': { target: 'http://localhost:4460', changeOrigin: true } },
  },
})
