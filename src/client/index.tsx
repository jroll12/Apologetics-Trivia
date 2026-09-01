import React from 'react';
import { createRoot } from 'react-dom/client';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { HostBoard } from './HostBoard';
import { PlayerBoard } from './PlayerBoard';
import { parseRoleFromUrl } from './url';

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL ?? 'http://localhost:8000';

const { role, playerID, matchID } = parseRoleFromUrl(window.location.search);

const GameClient = Client({
  game: ApologeticsGame,
  board: role === 'host' ? HostBoard : PlayerBoard,
  multiplayer: SocketIO({ server: SERVER_URL }),
});

const root = createRoot(document.getElementById('root')!);
root.render(<GameClient matchID={matchID} playerID={playerID} />);
