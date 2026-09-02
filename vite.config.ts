import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Kept separate from `dist/` (the TypeScript server build's `outDir`) so
    // `npm run build` (client + server) never has one build silently
    // clobber the other's output.
    outDir: 'dist-client',
  },
  server: {
    // Vite binds to localhost only by default, which makes the dev server
    // unreachable from the players' phones. `host: true` binds to all
    // addresses (0.0.0.0) so phones on the same Wi-Fi can load the client
    // over the host machine's LAN IP. Local-playtest convenience only —
    // this app has no production deployment target yet.
    host: true,
    port: 5173,
    // The game server (Task 6) runs on a different port; proxy referee
    // calls so HostBoard's relative fetch('/referee/score') reaches it.
    // The proxy runs inside the Vite dev server process (on the host
    // machine), so `localhost` is correct here even when a phone is the
    // one making the request.
    // This proxy is a local-dev convenience only — a real deployment needs
    // its own reverse-proxy or CORS configuration, out of scope here.
    proxy: {
      '/referee': 'http://localhost:8000',
    },
  },
});
