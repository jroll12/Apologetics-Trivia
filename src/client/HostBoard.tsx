import React, { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState } from '../game/ApologeticsGame';
import { RoundResult, scoreQuickDraw } from '../game/cards';

type RefereeApiResponse =
  | { timedOut: true }
  | { timedOut: false; score: number; tip: string };

const MANUAL_SCORE_TIP = 'Scored by host (AI referee unavailable).';

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
  // Set to the responding player's ID once a referee call has come back
  // unusable. While it is non-null the host is being asked for a score — the
  // round is NOT resolved yet.
  const [refereeUnavailableFor, setRefereeUnavailableFor] = useState<string | null>(null);

  const currentCardId = G.currentCard?.id ?? null;

  // Every new card (and every resolved round) starts from a clean slate, so a
  // previous round's fallback prompt or half-typed score never leaks forward.
  useEffect(() => {
    setRefereeUnavailableFor(null);
    setManualScore('');
  }, [currentCardId]);

  const parsedManualScore = manualScore.trim() === '' ? NaN : Number(manualScore);
  const manualScoreIsValid = Number.isFinite(parsedManualScore);

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

      if (refereeResult.timedOut) {
        // Deliberately do NOT resolve the round here. The host had no way of
        // knowing this call was about to fail, so scoring now would award
        // whatever happens to be in the manual-score box — which is nothing,
        // i.e. 0 points — and then clear the card with no second chance.
        // Instead, hand the host the manual-scoring UI and wait for them to
        // explicitly confirm a score (see `handleAwardManualScore`).
        setRefereeUnavailableFor(respondingPlayerID);
        return;
      }

      const result: RoundResult = {
        playerID: respondingPlayerID,
        score: refereeResult.score,
        tip: refereeResult.tip,
      };
      moves.resolveRound([result]);
      setRefereeUnavailableFor(null);
      setManualScore('');
    } finally {
      setResolving(false);
    }
  };

  const handleAwardManualScore = () => {
    if (refereeUnavailableFor === null || !manualScoreIsValid) return;
    moves.resolveRound([
      { playerID: refereeUnavailableFor, score: parsedManualScore, tip: MANUAL_SCORE_TIP },
    ]);
    setRefereeUnavailableFor(null);
    setManualScore('');
  };

  // `drawCard` is a no-op once every card has been dealt, so showing the
  // button then would be a dead end. `deckIndex` is the index of the card most
  // recently drawn (-1 before the first draw), so the deck is spent once it
  // has reached the last index and that card's round has been resolved.
  const deckExhausted = !G.currentCard && G.deckIndex >= G.deck.length - 1;

  return (
    <div>
      <h1>Apologetics Party Game</h1>

      <section>
        <h2>{deckExhausted ? 'Final Scores' : 'Leaderboard'}</h2>
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

      {!G.currentCard &&
        (deckExhausted ? (
          <section>
            <p>{"\u{1F389} That's all the cards! Final scores are above."}</p>
          </section>
        ) : (
          <button onClick={() => moves.drawCard()}>Draw Card</button>
        ))}

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

          {refereeUnavailableFor === null ? (
            <button onClick={handleResolve} disabled={resolving}>
              Resolve Round
            </button>
          ) : (
            <div>
              <p>AI referee unavailable — enter a score to award points for this round.</p>
              <input
                aria-label="manual score fallback"
                value={manualScore}
                onChange={(e) => setManualScore(e.target.value)}
                placeholder={`Score 0-10 for player ${refereeUnavailableFor}`}
              />
              <button onClick={handleAwardManualScore} disabled={!manualScoreIsValid}>
                Award Manual Score
              </button>
              <button onClick={handleResolve} disabled={resolving}>
                Retry AI Referee
              </button>
            </div>
          )}
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
