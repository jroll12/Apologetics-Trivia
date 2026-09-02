import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { ApologeticsGame, GameState } from './ApologeticsGame';
import { STARTER_DECK } from './cards';

function makeClients(matchID: string) {
  const spec = { game: ApologeticsGame, numPlayers: 2, matchID };
  const client0 = Client({ ...spec, playerID: '0', multiplayer: Local() });
  const client1 = Client({ ...spec, playerID: '1', multiplayer: Local() });
  client0.start();
  client1.start();
  return { client0, client1 };
}

function drawUntilType(client: ReturnType<typeof Client>, type: string) {
  let card = (client.getState()!.G as GameState).currentCard;
  let guard = 0;
  while ((!card || card.type !== type) && guard < STARTER_DECK.length + 1) {
    if (card) client.moves.resolveRound([]);
    client.moves.drawCard();
    card = (client.getState()!.G as GameState).currentCard;
    guard++;
  }
  return card;
}

describe('ApologeticsGame', () => {
  it('starts with no current card and deckIndex -1', () => {
    const { client0 } = makeClients('start-test');
    const G = client0.getState()!.G as GameState;
    expect(G.currentCard).toBeNull();
    expect(G.deckIndex).toBe(-1);
  });

  it('drawCard advances to the next card in the deck', () => {
    const { client0 } = makeClients('draw-test');
    client0.moves.drawCard();
    const G = client0.getState()!.G as GameState;
    expect(G.currentCard).toEqual(STARTER_DECK[0]);
    expect(G.deckIndex).toBe(0);
  });

  it("records each player's answer independently for a QUICK_DRAW round", () => {
    const { client0, client1 } = makeClients('quickdraw-test');
    client0.moves.drawCard(); // STARTER_DECK[0] is QUICK_DRAW
    client0.moves.submitAnswer('1');
    client1.moves.submitAnswer('0');
    const G = client0.getState()!.G as GameState;
    expect(G.responses).toEqual({ '0': '1', '1': '0' });
  });

  it('only lets the first player who claims a STEELMAN round submit an answer', () => {
    const { client0, client1 } = makeClients('claim-test');
    const card = drawUntilType(client0, 'STEELMAN');
    expect(card?.type).toBe('STEELMAN');

    client1.moves.claimRound();
    client0.moves.claimRound(); // no-op — player 1 already claimed

    expect((client0.getState()!.G as GameState).claimedBy).toBe('1');

    client0.moves.submitAnswer('an argument from player 0'); // rejected, not the claimer
    client1.moves.submitAnswer('an argument from player 1');

    expect((client0.getState()!.G as GameState).responses).toEqual({
      '1': 'an argument from player 1',
    });
  });

  it('rejects submitAnswer on a STEELMAN round before anyone has claimed it', () => {
    const { client0 } = makeClients('submit-before-claim-test');
    const card = drawUntilType(client0, 'STEELMAN');
    expect(card?.type).toBe('STEELMAN');

    client0.moves.submitAnswer('an argument');
    expect((client0.getState()!.G as GameState).responses).toEqual({});
  });

  it('resolveRound adds scores, records the result, and clears the current card', () => {
    const { client0 } = makeClients('resolve-test');
    client0.moves.drawCard();
    client0.moves.resolveRound([{ playerID: '0', score: 10, tip: 'Correct!' }]);
    const G = client0.getState()!.G as GameState;
    expect(G.scores['0']).toBe(10);
    expect(G.currentCard).toBeNull();
    expect(G.lastRoundResult).toEqual([{ playerID: '0', score: 10, tip: 'Correct!' }]);
  });

  it("resolveRound adds to a player's existing score rather than overwriting it", () => {
    const { client0 } = makeClients('accumulate-test');
    client0.moves.drawCard();
    client0.moves.resolveRound([{ playerID: '0', score: 10, tip: 'first' }]);
    client0.moves.drawCard();
    client0.moves.resolveRound([{ playerID: '0', score: 5, tip: 'second' }]);

    const G = client0.getState()!.G as GameState;
    expect(G.scores['0']).toBe(15);
  });

  it('ignores a duplicate resolveRound dispatch when no round is active', () => {
    const { client0 } = makeClients('duplicate-resolve-test');
    client0.moves.drawCard();
    client0.moves.resolveRound([{ playerID: '0', score: 10, tip: 'Correct!' }]);
    // A second/late dispatch for the same (now-resolved) round must not fire again.
    client0.moves.resolveRound([{ playerID: '0', score: 10, tip: 'Correct!' }]);
    const G = client0.getState()!.G as GameState;
    expect(G.scores['0']).toBe(10); // not double-credited to 20
    expect(G.lastRoundResult).toEqual([{ playerID: '0', score: 10, tip: 'Correct!' }]);
  });

  it('claimRound does nothing on a QUICK_DRAW round', () => {
    const { client0, client1 } = makeClients('claim-quickdraw-test');
    client0.moves.drawCard(); // STARTER_DECK[0] is QUICK_DRAW
    client1.moves.claimRound();
    expect((client0.getState()!.G as GameState).claimedBy).toBeNull();
  });

  it('drawCard does nothing once the deck is exhausted', () => {
    const { client0 } = makeClients('exhausted-test');
    for (let i = 0; i < STARTER_DECK.length; i++) {
      client0.moves.drawCard();
      client0.moves.resolveRound([]);
    }
    expect((client0.getState()!.G as GameState).deckIndex).toBe(STARTER_DECK.length - 1);

    client0.moves.drawCard();
    const after = client0.getState()!.G as GameState;
    expect(after.deckIndex).toBe(STARTER_DECK.length - 1);
    expect(after.currentCard).toBeNull();
  });

  it('resetGame resets scores and round state back to the initial state, keeping the same players', () => {
    const { client0 } = makeClients('reset-test');
    client0.moves.drawCard();
    client0.moves.resolveRound([{ playerID: '0', score: 10, tip: 'Correct!' }]);

    const before = client0.getState()!.G as GameState;
    expect(before.scores['0']).toBeGreaterThan(0);
    expect(before.deckIndex).toBeGreaterThanOrEqual(0);

    client0.moves.resetGame();

    const after = client0.getState()!.G as GameState;
    expect(after.scores).toEqual({ '0': 0, '1': 0 });
    expect(after.deckIndex).toBe(-1);
    expect(after.currentCard).toBeNull();
    expect(after.responses).toEqual({});
    expect(after.claimedBy).toBeNull();
    expect(after.lastRoundResult).toBeNull();
  });
});
