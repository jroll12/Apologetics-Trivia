const SERVER_PORT = Number(process.env.PORT) || 8000;
const CLIENT_PORT = Number(process.env.CLIENT_PORT) || 5173;

// Where *this script* reaches the game server. It always runs on the host
// machine, so localhost is correct here regardless of HOST_LAN_IP.
const SERVER_URL = process.env.SERVER_URL ?? `http://localhost:${SERVER_PORT}`;

interface Args {
  phonePlayerCount: number;
  hostLanIp?: string;
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
  // `localhost` only work in browser tabs on this same machine.
  const hostLanIp = process.env.HOST_LAN_IP || hostLanIpFlag;
  const clientHost = hostLanIp ?? 'localhost';

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

  if (hostLanIp) {
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

  console.log(
    `Host screen: http://${clientHost}:${CLIENT_PORT}/?match=${matchID}&role=host&playerID=${hostPlayerID}`
  );
  for (let i = 0; i < phonePlayerCount; i++) {
    console.log(
      `Player ${i}: http://${clientHost}:${CLIENT_PORT}/?match=${matchID}&role=player&playerID=${i}`
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
