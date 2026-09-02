/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerBoard } from './PlayerBoard';
import { GameState } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';

const MATCH_ID = 'ABC123XYZ';

function baseG(overrides: Partial<GameState> = {}): GameState {
  return {
    deck: STARTER_DECK,
    deckIndex: -1,
    currentCard: null,
    responses: {},
    claimedBy: null,
    scores: { '0': 0, '1': 0, '2': 0 },
    lastRoundResult: null,
    ...overrides,
  };
}

function renderPlayer(
  G: GameState,
  moves: { submitAnswer: jest.Mock; claimRound: jest.Mock },
  playerID = '0'
) {
  return render(<PlayerBoard G={G} moves={moves as any} matchID={MATCH_ID} playerID={playerID} />);
}

describe('PlayerBoard — waiting states', () => {
  it('shows a pre-game waiting message before the host has drawn a card', () => {
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(baseG(), moves);
    expect(screen.getByText("You're in, Player 0")).toBeInTheDocument();
    expect(screen.getByText(/start the game/i)).toBeInTheDocument();
  });

  it('shows a between-rounds waiting message once the game is underway', () => {
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(baseG({ deckIndex: 2, currentCard: null }), moves);
    expect(screen.getByText(/waiting for the host to continue/i)).toBeInTheDocument();
  });
});

describe('PlayerBoard — Quick Draw', () => {
  it('submits the tapped choice and shows it locked in', () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(baseG({ currentCard: quickDrawCard }), moves);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(quickDrawCard.choices![0]) }));
    expect(moves.submitAnswer).toHaveBeenCalledWith('0');
  });

  it('shows the locked-in choice and disables the other tiles once G reflects a submitted answer', () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(baseG({ currentCard: quickDrawCard, responses: { '0': '1' } }), moves);

    expect(screen.getByText(new RegExp(`Answer locked in.*${quickDrawCard.choices![1]}`))).toBeInTheDocument();
    const otherTile = screen.getByRole('button', { name: new RegExp(quickDrawCard.choices![0]) });
    expect(otherTile).toBeDisabled();
  });
});

describe('PlayerBoard — Steelman / Comeback claim then respond', () => {
  it('shows a claim button before anyone has claimed the round', () => {
    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(baseG({ currentCard: steelmanCard }), moves);

    fireEvent.click(screen.getByText("I'll answer this one"));
    expect(moves.claimRound).toHaveBeenCalled();
  });

  it('shows a labeled response box and submits free text after claiming', () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(baseG({ currentCard: comebackCard, claimedBy: '0' }), moves);

    const textarea = screen.getByLabelText('Your response');
    fireEvent.change(textarea, { target: { value: 'my argument' } });
    fireEvent.click(screen.getByText('Submit response'));
    expect(moves.submitAnswer).toHaveBeenCalledWith('my argument');
  });

  it('shows a waiting message once this player has submitted', () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(
      baseG({ currentCard: comebackCard, claimedBy: '0', responses: { '0': 'my argument' } }),
      moves
    );

    expect(screen.getByText(/response submitted/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your response')).not.toBeInTheDocument();
  });

  it('shows a neutral (non-violet) waiting state when someone else has claimed the round', () => {
    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    renderPlayer(baseG({ currentCard: steelmanCard, claimedBy: '1' }), moves, '0');

    expect(screen.getByText('Player 1 is answering this one')).toBeInTheDocument();
    expect(screen.queryByText("I'll answer this one")).not.toBeInTheDocument();
  });
});
