/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HostBoard } from './HostBoard';
import { GameState } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';

function baseG(overrides: Partial<GameState> = {}): GameState {
  return {
    deck: STARTER_DECK,
    deckIndex: -1,
    currentCard: null,
    responses: {},
    claimedBy: null,
    scores: { '0': 0, '1': 0 },
    lastRoundResult: null,
    ...overrides,
  };
}

describe('HostBoard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a Draw Card button when there is no current card', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    render(<HostBoard G={baseG()} moves={moves as any} ctx={{} as any} />);

    fireEvent.click(screen.getByText('Draw Card'));
    expect(moves.drawCard).toHaveBeenCalled();
  });

  it('resolves a QUICK_DRAW round locally using scoreQuickDraw, without calling fetch', async () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(
      <HostBoard
        G={baseG({ currentCard: quickDrawCard, responses: { '0': String(quickDrawCard.correctChoiceIndex) } })}
        moves={moves as any}
        ctx={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '0', score: 10, tip: 'Correct!' },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves a COMEBACK round using the referee endpoint', async () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ timedOut: false, score: 8, tip: 'Great point.' }),
    } as Response);

    render(
      <HostBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1', responses: { '1': 'my answer' } })}
        moves={moves as any}
        ctx={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 8, tip: 'Great point.' },
    ]);
  });

  it('falls back to the manual score field if the referee times out', async () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ timedOut: true }),
    } as Response);

    render(
      <HostBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1', responses: { '1': 'my answer' } })}
        moves={moves as any}
        ctx={{} as any}
      />
    );

    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 6, tip: 'Scored by host (AI referee unavailable).' },
    ]);
  });
});
