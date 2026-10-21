import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    // Fixed upstream and model paths only; keys stay in headers, never URLs/logs.
    proxy: {
      '^/api/gemini/models/(gemini-3\\.5-flash|gemini-flash-latest):generateContent$': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/gemini/, '/v1beta'),
      },
    }
  }
});
