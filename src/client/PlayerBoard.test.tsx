/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerBoard } from './PlayerBoard';
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

describe('PlayerBoard', () => {
  it('shows a waiting message when no card has been drawn', () => {
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    render(<PlayerBoard G={baseG()} moves={moves as any} ctx={{} as any} playerID="0" />);
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it('submits the choice index for a QUICK_DRAW card', () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    render(
      <PlayerBoard
        G={baseG({ currentCard: quickDrawCard })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );

    fireEvent.click(screen.getByText(quickDrawCard.choices![0]));
    expect(moves.submitAnswer).toHaveBeenCalledWith('0');
  });

  it('shows a claim button first for a STEELMAN card, then a textarea after claiming', () => {
    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };

    const { rerender } = render(
      <PlayerBoard
        G={baseG({ currentCard: steelmanCard })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );

    fireEvent.click(screen.getByText("I'll answer this one"));
    expect(moves.claimRound).toHaveBeenCalled();

    rerender(
      <PlayerBoard
        G={baseG({ currentCard: steelmanCard, claimedBy: '0' })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );

    fireEvent.change(screen.getByLabelText('your response'), { target: { value: 'my argument' } });
    fireEvent.click(screen.getByText('Submit'));
    expect(moves.submitAnswer).toHaveBeenCalledWith('my argument');
  });

  it('shows a waiting message when another player has claimed the round', () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    render(
      <PlayerBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1' })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );
    expect(screen.getByText(/Player 1 is answering/i)).toBeInTheDocument();
  });
});
