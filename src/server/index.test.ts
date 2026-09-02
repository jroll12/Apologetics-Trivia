import type { Server as HttpServer } from 'http';
import request from 'supertest';
import { createServer, allowedOrigins } from './index';
import * as refereeService from '../referee/refereeService';
import { STARTER_DECK } from '../game/cards';

jest.mock('../referee/refereeService');

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

// `scripts/create-match.ts` depends entirely on this route, and it is the
// exact route an earlier global-bodyParser change broke (turning every lobby
// request into an HTTP 500). Nothing in the suite covered it until now, so
// re-introducing that class of bug would have gone unnoticed.
describe('POST /games/:name/create (boardgame.io lobby route)', () => {
  it('creates a match and returns a matchID', async () => {
    const res = await request(baseUrl)
      .post('/games/apologetics/create')
      .send({ numPlayers: 2 });

    expect(res.status).toBe(200);
    expect(typeof res.body.matchID).toBe('string');
    expect(res.body.matchID.length).toBeGreaterThan(0);
  });
});

describe('allowedOrigins', () => {
  function matches(origins: (string | RegExp)[], origin: string): boolean {
    return origins.some((o) => (o instanceof RegExp ? o.test(origin) : o === origin));
  }

  it('allows localhost and loopback with no LAN IP configured', () => {
    const origins = allowedOrigins(undefined);
    expect(matches(origins, 'http://localhost:5173')).toBe(true);
    expect(matches(origins, 'http://127.0.0.1:5173')).toBe(true);
  });

  it('rejects a LAN origin when HOST_LAN_IP is not set', () => {
    expect(matches(allowedOrigins(undefined), 'http://192.168.1.42:5173')).toBe(false);
  });

  it('allows the configured LAN IP on any port, so phones can connect', () => {
    const origins = allowedOrigins('192.168.1.42');
    expect(matches(origins, 'http://192.168.1.42:5173')).toBe(true);
    expect(matches(origins, 'http://192.168.1.42:8000')).toBe(true);
    // localhost must keep working alongside it.
    expect(matches(origins, 'http://localhost:5173')).toBe(true);
  });

  it('does not let the LAN IP pattern leak into a lookalike origin', () => {
    const origins = allowedOrigins('192.168.1.4');
    // The `.` must be escaped, so `192.168.1x4` must not match, and a
    // different host that merely contains the IP must not match either.
    expect(matches(origins, 'http://192.168.1x4:5173')).toBe(false);
    expect(matches(origins, 'http://evil.com/192.168.1.4:5173')).toBe(false);
    expect(matches(origins, 'http://192.168.1.42:5173')).toBe(false);
  });
});

describe('POST /referee/score', () => {
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

  // The spec's rollout criterion is "zero brand-guardrail violations observed
  // in referee output across the playtest sample" — impossible to check after
  // the fact unless the output is written somewhere, since the UI overwrites
  // the tip on the next round.
  it('logs each scored response so a playtest can be reviewed afterwards', async () => {
    (refereeService.scoreResponse as jest.Mock).mockResolvedValue({
      score: 7,
      tip: 'Mention the historical creed in 1 Corinthians 15.',
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    await request(baseUrl)
      .post('/referee/score')
      .send({ cardId: comebackCard.id, response: 'my answer' });

    const logged = logSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((line) => line.includes('referee_score'))
      .map((line) => JSON.parse(line));

    expect(logged).toContainEqual({
      event: 'referee_score',
      cardId: comebackCard.id,
      response: 'my answer',
      score: 7,
      tip: 'Mention the historical creed in 1 Corinthians 15.',
    });

    logSpy.mockRestore();
  });
});
