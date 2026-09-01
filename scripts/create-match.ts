const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:8000';

async function main() {
  // The CLI argument means "number of phone players" — the host is a
  // separate, reserved playerID on top of that (see task-9-report.md, "Fix
  // round 1"), so boardgame.io's numPlayers is phonePlayerCount + 1.
  const phonePlayerCount = Number(process.argv[2]) || 4;
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
  console.log(
    `Host screen: http://localhost:5173/?match=${matchID}&role=host&playerID=${hostPlayerID}`
  );
  for (let i = 0; i < phonePlayerCount; i++) {
    console.log(`Player ${i}: http://localhost:5173/?match=${matchID}&role=player&playerID=${i}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
