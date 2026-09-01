export interface Role {
  role: 'host' | 'player';
  playerID?: string;
  matchID: string;
}

export function parseRoleFromUrl(search: string): Role {
  const params = new URLSearchParams(search);
  const matchID = params.get('match');
  if (!matchID) {
    throw new Error('Missing required "match" query parameter.');
  }

  if (params.get('role') === 'player') {
    const playerID = params.get('playerID');
    if (!playerID) {
      throw new Error('Player mode requires a "playerID" query parameter.');
    }
    return { role: 'player', playerID, matchID };
  }

  return { role: 'host', matchID };
}
