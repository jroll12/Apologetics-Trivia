import React, { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState } from '../game/ApologeticsGame';
import { RoundResult, scoreQuickDraw } from '../game/cards';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Badge } from './components/Badge';
import { Avatar } from './components/Avatar';
import { AnswerTile } from './components/AnswerTile';
import { CountdownRing } from './components/CountdownRing';
import { ProgressBar } from './components/ProgressBar';
import { CheckBadgeIcon, HandRaisedIcon, TrophyIcon, ArrowPathIcon } from './components/icons';
import { useCountdown } from './useCountdown';
import { getTimerColor } from './timerColor';
import { QUICK_DRAW_DURATION_SEC, STEELMAN_DURATION_SEC } from './roundDurations';
import './HostBoard.css';

type RefereeApiResponse =
  | { timedOut: true }
  | { timedOut: false; score: number; tip: string };

const MANUAL_SCORE_TIP = 'Scored by host (AI referee unavailable).';
const ROUND_TYPE_LABEL: Record<string, string> = {
  QUICK_DRAW: 'Quick Draw',
  STEELMAN: 'Steelman',
  COMEBACK: 'Comeback',
};

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

function Header({ matchID, roundLabel }: { matchID: string; roundLabel: string | null }) {
  return (
    <header className="ap-host-header">
      <div className="ap-host-header-left">
        <span className="ap-host-wordmark">Apologist</span>
        <Badge tone="violet" pulse>
          Live
        </Badge>
      </div>
      {roundLabel && (
        <div className="ap-host-header-right">
          <span className="ap-host-header-meta">{roundLabel}</span>
        </div>
      )}
      <span className="ap-host-header-code" aria-hidden="true">
        {matchID.slice(0, 6)}
      </span>
    </header>
  );
}

