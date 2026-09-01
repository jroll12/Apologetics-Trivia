import React, { useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState } from '../game/ApologeticsGame';

export function PlayerBoard({
  G,
  moves,
  playerID,
}: Pick<BoardProps<GameState>, 'G' | 'moves' | 'ctx' | 'playerID'>) {
  const [freeText, setFreeText] = useState('');
  const myID = playerID ?? '';

  if (!G.currentCard) {
    return <p>Waiting for the host to draw a card...</p>;
  }

  const alreadySubmitted = G.responses[myID] !== undefined;

  if (G.currentCard.type === 'QUICK_DRAW') {
    if (alreadySubmitted) return <p>Answer submitted — waiting for other players.</p>;
    return (
      <div>
        <p>{G.currentCard.prompt}</p>
        {G.currentCard.choices?.map((choice, i) => (
          <button key={i} onClick={() => moves.submitAnswer(String(i))}>
            {choice}
          </button>
        ))}
      </div>
    );
  }

  // STEELMAN / COMEBACK
  if (G.claimedBy && G.claimedBy !== myID) {
    return <p>Player {G.claimedBy} is answering this round.</p>;
  }

  if (!G.claimedBy) {
    return (
      <div>
        <p>{G.currentCard.prompt}</p>
        <button onClick={() => moves.claimRound()}>I'll answer this one</button>
      </div>
    );
  }

  if (alreadySubmitted) {
    return <p>Response submitted — waiting for the host.</p>;
  }

  return (
    <div>
      <p>{G.currentCard.prompt}</p>
      <textarea
        aria-label="your response"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
      />
      <button onClick={() => moves.submitAnswer(freeText)}>Submit</button>
    </div>
  );
}
