import type { Server as HttpServer } from 'http';
import path from 'path';
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

  it('returns 400 for a response longer than the length cap, without calling the referee', async () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const res = await request(baseUrl)
      .post('/referee/score')
      .send({ cardId: comebackCard.id, response: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(refereeService.scoreResponse).not.toHaveBeenCalled();
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

// A dedicated server/port per describe block below, rather than reusing the
// shared `server`/`baseUrl` above — both exercise things (a custom static
// directory, deliberately exhausting a rate limit) that must not leak into
// or be polluted by the other tests in this file, which all share one
// in-memory rate limiter keyed by IP and all originate from the same
// localhost address within this test process.

describe('static client serving', () => {
  let staticServer: ReturnType<typeof createServer>;
  let staticServers: { apiServer?: HttpServer; appServer: HttpServer };
  let staticBaseUrl: string;

  beforeAll(async () => {
    staticServer = createServer({ staticDir: path.join(__dirname, '__fixtures__/static') });
    staticServers = await staticServer.run(0);
    const address = staticServers.appServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error(`Expected appServer to be listening on a port, got: ${JSON.stringify(address)}`);
    }
    staticBaseUrl = `http://localhost:${address.port}`;
  });

  afterAll(() => {
    staticServer.kill(staticServers);
  });

  it('serves the built client for a page load at "/"', async () => {
    const res = await request(staticBaseUrl).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('fixture index for static-serving tests');
  });

  it('still serves the built client when the request carries game query params', async () => {
    // Every real screen in this app lives at "/" with a different query
    // string (?match=...&role=...), not a different path — static file
    // resolution must ignore the query string rather than 404 on it.
    const res = await request(staticBaseUrl).get('/?match=ABC123&role=host&playerID=2');
    expect(res.status).toBe(200);
    expect(res.text).toContain('fixture index for static-serving tests');
  });

  it('still lets an unmatched, non-file request reach boardgame.io\'s own lobby route', async () => {
    // The real regression this guards against: static-file middleware that
    // doesn't fall through to `next()` for a non-file path would shadow
    // every other route on the server, not just serve 404s for real assets.
    const res = await request(staticBaseUrl)
      .post('/games/apologetics/create')
      .send({ numPlayers: 2 });

    expect(res.status).toBe(200);
    expect(typeof res.body.matchID).toBe('string');
  });
});

describe('POST /referee/score rate limiting', () => {
  let limitedServer: ReturnType<typeof createServer>;
  let limitedServers: { apiServer?: HttpServer; appServer: HttpServer };
  let limitedBaseUrl: string;

  beforeAll(async () => {
    limitedServer = createServer();
    limitedServers = await limitedServer.run(0);
    const address = limitedServers.appServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error(`Expected appServer to be listening on a port, got: ${JSON.stringify(address)}`);
    }
    limitedBaseUrl = `http://localhost:${address.port}`;
  });

  afterAll(() => {
    limitedServer.kill(limitedServers);
  });

  afterEach(() => jest.resetAllMocks());

  it('rejects with 429 once one IP exceeds 10 requests within a minute', async () => {
    (refereeService.scoreResponse as jest.Mock).mockResolvedValue({ score: 5, tip: 'tip' });
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;

    for (let i = 0; i < 10; i++) {
      const res = await request(limitedBaseUrl)
        .post('/referee/score')
        .send({ cardId: comebackCard.id, response: `answer ${i}` });
      expect(res.status).toBe(200);
    }

    const eleventh = await request(limitedBaseUrl)
      .post('/referee/score')
      .send({ cardId: comebackCard.id, response: 'one too many' });

    expect(eleventh.status).toBe(429);
  });
});
