import React from 'react';
import { createRoot } from 'react-dom/client';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { HostBoard } from './HostBoard';
import { PlayerBoard } from './PlayerBoard';
import { parseRoleFromUrl } from './url';

// This value is baked into the bundle every phone (or browser) downloads, so
// it must not be a hard-coded `localhost` — on a phone, `localhost` means the
// phone itself, not the host's laptop. Prefer the explicit `VITE_SERVER_URL`
// that `npm run create-match` prints for LAN play, and otherwise fall back
// based on how this bundle was built:
// - In dev (`vite`/`npm run dev:client`), the client and server are always
//   two separate processes — Vite on 5173, the game server on 8000, same
//   hostname — so assume port 8000 on the page's own hostname.
// - In a production build (`vite build`, e.g. deployed to Render), the same
//   server process serves both the built client and the API/Socket.IO
//   endpoints from one origin — appending ":8000" there would point at a
//   port nothing is listening on publicly. Use the page's own origin as-is.
const SERVER_URL =
  (import.meta as any).env?.VITE_SERVER_URL ??
  ((import.meta as any).env?.DEV
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : window.location.origin);

const { role, playerID, matchID } = parseRoleFromUrl(window.location.search);

const GameClient = Client({
  game: ApologeticsGame,
  board: role === 'host' ? HostBoard : PlayerBoard,
  // `transports: ['websocket']` must match the server's socketOpts
  // (src/server/index.ts) — see the comment there for why: skips the
  // HTTP-long-polling phase that doesn't survive Render's proxy.
  multiplayer: SocketIO({ server: SERVER_URL, socketOpts: { transports: ['websocket'] } }),
  debug: false,
});

const root = createRoot(document.getElementById('root')!);
root.render(<GameClient matchID={matchID} playerID={playerID} />);
