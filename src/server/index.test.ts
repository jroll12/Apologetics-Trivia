import type { Server as HttpServer } from 'http';
import request from 'supertest';
import { createServer } from './index';
import * as refereeService from '../referee/refereeService';
import { STARTER_DECK } from '../game/cards';

jest.mock('../referee/refereeService');

describe('POST /referee/score', () => {
  let server: ReturnType<typeof createServer>;
  let servers: { apiServer?: HttpServer; appServer: HttpServer };
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer();
    // Bind to an OS-assigned ephemeral port (the standard Node.js pattern for
    // test servers) rather than driving `server.app.callback()` directly.
    // boardgame.io only wires cors()/the API-secret check/its own lobby
    // routes onto the app from inside `run()`, so exercising the route
    // without actually calling `run()` would bypass that middleware entirely.
    servers = await server.run(0);
    const address = servers.appServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error(`Expected appServer to be listening on a port, got: ${JSON.stringify(address)}`);
    }
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(() => {
    server.kill(servers);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns the referee score for a known card', async () => {
    (refereeService.scoreResponse as jest.Mock).mockResolvedValue({
      score: 7,
      tip: 'Mention the historical creed in 1 Corinthians 15.',
    });

    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const res = await request(baseUrl)
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
    const res = await request(baseUrl)
      .post('/referee/score')
      .send({ cardId: 'not-a-real-card', response: 'my answer' });

    expect(res.status).toBe(400);
  });

  it('returns { timedOut: true } if the referee service throws RefereeTimeoutError', async () => {
    (refereeService.scoreResponse as jest.Mock).mockRejectedValue(
      new refereeService.RefereeTimeoutError('timed out')
    );

    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const res = await request(baseUrl)
      .post('/referee/score')
      .send({ cardId: steelmanCard.id, response: 'x' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timedOut: true });
  });
});
