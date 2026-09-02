import React from 'react';
import { createRoot } from 'react-dom/client';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { HostBoard } from './HostBoard';
import { PlayerBoard } from './PlayerBoard';
import { parseRoleFromUrl } from './url';

// This value is baked into the bundle every phone loads, so it must not be a
// hard-coded `localhost` — on a phone, `localhost` means the phone itself, not
// the host's laptop. Prefer the explicit `VITE_SERVER_URL` that
// `npm run create-match` prints, and otherwise derive the server host from the
// page's own hostname so the LAN case still works if that export was
// forgotten. On the same-machine playtest this still resolves to
// `http://localhost:8000`, exactly as before.
const SERVER_URL =
  (import.meta as any).env?.VITE_SERVER_URL ??
  `${window.location.protocol}//${window.location.hostname}:8000`;

const { role, playerID, matchID } = parseRoleFromUrl(window.location.search);

const GameClient = Client({
  game: ApologeticsGame,
  board: role === 'host' ? HostBoard : PlayerBoard,
  multiplayer: SocketIO({ server: SERVER_URL }),
  debug: false,
});

const root = createRoot(document.getElementById('root')!);
root.render(<GameClient matchID={matchID} playerID={playerID} />);
