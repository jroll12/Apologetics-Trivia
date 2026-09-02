/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { HostBoard } from './HostBoard';
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

function renderHost(G: GameState, moves: { drawCard: jest.Mock; resolveRound: jest.Mock; claimRound?: jest.Mock; submitAnswer?: jest.Mock }) {
  return render(<HostBoard G={G} moves={moves as any} matchID={MATCH_ID} playerID="2" />);
}

describe('HostBoard — lobby', () => {
  it('shows the room code and a Start game button before the game has started', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(baseG(), moves);

    expect(screen.getAllByText('ABC123').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Start game'));
    expect(moves.drawCard).toHaveBeenCalled();
  });

  it('does not show the host itself in the lobby player pills', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(baseG(), moves);

    expect(screen.getByText('Player 0')).toBeInTheDocument();
    expect(screen.getByText('Player 1')).toBeInTheDocument();
    expect(screen.queryByText('Player 2')).not.toBeInTheDocument();
  });
});

describe('HostBoard — Quick Draw', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the question and all 4 answer choices', () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(baseG({ deckIndex: 0, currentCard: quickDrawCard }), moves);

    expect(screen.getByText(quickDrawCard.prompt)).toBeInTheDocument();
    quickDrawCard.choices!.forEach((choice) => {
      expect(screen.getByText(choice)).toBeInTheDocument();
    });
  });

  it('auto-resolves locally via scoreQuickDraw when the countdown reaches zero, without calling fetch', async () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    const fetchSpy = jest.spyOn(global, 'fetch');

    renderHost(
      baseG({
        deckIndex: 0,
        currentCard: quickDrawCard,
        responses: { '0': String(quickDrawCard.correctChoiceIndex) },
      }),
      moves
    );

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '0', score: 10, tip: 'Correct!' },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('HostBoard — Steelman', () => {
  it('shows an unclaimed message before anyone claims the round', () => {
    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(baseG({ deckIndex: 5, currentCard: steelmanCard }), moves);

    expect(screen.getByText(/waiting for someone to claim/i)).toBeInTheDocument();
  });

  it('shows who claimed the round and lets the host resolve it manually', async () => {
    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ timedOut: false, score: 8, tip: 'Cite the free will defense.' }),
    } as Response);

    renderHost(
      baseG({ deckIndex: 5, currentCard: steelmanCard, claimedBy: '1', responses: { '1': 'my argument' } }),
      moves
    );

    expect(screen.getByText('Player 1 claimed this round')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Resolve Round'));
    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 8, tip: 'Cite the free will defense.' },
    ]);
  });
});

describe('HostBoard — Comeback', () => {
  it('shows the responder and a pending progress state before a response arrives', () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(baseG({ deckIndex: 10, currentCard: comebackCard, claimedBy: '0' }), moves);

    expect(screen.getByText('Player 0 is responding')).toBeInTheDocument();
    expect(screen.getByText('Response pending')).toBeInTheDocument();
  });

  it('shows a received state once the responder has submitted', () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(
      baseG({ deckIndex: 10, currentCard: comebackCard, claimedBy: '0', responses: { '0': 'my answer' } }),
      moves
    );

    expect(screen.getByText('Response received')).toBeInTheDocument();
  });
});

