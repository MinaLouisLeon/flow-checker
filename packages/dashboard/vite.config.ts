import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: served by the tool server and from static export folders.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Served from localhost, so one ~600 KB bundle is fine.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 4401,
    // `pnpm dev` here talks to a tool server started with `flow-checker dev --no-open`.
    proxy: { '/api': 'http://localhost:4400' },
  },
})
