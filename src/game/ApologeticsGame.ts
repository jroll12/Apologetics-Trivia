import type { Game } from 'boardgame.io';
import { ActivePlayers } from 'boardgame.io/core';
import { Card, RoundResult, STARTER_DECK } from './cards';

export interface GameState {
  deck: Card[];
  deckIndex: number;
  currentCard: Card | null;
  responses: Record<string, string>;
  claimedBy: string | null;
  scores: Record<string, number>;
  lastRoundResult: RoundResult[] | null;
}

export const ApologeticsGame: Game<GameState> = {
  name: 'apologetics',

  setup: ({ ctx }): GameState => {
    const scores: Record<string, number> = {};
    for (let i = 0; i < ctx.numPlayers; i++) {
      scores[String(i)] = 0;
    }
    return {
      deck: STARTER_DECK,
      deckIndex: -1,
      currentCard: null,
      responses: {},
      claimedBy: null,
      scores,
      lastRoundResult: null,
    };
  },

  // Every player can act at any time — there's no rotating turn order in a
  // party game where anyone might buzz in or claim a round. If moves start
  // getting rejected as "not your turn," check
  // https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/stages.md
  // in case this field's shape has changed in the installed version.
  turn: {
    activePlayers: ActivePlayers.ALL,
  },

  moves: {
    drawCard: ({ G }) => {
      const nextIndex = G.deckIndex + 1;
      if (nextIndex >= G.deck.length) {
        return; // deck exhausted; host UI shows a "game over" state
      }
      G.deckIndex = nextIndex;
      G.currentCard = G.deck[nextIndex];
      G.responses = {};
      G.claimedBy = null;
      G.lastRoundResult = null;
    },

    claimRound: ({ G, playerID }) => {
      if (!G.currentCard || G.currentCard.type === 'QUICK_DRAW') return;
      if (G.claimedBy) return; // already claimed
      G.claimedBy = playerID;
    },

    submitAnswer: ({ G, playerID }, payload: string) => {
      if (!G.currentCard) return;

      if (G.currentCard.type === 'QUICK_DRAW') {
        G.responses[playerID] = payload;
        return;
      }

      if (G.claimedBy !== playerID) return; // must claim first
      G.responses[playerID] = payload;
    },

    resolveRound: ({ G }, results: RoundResult[]) => {
      if (!G.currentCard) return;
      for (const result of results) {
        G.scores[result.playerID] = (G.scores[result.playerID] ?? 0) + result.score;
      }
      G.lastRoundResult = results;
      G.currentCard = null;
    },

    // Resets the SAME match back to its just-started state so the host can
    // play again with the same players and links, without redealing a new
    // match. `G.deck` is left untouched — it's always the same STARTER_DECK
    // reference — and the existing `G.scores` keys are reused rather than
    // recomputed from ctx, since they already reflect this match's real
    // players.
    resetGame: ({ G }) => {
      G.deckIndex = -1;
      G.currentCard = null;
      G.responses = {};
      G.claimedBy = null;
      G.lastRoundResult = null;
      for (const playerID of Object.keys(G.scores)) {
        G.scores[playerID] = 0;
      }
    },
  },
};
