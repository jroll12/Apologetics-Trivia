import React, { useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState } from '../game/ApologeticsGame';
import { RoundResult, scoreQuickDraw } from '../game/cards';

type RefereeApiResponse =
  | { timedOut: true }
  | { timedOut: false; score: number; tip: string };

async function fetchRefereeScore(cardId: string, response: string): Promise<RefereeApiResponse> {
  const res = await fetch('/referee/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, response }),
  });
  return res.json();
}

export function HostBoard({ G, moves }: Pick<BoardProps<GameState>, 'G' | 'moves' | 'ctx'>) {
  const [manualScore, setManualScore] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!G.currentCard) return;
    setResolving(true);

    if (G.currentCard.type === 'QUICK_DRAW') {
      const results = scoreQuickDraw(G.currentCard, G.responses);
      moves.resolveRound(results);
      setResolving(false);
      return;
    }

    const respondingPlayerID = G.claimedBy;
    if (!respondingPlayerID) {
      setResolving(false);
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
    setResolving(false);
  };

  return (
    <div>
      <h1>Apologetics Party Game</h1>

      <section>
        <h2>Leaderboard</h2>
        <ul>
          {Object.entries(G.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([playerID, score]) => (
              <li key={playerID}>
                Player {playerID}: {score}
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
