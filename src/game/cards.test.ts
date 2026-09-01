import { STARTER_DECK, scoreQuickDraw, Card } from './cards';

describe('STARTER_DECK', () => {
  it('has 15 cards: 5 of each type, in QUICK_DRAW, STEELMAN, COMEBACK order', () => {
    expect(STARTER_DECK).toHaveLength(15);
    expect(STARTER_DECK.slice(0, 5).every((c) => c.type === 'QUICK_DRAW')).toBe(true);
    expect(STARTER_DECK.slice(5, 10).every((c) => c.type === 'STEELMAN')).toBe(true);
    expect(STARTER_DECK.slice(10, 15).every((c) => c.type === 'COMEBACK')).toBe(true);
  });

  it('every QUICK_DRAW card has choices and a valid correctChoiceIndex', () => {
    const quickDrawCards = STARTER_DECK.filter((c) => c.type === 'QUICK_DRAW');
    for (const card of quickDrawCards) {
      expect(card.choices?.length).toBeGreaterThan(1);
      expect(card.correctChoiceIndex).toBeGreaterThanOrEqual(0);
      expect(card.correctChoiceIndex).toBeLessThan(card.choices!.length);
    }
  });

  it('every card has a unique, non-empty id and prompt', () => {
    const ids = STARTER_DECK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of STARTER_DECK) {
      expect(card.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe('scoreQuickDraw', () => {
  const card: Card = {
    id: 'test-card',
    type: 'QUICK_DRAW',
    topic: 'test',
    prompt: 'Test prompt?',
    choices: ['A', 'B', 'C'],
    correctChoiceIndex: 1,
  };

  it('awards 10 points to players who chose the correct index', () => {
    const results = scoreQuickDraw(card, { '0': '1', '1': '0' });
    expect(results).toContainEqual({ playerID: '0', score: 10, tip: 'Correct!' });
  });

  it('awards 0 points and names the correct choice for wrong answers', () => {
    const results = scoreQuickDraw(card, { '1': '0' });
    expect(results).toContainEqual({
      playerID: '1',
      score: 0,
      tip: 'The correct answer was "B".',
    });
  });

  it('returns one result per response, regardless of how many players answered', () => {
    const results = scoreQuickDraw(card, { '0': '1' });
    expect(results).toHaveLength(1);
  });
});