export function HostBoard({
  G,
  moves,
  matchID,
  playerID,
}: Pick<BoardProps<GameState>, 'G' | 'moves' | 'playerID' | 'matchID'>) {
  const [manualScore, setManualScore] = useState(5);
  const [resolving, setResolving] = useState(false);
  // Set to the responding player's ID once a referee call has come back
  // unusable. While it is non-null the host is being asked for a score — the
  // round is NOT resolved yet.
  const [refereeUnavailableFor, setRefereeUnavailableFor] = useState<string | null>(null);

  const currentCardId = G.currentCard?.id ?? null;
  const myID = playerID ?? '';

  // Every new card (and every resolved round) starts from a clean slate, so a
  // previous round's fallback prompt or half-typed score never leaks forward.
  useEffect(() => {
    setRefereeUnavailableFor(null);
    setManualScore(5);
  }, [currentCardId]);

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
      setManualScore(5);
    } finally {
      setResolving(false);
    }
  };

  const handleAwardManualScore = () => {
    if (refereeUnavailableFor === null) return;
    moves.resolveRound([
      { playerID: refereeUnavailableFor, score: manualScore, tip: MANUAL_SCORE_TIP },
    ]);
    setRefereeUnavailableFor(null);
    setManualScore(5);
  };

  const quickDrawTimerKey =
    G.currentCard?.type === 'QUICK_DRAW' && refereeUnavailableFor === null ? currentCardId : null;
  const quickDrawSecondsRemaining = useCountdown(
    QUICK_DRAW_DURATION_SEC,
    quickDrawTimerKey,
    handleResolve
  );

  const steelmanTimerKey =
    G.currentCard?.type === 'STEELMAN' && refereeUnavailableFor === null ? currentCardId : null;
  const steelmanSecondsRemaining = useCountdown(STEELMAN_DURATION_SEC, steelmanTimerKey);

  // `drawCard` is a no-op once every card has been dealt, so showing the
  // button then would be a dead end. `deckIndex` is the index of the card most
  // recently drawn (-1 before the first draw), so the deck is spent once it
  // has reached the last index and that card's round has been resolved.
  const deckExhausted = !G.currentCard && G.deckIndex >= G.deck.length - 1;
  const gameStarted = G.deckIndex >= 0;
  // The deck array itself still holds the just-resolved card even after
  // `currentCard` goes back to null, so the leaderboard screen between
  // rounds can still tell what kind of round it's showing results for.
  const lastDrawnCard = G.deckIndex >= 0 ? G.deck[G.deckIndex] : null;

  const phonePlayers = Object.entries(G.scores)
    .filter(([id]) => id !== myID)
    .sort((a, b) => b[1] - a[1]);
  const totalPhonePlayers = phonePlayers.length;
  const answersIn = Object.keys(G.responses).length;

  const roundLabel = G.currentCard
    ? `${ROUND_TYPE_LABEL[G.currentCard.type]} · Round ${G.deckIndex + 1} of ${G.deck.length}`
    : null;

  return (
    <div className="ap-host">
      <Header matchID={matchID} roundLabel={roundLabel} />

      <main className="ap-host-main">
        {!gameStarted && <LobbyScreen matchID={matchID} phonePlayers={phonePlayers} onStart={() => moves.drawCard()} />}

        {gameStarted && deckExhausted && (
          <GameOverScreen phonePlayers={phonePlayers} />
        )}

        {gameStarted && !deckExhausted && !G.currentCard && (
          <ResolvedScreen
            round={G.deckIndex + 1}
            total={G.deck.length}
            phonePlayers={phonePlayers}
            lastRoundResult={G.lastRoundResult}
            wasReferee={lastDrawnCard?.type !== 'QUICK_DRAW'}
            onNext={() => moves.drawCard()}
          />
        )}

        {G.currentCard && refereeUnavailableFor === null && G.currentCard.type === 'QUICK_DRAW' && (
          <QuickDrawScreen
            prompt={G.currentCard.prompt}
            choices={G.currentCard.choices ?? []}
            answersIn={answersIn}
            totalPlayers={totalPhonePlayers}
            secondsRemaining={quickDrawSecondsRemaining}
          />
        )}

        {G.currentCard && refereeUnavailableFor === null && G.currentCard.type === 'STEELMAN' && (
          <SteelmanScreen
            prompt={G.currentCard.prompt}
            claimedBy={G.claimedBy}
            totalPlayers={totalPhonePlayers}
            secondsRemaining={steelmanSecondsRemaining}
            resolving={resolving}
            onResolve={handleResolve}
          />
        )}

        {G.currentCard && refereeUnavailableFor === null && G.currentCard.type === 'COMEBACK' && (
          <ComebackScreen
            prompt={G.currentCard.prompt}
            claimedBy={G.claimedBy}
            hasResponse={G.claimedBy !== null && G.responses[G.claimedBy] !== undefined}
            resolving={resolving}
            onResolve={handleResolve}
          />
        )}

        {G.currentCard && refereeUnavailableFor !== null && (
          <RefereeUnavailableScreen
            respondingPlayerID={refereeUnavailableFor}
            roundType={G.currentCard.type}
            manualScore={manualScore}
            onChangeScore={setManualScore}
            resolving={resolving}
            onRetry={handleResolve}
            onAward={handleAwardManualScore}
          />
        )}
      </main>
    </div>
  );
}

