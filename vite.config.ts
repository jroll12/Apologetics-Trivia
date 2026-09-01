import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The game server (Task 6) runs on a different port; proxy referee
    // calls so HostBoard's relative fetch('/referee/score') reaches it.
    // This proxy is a local-dev convenience only — a real deployment needs
    // its own reverse-proxy or CORS configuration, out of scope here.
    proxy: {
      '/referee': 'http://localhost:8000',
    },
  },
});