describe('HostBoard — referee-unavailable fallback', () => {
  function renderFallbackCase(moves: { drawCard: jest.Mock; resolveRound: jest.Mock }) {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    renderHost(
      baseG({ deckIndex: 10, currentCard: comebackCard, claimedBy: '1', responses: { '1': 'my answer' } }),
      moves
    );
  }

  it('does NOT resolve the round on referee failure — it offers a manual stepper instead', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ timedOut: true }),
    } as Response);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(screen.getByText(/AI referee is offline/i)).toBeInTheDocument());
    expect(moves.resolveRound).not.toHaveBeenCalled();

    // Stepper defaults to 5 and steps by 1, clamped 0-10.
    expect(screen.getByText('5')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Increase score'));
    fireEvent.click(screen.getByLabelText('Increase score'));
    fireEvent.click(screen.getByText('Award points'));

    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 7, tip: 'Scored by host (AI referee unavailable).' },
    ]);
  });

  it('clamps the manual score stepper to 0-10', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ timedOut: true }),
    } as Response);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));
    await screen.findByText(/AI referee is offline/i);

    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByLabelText('Increase score'));
    }
    expect(screen.getByText('10')).toBeInTheDocument();

    for (let i = 0; i < 15; i++) {
      fireEvent.click(screen.getByLabelText('Decrease score'));
    }
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('does not let the host award a manual score while a referee retry is still in flight', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    let resolveRetry: (value: Response) => void;
    const retryPromise = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ timedOut: true }) } as Response)
      .mockReturnValueOnce(retryPromise);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));

    const retryButton = await screen.findByText('Retry AI referee');
    fireEvent.click(retryButton);

    const awardButton = screen.getByText('Award points');
    await waitFor(() => expect(awardButton).toBeDisabled());
    fireEvent.click(awardButton);
    expect(moves.resolveRound).not.toHaveBeenCalled();

    resolveRetry!({
      ok: true,
      json: () => Promise.resolve({ timedOut: false, score: 6, tip: 'Cite the empty tomb.' }),
    } as Response);

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledTimes(1);
  });
});

describe('HostBoard — round resolved / leaderboard', () => {
  it('shows the leaderboard with a delta for the player who just scored', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(
      baseG({
        deckIndex: 0,
        currentCard: null,
        scores: { '0': 10, '1': 0, '2': 0 },
        lastRoundResult: [{ playerID: '0', score: 10, tip: 'Correct!' }],
      }),
      moves
    );

    const row = screen.getByText('Player 0').closest('li')!;
    expect(row).toHaveTextContent('10');
    expect(screen.getByText('+10')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next round'));
    expect(moves.drawCard).toHaveBeenCalled();
  });

  it('shows the AI referee tip banner for a real referee score, not for a manual fallback score', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(
      baseG({
        deckIndex: 10,
        currentCard: null,
        scores: { '0': 8, '1': 0, '2': 0 },
        lastRoundResult: [{ playerID: '0', score: 8, tip: 'Source note: mirrors the free will defense.' }],
      }),
      moves
    );

    expect(screen.getByText('AI Referee')).toBeInTheDocument();
    expect(screen.getByText('Source note: mirrors the free will defense.')).toBeInTheDocument();
  });

  it('does not show the AI referee tip banner after a manually-scored round', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(
      baseG({
        deckIndex: 10,
        currentCard: null,
        scores: { '0': 6, '1': 0, '2': 0 },
        lastRoundResult: [{ playerID: '0', score: 6, tip: 'Scored by host (AI referee unavailable).' }],
      }),
      moves
    );

    expect(screen.queryByText('AI Referee')).not.toBeInTheDocument();
  });

  it('does not show the AI referee tip banner after a Quick Draw round', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(
      baseG({
        deckIndex: 0,
        currentCard: null,
        scores: { '0': 10, '1': 0, '2': 0 },
        lastRoundResult: [{ playerID: '0', score: 10, tip: 'Correct!' }],
      }),
      moves
    );

    expect(screen.queryByText('AI Referee')).not.toBeInTheDocument();
  });
});

describe('HostBoard — game over', () => {
  it('shows a winner spotlight and runner-up list once the deck is exhausted', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    renderHost(
      baseG({
        deckIndex: STARTER_DECK.length - 1,
        currentCard: null,
        scores: { '0': 30, '1': 12, '2': 0 },
      }),
      moves
    );

    expect(screen.getByText('Game over')).toBeInTheDocument();
    expect(screen.getByText('Player 0')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    const runnerUpRow = screen.getByText('Player 1').closest('li')!;
    expect(runnerUpRow).toHaveTextContent('12');
    expect(screen.queryByText('Draw Card')).not.toBeInTheDocument();
  });
});
