const SERVER_PORT = Number(process.env.PORT) || 8000;
const CLIENT_PORT = Number(process.env.CLIENT_PORT) || 5173;

// A deployed target (e.g. Render) serves the built client and the game
// server from one HTTPS origin — there's no separate dev client port to
// point at, and this script must create the match on that same origin, not
// on the local dev server. Set this instead of HOST_LAN_IP when creating a
// match against a real deployment; see README.md.
const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL?.replace(/\/+$/, '');

// Where *this script* reaches the game server for local/LAN play. It always
// runs on the host machine, so localhost is correct here regardless of
// HOST_LAN_IP (that only affects the URLs handed to phones, not this
// script's own request).
const SERVER_URL = PUBLIC_SERVER_URL ?? process.env.SERVER_URL ?? `http://localhost:${SERVER_PORT}`;

interface Args {
  phonePlayerCount: number;
  hostLanIp?: string;
}

interface MatchUrls {
  host: string;
  players: string[];
}

export function buildMatchUrls({
  matchID,
  phonePlayerCount,
  hostPlayerID,
  publicServerUrl,
  hostLanIp,
}: {
  matchID: string;
  phonePlayerCount: number;
  hostPlayerID: string;
  publicServerUrl?: string;
  hostLanIp?: string;
}): MatchUrls {
  if (publicServerUrl) {
    return {
      host: `${publicServerUrl}/?match=${matchID}&role=host&playerID=${hostPlayerID}`,
      players: Array.from(
        { length: phonePlayerCount },
        (_, i) => `${publicServerUrl}/?match=${matchID}&role=player&playerID=${i}`
      ),
    };
  }

  const clientHost = hostLanIp ?? 'localhost';
  return {
    host: `http://${clientHost}:${CLIENT_PORT}/?match=${matchID}&role=host&playerID=${hostPlayerID}`,
    players: Array.from(
      { length: phonePlayerCount },
      (_, i) => `http://${clientHost}:${CLIENT_PORT}/?match=${matchID}&role=player&playerID=${i}`
    ),
  };
}

export function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let hostLanIp: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--host=')) {
      hostLanIp = arg.slice('--host='.length);
    } else if (arg === '--host') {
      hostLanIp = argv[i + 1];
      i++;
    } else {
      positional.push(arg);
    }
  }

  return {
    // The CLI argument means "number of phone players" — the host is a
    // separate, reserved playerID on top of that (see task-9-report.md, "Fix
    // round 1"), so boardgame.io's numPlayers is phonePlayerCount + 1.
    phonePlayerCount: Number(positional[0]) || 4,
    hostLanIp: hostLanIp || undefined,
  };
}

async function main() {
  const { phonePlayerCount, hostLanIp: hostLanIpFlag } = parseArgs(process.argv.slice(2));

  // The host machine's LAN IP (or hostname) that phones should use. `localhost`
  // on a phone means the *phone*, not the host's laptop, so URLs printed with
  // `localhost` only work in browser tabs on this same machine. Ignored
  // entirely once PUBLIC_SERVER_URL is set — a deployed origin needs neither
  // this nor a separate client port.
  const hostLanIp = process.env.HOST_LAN_IP || hostLanIpFlag;

  const numPlayers = phonePlayerCount + 1;
  const hostPlayerID = String(phonePlayerCount);

  const res = await fetch(`${SERVER_URL}/games/apologetics/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numPlayers }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create match: ${res.status} ${await res.text()}`);
  }

  const { matchID } = (await res.json()) as { matchID: string };
  console.log(`Match created for ${phonePlayerCount} players.`);
  console.log('');

  if (PUBLIC_SERVER_URL) {
    console.log(`Using deployed server: ${PUBLIC_SERVER_URL}`);
    console.log('');
  } else if (hostLanIp) {
    console.log(`Using host address: ${hostLanIp}`);
    console.log('Both dev processes must be started with the matching environment:');
    console.log(`  server:  HOST_LAN_IP=${hostLanIp} npm run dev:server`);
    console.log(`  client:  VITE_SERVER_URL=http://${hostLanIp}:${SERVER_PORT} npm run dev:client`);
    console.log('');
  } else {
    console.log('NOTE: these URLs use `localhost`, which only works in browser tabs on');
    console.log('      THIS machine. A phone resolves `localhost` to itself, so phones');
    console.log('      cannot reach the game with these URLs.');
    console.log('      To play with phones, set HOST_LAN_IP to this machine\'s LAN IP');
    console.log('      (macOS: `ipconfig getifaddr en0`, Linux: `hostname -I`) for the');
    console.log('      server, the client, and this script — see README.md.');
    console.log('');
  }

  const urls = buildMatchUrls({
    matchID,
    phonePlayerCount,
    hostPlayerID,
    publicServerUrl: PUBLIC_SERVER_URL,
    hostLanIp,
  });
  console.log(`Host screen: ${urls.host}`);
  urls.players.forEach((url, i) => console.log(`Player ${i}: ${url}`));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
