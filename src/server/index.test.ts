import request from 'supertest';
import { createServer } from './index';
import * as refereeService from '../referee/refereeService';
import { STARTER_DECK } from '../game/cards';

jest.mock('../referee/refereeService');

describe('POST /referee/score', () => {
  const server = createServer();
  const app = server.app.callback();

  afterEach(() => jest.resetAllMocks());

  it('returns the referee score for a known card', async () => {
    (refereeService.scoreResponse as jest.Mock).mockResolvedValue({
      score: 7,
      tip: 'Mention the historical creed in 1 Corinthians 15.',
    });

    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const res = await request(app)
      .post('/referee/score')
      .send({ cardId: comebackCard.id, response: 'my answer' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      timedOut: false,
      score: 7,
      tip: 'Mention the historical creed in 1 Corinthians 15.',
    });
  });

  it('returns 400 for an unknown card id', async () => {
    const res = await request(app)
      .post('/referee/score')
      .send({ cardId: 'not-a-real-card', response: 'my answer' });

    expect(res.status).toBe(400);
  });

  it('returns { timedOut: true } if the referee service throws RefereeTimeoutError', async () => {
    (refereeService.scoreResponse as jest.Mock).mockRejectedValue(
      new refereeService.RefereeTimeoutError('timed out')
    );

    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const res = await request(app)
      .post('/referee/score')
      .send({ cardId: steelmanCard.id, response: 'x' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timedOut: true });
  });
});
