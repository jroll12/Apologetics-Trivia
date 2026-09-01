export interface Role {
  role: 'host' | 'player';
  playerID: string;
  matchID: string;
}

export function parseRoleFromUrl(search: string): Role {
  const params = new URLSearchParams(search);
  const matchID = params.get('match');
  if (!matchID) {
    throw new Error('Missing required "match" query parameter.');
  }

  const playerID = params.get('playerID');
  if (!playerID) {
    throw new Error('Missing required "playerID" query parameter.');
  }

  const role = params.get('role') === 'player' ? 'player' : 'host';
  return { role, playerID, matchID };
}