function LobbyScreen({
  matchID,
  phonePlayers,
  onStart,
}: {
  matchID: string;
  phonePlayers: [string, number][];
  onStart: () => void;
}) {
  return (
    <Card padding="host" className="ap-lobby">
      <div className="ap-lobby-top">
        <div>
          <p className="ap-eyebrow">Room code</p>
          <p className="ap-room-code">{matchID.slice(0, 6).toUpperCase()}</p>
          <p className="ap-lobby-join">Ask the host for the game link to join.</p>
        </div>
      </div>

      <div className="ap-lobby-bottom">
        <div className="ap-lobby-bottom-row">
          <Badge>{phonePlayers.length} players joined</Badge>
          <Button variant="primary" size="large" onClick={onStart}>
            Start game
          </Button>
        </div>
        <div className="ap-player-pills">
          {phonePlayers.map(([id]) => (
            <span key={id} className="ap-player-pill">
              <Avatar initial={id} size={28} />
              Player {id}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function QuickDrawScreen({
  prompt,
  choices,
  answersIn,
  totalPlayers,
  secondsRemaining,
}: {
  prompt: string;
  choices: string[];
  answersIn: number;
  totalPlayers: number;
  secondsRemaining: number;
}) {
  return (
    <div className="ap-round">
      <div className="ap-round-top">
        <h1 className="ap-question">{prompt}</h1>
        <div className="ap-round-top-right">
          <p className="ap-tally">
            {answersIn}/{totalPlayers}
            <span className="ap-tally-label">answers in</span>
          </p>
          <CountdownRing secondsRemaining={secondsRemaining} totalSeconds={QUICK_DRAW_DURATION_SEC} />
        </div>
      </div>
      <div className="ap-tile-grid ap-tile-grid--host">
        {choices.map((choice, i) => (
          <AnswerTile key={i} position={i as 0 | 1 | 2 | 3} label={choice} size="host" />
        ))}
      </div>
    </div>
  );
}

function SteelmanScreen({
  prompt,
  claimedBy,
  totalPlayers,
  secondsRemaining,
  resolving,
  onResolve,
}: {
  prompt: string;
  claimedBy: string | null;
  totalPlayers: number;
  secondsRemaining: number;
  resolving: boolean;
  onResolve: () => void;
}) {
  return (
    <Card padding="host" className="ap-round">
      <p className="ap-eyebrow">Argue the skeptic's case</p>
      <p className="ap-prompt">{prompt}</p>
      <div className="ap-claim-row">
        {claimedBy ? (
          <div className="ap-claim-info">
            <Avatar initial={claimedBy} />
            <div>
              <p className="ap-claim-name">Player {claimedBy} claimed this round</p>
              <p className="ap-claim-meta">
                Speaking now · {Math.max(totalPlayers - 1, 0)} players watching
              </p>
            </div>
          </div>
        ) : (
          <p className="ap-claim-meta">Waiting for someone to claim this round…</p>
        )}
        <span className="ap-countdown-number" style={{ color: getTimerColor(secondsRemaining) }}>
          {formatMinutesSeconds(secondsRemaining)}
        </span>
      </div>
      <Button variant="primary" size="large" onClick={onResolve} disabled={resolving}>
        Resolve Round
      </Button>
    </Card>
  );
}

function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function ComebackScreen({
  prompt,
  claimedBy,
  hasResponse,
  resolving,
  onResolve,
}: {
  prompt: string;
  claimedBy: string | null;
  hasResponse: boolean;
  resolving: boolean;
  onResolve: () => void;
}) {
  return (
    <Card padding="host" className="ap-round">
      <p className="ap-eyebrow">Objection</p>
      <p className="ap-prompt">{prompt}</p>
      {claimedBy ? (
        <div className="ap-claim-row">
          <div className="ap-claim-info">
            <Avatar initial={claimedBy} />
            <p className="ap-claim-name">Player {claimedBy} is responding</p>
          </div>
          <Badge tone="violet" pulse>
            Live
          </Badge>
        </div>
      ) : (
        <p className="ap-claim-meta">Waiting for someone to claim this round…</p>
      )}
      <p className="ap-eyebrow">{hasResponse ? 'Response received' : 'Response pending'}</p>
      <ProgressBar progress={hasResponse ? 1 : 0} label="Response progress" />
      <Button variant="primary" size="large" onClick={onResolve} disabled={resolving}>
        Resolve Round
      </Button>
    </Card>
  );
}

function ResolvedScreen({
  round,
  total,
  phonePlayers,
  lastRoundResult,
  wasReferee,
  onNext,
}: {
  round: number;
  total: number;
  phonePlayers: [string, number][];
  lastRoundResult: RoundResult[] | null;
  wasReferee: boolean;
  onNext: () => void;
}) {
  const deltaFor = (id: string) => lastRoundResult?.find((r) => r.playerID === id)?.score ?? 0;
  const refereeResult = lastRoundResult?.find((r) => r.tip !== MANUAL_SCORE_TIP);

  return (
    <Card padding="host" className="ap-resolved">
      <p className="ap-eyebrow">
        Round {round} of {total} · Resolved
      </p>
      <ol className="ap-leaderboard">
        {phonePlayers.map(([id, score], i) => (
          <li key={id} className="ap-leaderboard-row">
            <span className="ap-leaderboard-rank">{i + 1}</span>
            <Avatar initial={id} size={32} />
            <span className="ap-leaderboard-name">Player {id}</span>
            <span className="ap-leaderboard-delta">
              {deltaFor(id) > 0 ? `+${deltaFor(id)}` : ''}
            </span>
            <span className="ap-leaderboard-score">{score}</span>
          </li>
        ))}
      </ol>

      {wasReferee && refereeResult && (
        <div className="ap-referee-tip">
          <span className="ap-referee-badge">
            <CheckBadgeIcon width={16} height={16} />
            AI Referee
          </span>
          <p className="ap-referee-tip-text">{refereeResult.tip}</p>
        </div>
      )}

      <Button variant="primary" size="large" onClick={onNext}>
        Next round
      </Button>
    </Card>
  );
}

function RefereeUnavailableScreen({
  respondingPlayerID,
  manualScore,
  onChangeScore,
  resolving,
  onRetry,
  onAward,
}: {
  respondingPlayerID: string;
  roundType: string;
  manualScore: number;
  onChangeScore: (score: number) => void;
  resolving: boolean;
  onRetry: () => void;
  onAward: () => void;
}) {
  const clampStep = (delta: number) => onChangeScore(Math.min(10, Math.max(0, manualScore + delta)));

  return (
    <Card padding="host" className="ap-referee-unavailable">
      <span className="ap-referee-unavailable-icon">
        <HandRaisedIcon width={32} height={32} />
      </span>
      <p className="ap-referee-unavailable-title">AI referee is offline</p>
      <p className="ap-referee-unavailable-body">
        We couldn't reach it for this round. Score Player {respondingPlayerID}'s response yourself,
        no rush.
      </p>
      <div className="ap-stepper">
        <button
          type="button"
          className="ap-stepper-button"
          onClick={() => clampStep(-1)}
          aria-label="Decrease score"
        >
          −
        </button>
        <div className="ap-stepper-value">
          <span className="ap-stepper-number">{manualScore}</span>
          <span className="ap-stepper-label">Points</span>
        </div>
        <button
          type="button"
          className="ap-stepper-button"
          onClick={() => clampStep(1)}
          aria-label="Increase score"
        >
          +
        </button>
      </div>
      <div className="ap-referee-unavailable-actions">
        <Button variant="secondary" icon={<ArrowPathIcon width={18} height={18} />} onClick={onRetry} disabled={resolving}>
          Retry AI referee
        </Button>
        <Button variant="primary" onClick={onAward} disabled={resolving}>
          Award points
        </Button>
      </div>
    </Card>
  );
}

function GameOverScreen({ phonePlayers }: { phonePlayers: [string, number][] }) {
  const [winnerId, winnerScore] = phonePlayers[0] ?? ['0', 0];
  const runnersUp = phonePlayers.slice(1);

  return (
    <div className="ap-game-over">
      <h1 className="ap-game-over-heading">Game over</h1>
      <Card padding="host" className="ap-winner-card">
        <TrophyIcon width={40} height={40} />
        <Avatar initial={winnerId} size={64} />
        <p className="ap-winner-name">Player {winnerId}</p>
        <p className="ap-winner-score">{winnerScore}</p>
      </Card>
      <ol className="ap-leaderboard">
        {runnersUp.map(([id, score], i) => (
          <li key={id} className="ap-leaderboard-row">
            <span className="ap-leaderboard-rank">{i + 2}</span>
            <Avatar initial={id} size={28} />
            <span className="ap-leaderboard-name">Player {id}</span>
            <span className="ap-leaderboard-score">{score}</span>
          </li>
        ))}
      </ol>
      <Button variant="primary" size="large" onClick={() => window.location.reload()}>
        Play again
      </Button>
    </div>
  );
}
