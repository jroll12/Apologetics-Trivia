const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:8000';

async function main() {
  const numPlayers = Number(process.argv[2]) || 4;
  const res = await fetch(`${SERVER_URL}/games/apologetics/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numPlayers }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create match: ${res.status} ${await res.text()}`);
  }

  const { matchID } = (await res.json()) as { matchID: string };
  console.log(`Match created for ${numPlayers} players.`);
  console.log(`Host screen: http://localhost:5173/?match=${matchID}`);
  for (let i = 0; i < numPlayers; i++) {
    console.log(`Player ${i}: http://localhost:5173/?match=${matchID}&role=player&playerID=${i}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
