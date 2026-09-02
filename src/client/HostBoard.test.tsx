/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
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
    render(<HostBoard G={baseG()} moves={moves as any} ctx={{} as any} playerID="2" />);

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
        playerID="2"
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
      ok: true,
      json: () => Promise.resolve({ timedOut: false, score: 8, tip: 'Great point.' }),
    } as Response);

    render(
      <HostBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1', responses: { '1': 'my answer' } })}
        moves={moves as any}
        ctx={{} as any}
        playerID="2"
      />
    );

    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 8, tip: 'Great point.' },
    ]);
  });

  // --- Referee-unavailable fallback ---------------------------------------
  //
  // The fallback is deliberately TWO steps. The host cannot know the referee
  // call is about to fail, so scoring the round on the first click would award
  // whatever happens to be in the manual-score box — i.e. 0 — with no second
  // chance. Every test below therefore asserts that the first click resolves
  // NOTHING, and that points are only awarded after an explicit confirmation.

  function renderFallbackCase(moves: { drawCard: jest.Mock; resolveRound: jest.Mock }) {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    render(
      <HostBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1', responses: { '1': 'my answer' } })}
        moves={moves as any}
        ctx={{} as any}
        playerID="2"
      />
    );
  }

  it('does NOT resolve the round when the referee times out — it asks the host for a score instead', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ timedOut: true }),
    } as Response);

    renderFallbackCase(moves);

    // No manual score typed — exactly the state a host is in when they click
    // "Resolve Round" not knowing the referee is about to fail.
    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() =>
      expect(screen.getByText(/AI referee unavailable/i)).toBeInTheDocument()
    );
    // This is the regression under test: a 0-point round must NOT have been
    // silently committed.
    expect(moves.resolveRound).not.toHaveBeenCalled();

    // The host now gets a real chance to enter a score.
    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Award Manual Score'));

    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 6, tip: 'Scored by host (AI referee unavailable).' },
    ]);
  });

  it('will not award a manual score until the host has actually entered one', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ timedOut: true }),
    } as Response);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));

    const awardButton = await screen.findByText('Award Manual Score');
    expect(awardButton).toBeDisabled();

    // Clicking it anyway (and with non-numeric input) must not score the round.
    fireEvent.click(awardButton);
    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: 'abc' } });
    fireEvent.click(awardButton);
    expect(moves.resolveRound).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: '0' } });
    expect(awardButton).not.toBeDisabled();
    fireEvent.click(awardButton);
    // An explicitly-typed 0 is a legitimate score — the point is that the host
    // chose it.
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 0, tip: 'Scored by host (AI referee unavailable).' },
    ]);
  });

  it('offers the manual-score path if the referee response is not ok (e.g. a 500 with a plain-text body)', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new SyntaxError('Unexpected token I in JSON at position 0')),
    } as unknown as Response);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() =>
      expect(screen.getByText(/AI referee unavailable/i)).toBeInTheDocument()
    );
    expect(moves.resolveRound).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: '9' } });
    fireEvent.click(screen.getByText('Award Manual Score'));
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 9, tip: 'Scored by host (AI referee unavailable).' },
    ]);
  });

  it('offers the manual-score path if the referee response is ok but has a malformed JSON body', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    } as unknown as Response);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() =>
      expect(screen.getByText(/AI referee unavailable/i)).toBeInTheDocument()
    );
    expect(moves.resolveRound).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Award Manual Score'));
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 4, tip: 'Scored by host (AI referee unavailable).' },
    ]);
  });

  it('lets the host retry the AI referee instead of scoring manually', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ timedOut: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ timedOut: false, score: 7, tip: 'Cite the empty tomb.' }),
      } as Response);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));

    const retryButton = await screen.findByText('Retry AI Referee');
    expect(retryButton).not.toBeDisabled();
    fireEvent.click(retryButton);

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 7, tip: 'Cite the empty tomb.' },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not let the host award a manual score while a referee retry is still in flight', async () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    let resolveRetry: (value: Response) => void;
    const retryPromise = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ timedOut: true }),
      } as Response)
      .mockReturnValueOnce(retryPromise);

    renderFallbackCase(moves);
    fireEvent.click(screen.getByText('Resolve Round'));

    const retryButton = await screen.findByText('Retry AI Referee');
    fireEvent.click(retryButton);

    // The retry is now in flight — its fetch promise hasn't settled yet.
    // A host who doesn't realize that and types a score anyway must not be
    // able to award it while the retry could still land and resolve the
    // same round a second time.
    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: '6' } });
    const awardButton = screen.getByText('Award Manual Score');
    await waitFor(() => expect(awardButton).toBeDisabled());
    fireEvent.click(awardButton);
    expect(moves.resolveRound).not.toHaveBeenCalled();

    // Now let the in-flight retry succeed.
    resolveRetry!({
      ok: true,
      json: () => Promise.resolve({ timedOut: false, score: 7, tip: 'Cite the empty tomb.' }),
    } as Response);

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledTimes(1);
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 7, tip: 'Cite the empty tomb.' },
    ]);
  });

  it('does not offer the manual-score path for QUICK_DRAW rounds, which never call the referee', async () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(
      <HostBoard
        G={baseG({ currentCard: quickDrawCard, responses: { '0': '3' } })}
        moves={moves as any}
        ctx={{} as any}
        playerID="2"
      />
    );

    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(screen.queryByText(/AI referee unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('manual score fallback')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows a game-over message instead of Draw Card once the deck is exhausted', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    render(
      <HostBoard
        G={baseG({
          deckIndex: STARTER_DECK.length - 1,
          currentCard: null,
          scores: { '0': 30, '1': 12, '2': 0 },
        })}
        moves={moves as any}
        ctx={{} as any}
        playerID="2"
      />
    );

    expect(screen.queryByText('Draw Card')).not.toBeInTheDocument();
    expect(screen.getByText(/all the cards/i)).toBeInTheDocument();
    // The final leaderboard is still on screen, relabelled as final.
    expect(screen.getByText('Final Scores')).toBeInTheDocument();
    expect(screen.getByText('Player 0: 30')).toBeInTheDocument();
    expect(screen.getByText('Player 1: 12')).toBeInTheDocument();
  });

  it('still offers Draw Card while cards remain in the deck', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    render(
      <HostBoard
        G={baseG({ deckIndex: STARTER_DECK.length - 2, currentCard: null })}
        moves={moves as any}
        ctx={{} as any}
        playerID="2"
      />
    );

    expect(screen.getByText('Draw Card')).toBeInTheDocument();
    expect(screen.queryByText(/all the cards/i)).not.toBeInTheDocument();
  });

  it('does not show the host itself as a leaderboard entry', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    render(
      <HostBoard
        G={baseG({ scores: { '0': 5, '1': 3, '2': 0 } })}
        moves={moves as any}
        ctx={{} as any}
        playerID="2"
      />
    );

    expect(screen.getByText('Player 0: 5')).toBeInTheDocument();
    expect(screen.getByText('Player 1: 3')).toBeInTheDocument();
    expect(screen.queryByText('Player 2: 0')).not.toBeInTheDocument();
  });
});
