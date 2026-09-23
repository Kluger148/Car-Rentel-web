import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API runs separately (backend: npm run start:dev on :3000).
// Proxying /api keeps the browser on one origin in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
