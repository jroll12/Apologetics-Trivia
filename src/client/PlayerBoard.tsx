import React, { useRef, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState } from '../game/ApologeticsGame';
import { Avatar } from './components/Avatar';
import { Button } from './components/Button';
import { AnswerTile } from './components/AnswerTile';
import { MicrophoneIcon } from './components/icons';
import { useCountdown } from './useCountdown';
import { useSpeechToText } from './useSpeechToText';
import { getTimerColor } from './timerColor';
import { QUICK_DRAW_DURATION_SEC } from './roundDurations';
import './PlayerBoard.css';

function Header({ matchID }: { matchID: string }) {
  return (
    <header className="ap-player-header">
      <span className="ap-player-wordmark">Apologist Live</span>
      <span className="ap-player-code">{matchID.slice(0, 6).toUpperCase()}</span>
    </header>
  );
}

export function PlayerBoard({
  G,
  moves,
  matchID,
  playerID,
}: Pick<BoardProps<GameState>, 'G' | 'moves' | 'playerID' | 'matchID'>) {
  const [freeText, setFreeText] = useState('');
  const myID = playerID ?? '';
  const currentCardId = G.currentCard?.id ?? null;

  const quickDrawTimerKey = G.currentCard?.type === 'QUICK_DRAW' ? currentCardId : null;
  const secondsRemaining = useCountdown(QUICK_DRAW_DURATION_SEC, quickDrawTimerKey);

  const totalPhonePlayers = Object.keys(G.scores).filter((id) => id !== myID).length;

  if (!G.currentCard) {
    return (
      <div className="ap-player">
        <Header matchID={matchID} />
        <main className="ap-player-main ap-player-main--centered">
          <Avatar initial={myID} size={76} />
          <p className="ap-player-title">You're in, Player {myID}</p>
          <p className="ap-player-body">
            {G.deckIndex < 0
              ? 'Waiting for the host to start the game'
              : 'Waiting for the host to continue'}
          </p>
          <PulsingDots />
          <p className="ap-player-caption">{totalPhonePlayers} players in the room</p>
        </main>
      </div>
    );
  }

  const alreadySubmitted = G.responses[myID] !== undefined;

  return (
    <div className="ap-player">
      <Header matchID={matchID} />
      <main className="ap-player-main">
        {G.currentCard.type === 'QUICK_DRAW' && (
          <QuickDrawScreen
            prompt={G.currentCard.prompt}
            choices={G.currentCard.choices ?? []}
            secondsRemaining={secondsRemaining}
            selectedIndex={alreadySubmitted ? Number(G.responses[myID]) : null}
            onSelect={(i) => moves.submitAnswer(String(i))}
          />
        )}

        {(G.currentCard.type === 'STEELMAN' || G.currentCard.type === 'COMEBACK') &&
          (G.claimedBy && G.claimedBy !== myID ? (
            <SomeoneElseAnsweringScreen respondingPlayerID={G.claimedBy} />
          ) : (
            <ClaimAndRespondScreen
              prompt={G.currentCard.prompt}
              claimed={G.claimedBy === myID}
              submitted={alreadySubmitted}
              freeText={freeText}
              onChangeFreeText={setFreeText}
              onClaim={() => moves.claimRound()}
              onSubmit={() => moves.submitAnswer(freeText)}
            />
          ))}
      </main>
    </div>
  );
}

function PulsingDots() {
  return (
    <div className="ap-pulsing-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function QuickDrawScreen({
  prompt,
  choices,
  secondsRemaining,
  selectedIndex,
  onSelect,
}: {
  prompt: string;
  choices: string[];
  secondsRemaining: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const locked = selectedIndex !== null;
  return (
    <div className="ap-player-round">
      <div className="ap-player-round-top">
        <p className="ap-eyebrow">Quick draw</p>
        <span className="ap-player-timer" style={{ color: getTimerColor(secondsRemaining) }}>
          {secondsRemaining}s
        </span>
      </div>
      <p className="ap-player-question">{prompt}</p>
      <div className="ap-tile-grid ap-tile-grid--player">
        {choices.map((choice, i) => (
          <AnswerTile
            key={i}
            position={i as 0 | 1 | 2 | 3}
            label={choice}
            size="player"
            interactive
            selected={selectedIndex === i}
            locked={locked}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
      {locked && (
        <p className="ap-lock-banner">✓ Answer locked in — {choices[selectedIndex]}</p>
      )}
    </div>
  );
}

function ClaimAndRespondScreen({
  prompt,
  claimed,
  submitted,
  freeText,
  onChangeFreeText,
  onClaim,
  onSubmit,
}: {
  prompt: string;
  claimed: boolean;
  submitted: boolean;
  freeText: string;
  onChangeFreeText: (value: string) => void;
  onClaim: () => void;
  onSubmit: () => void;
}) {
  if (submitted) {
    return (
      <div className="ap-player-round">
        <p className="ap-player-question">{prompt}</p>
        <p className="ap-player-body">Response submitted — waiting for the host.</p>
      </div>
    );
  }

  if (!claimed) {
    return (
      <div className="ap-player-round">
        <p className="ap-player-question">{prompt}</p>
        <Button variant="primary" size="large" className="ap-full-width" onClick={onClaim}>
          I'll answer this one
        </Button>
        <p className="ap-player-caption">First to tap gets the round</p>
      </div>
    );
  }

  return (
    <div className="ap-player-round">
      <p className="ap-player-question">{prompt}</p>
      <label className="ap-sr-only" htmlFor="response-textarea">
        Your response
      </label>
      <div className="ap-response-box-wrap">
        <textarea
          id="response-textarea"
          className="ap-response-box"
          value={freeText}
          onChange={(e) => onChangeFreeText(e.target.value)}
          placeholder="Type your response…"
        />
        <VoiceInputButton freeText={freeText} onChangeFreeText={onChangeFreeText} />
      </div>
      <Button variant="primary" size="large" className="ap-full-width" onClick={onSubmit}>
        Submit response
      </Button>
    </div>
  );
}

function VoiceInputButton({
  freeText,
  onChangeFreeText,
}: {
  freeText: string;
  onChangeFreeText: (value: string) => void;
}) {
  // Captured the moment recording starts, so a live transcript is appended
  // after whatever the player already typed rather than replacing it.
  const baseTextRef = useRef('');

  const { supported, listening, start, stop } = useSpeechToText((sessionTranscript) => {
    const base = baseTextRef.current.trimEnd();
    onChangeFreeText(base ? `${base} ${sessionTranscript}` : sessionTranscript);
  });

  if (!supported) return null;

  const handleClick = () => {
    if (listening) {
      stop();
      return;
    }
    baseTextRef.current = freeText;
    start();
  };

  return (
    <div className="ap-voice-input">
      <button
        type="button"
        className={`ap-voice-button ${listening ? 'ap-voice-button--listening' : ''}`}
        onClick={handleClick}
        aria-label={listening ? 'Stop voice input' : 'Speak your response'}
      >
        <MicrophoneIcon width={20} height={20} />
      </button>
      {listening && <span className="ap-voice-status">Listening…</span>}
    </div>
  );
}

function SomeoneElseAnsweringScreen({ respondingPlayerID }: { respondingPlayerID: string }) {
  return (
    <div className="ap-player-main--centered">
      <Avatar initial={respondingPlayerID} tone="neutral" size={64} />
      <p className="ap-player-title">Player {respondingPlayerID} is answering this one</p>
      <p className="ap-player-body">Sit tight, you'll see the result soon</p>
      <PulsingDots />
    </div>
  );
}
