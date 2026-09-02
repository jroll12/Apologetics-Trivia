import React, { useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState } from '../game/ApologeticsGame';
import { RoundResult, scoreQuickDraw } from '../game/cards';

type RefereeApiResponse =
  | { timedOut: true }
  | { timedOut: false; score: number; tip: string };

async function fetchRefereeScore(cardId: string, response: string): Promise<RefereeApiResponse> {
  try {
    const res = await fetch('/referee/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, response }),
    });

    // The server only sends a `{ timedOut: true }` JSON body for a
    // RefereeTimeoutError. Any other server-side failure (auth errors,
    // unexpected exceptions, etc.) is rethrown by the server and reaches
    // us as a non-2xx response with a plain-text body — not JSON. Treat
    // any such failure the same as a timeout: the host can't get a usable
    // referee answer either way, so fall back to manual scoring.
    if (!res.ok) {
      return { timedOut: true };
    }

    return await res.json();
  } catch {
    // Covers a network failure from fetch() itself, or a response body
    // that claims to be ok but isn't valid JSON — neither should ever
    // propagate as an uncaught rejection to the caller.
    return { timedOut: true };
  }
}

export function HostBoard({
  G,
  moves,
  playerID,
}: Pick<BoardProps<GameState>, 'G' | 'moves' | 'ctx' | 'playerID'>) {
  const [manualScore, setManualScore] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!G.currentCard) return;
    setResolving(true);

    // Wrapped in try/finally so `resolving` is always reset, even if
    // something in this path throws for a reason we didn't anticipate —
    // the "Resolve Round" button must never be left permanently disabled.
    try {
      if (G.currentCard.type === 'QUICK_DRAW') {
        const results = scoreQuickDraw(G.currentCard, G.responses);
        moves.resolveRound(results);
        return;
      }

      const respondingPlayerID = G.claimedBy;
      if (!respondingPlayerID) {
        return;
      }

      const playerResponse = G.responses[respondingPlayerID] ?? '';
      const refereeResult = await fetchRefereeScore(G.currentCard.id, playerResponse);

      const result: RoundResult = refereeResult.timedOut
        ? {
            playerID: respondingPlayerID,
            score: Number(manualScore) || 0,
            tip: 'Scored by host (AI referee unavailable).',
          }
        : { playerID: respondingPlayerID, score: refereeResult.score, tip: refereeResult.tip };

      moves.resolveRound([result]);
      setManualScore('');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div>
      <h1>Apologetics Party Game</h1>

      <section>
        <h2>Leaderboard</h2>
        <ul>
          {Object.entries(G.scores)
            .filter(([id]) => id !== playerID)
            .sort((a, b) => b[1] - a[1])
            .map(([id, score]) => (
              <li key={id}>
                Player {id}: {score}
              </li>
            ))}
        </ul>
      </section>

      {!G.currentCard && <button onClick={() => moves.drawCard()}>Draw Card</button>}

      {G.currentCard && (
        <section>
          <p>{G.currentCard.type}</p>
          <p>{G.currentCard.prompt}</p>
          {G.currentCard.type === 'QUICK_DRAW' && G.currentCard.choices && (
            <ol>
              {G.currentCard.choices.map((choice, i) => (
                <li key={i}>{choice}</li>
              ))}
            </ol>
          )}
          <p>{Object.keys(G.responses).length} response(s) received</p>
          <input
            aria-label="manual score fallback"
            value={manualScore}
            onChange={(e) => setManualScore(e.target.value)}
            placeholder="Manual score if AI referee is unavailable"
          />
          <button onClick={handleResolve} disabled={resolving}>
            Resolve Round
          </button>
        </section>
      )}

      {G.lastRoundResult && (
        <section>
          <h2>Last Round</h2>
          {G.lastRoundResult.map((r) => (
            <p key={r.playerID}>
              Player {r.playerID}: +{r.score} — {r.tip}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
