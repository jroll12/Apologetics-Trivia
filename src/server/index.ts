import path from 'path';
import { Server, Origins, SocketIO } from 'boardgame.io/server';
import bodyParser from 'koa-bodyparser';
import serveStatic from 'koa-static';
import Anthropic from '@anthropic-ai/sdk';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';
import { scoreResponse, RefereeTimeoutError } from '../referee/refereeService';
import { createRateLimiter } from './rateLimit';

const PORT = Number(process.env.PORT) || 8000;

// A generous cap for a spoken/typed apologetics response — bounds the
// request body size (and therefore Anthropic token cost) an internet-facing
// deployment is exposed to, without getting in the way of any real answer.
const MAX_RESPONSE_LENGTH = 2000;

// Bounds worst-case Anthropic spend from a scripted abuser once this server
// is reachable over the internet. 10/minute per IP is far more than any
// real player calls this endpoint during a game night (once per round they
// respond to, at most), while capping a runaway script's blast radius.
const REFEREE_RATE_LIMIT = { windowMs: 60_000, max: 10 };

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Origins allowed to talk to this server (socket.io transport + lobby/referee
 * router).
 *
 * boardgame.io's `Origins.LOCALHOST` is only `/localhost:\d+/`, so a phone
 * loading the client over the host machine's LAN IP (e.g.
 * `http://192.168.1.42:5173`) is not an allowed origin — exactly the setup the
 * README tells hosts to use. Widen the allow-list to loopback plus, when the
 * host exports `HOST_LAN_IP`, that one specific address on any port.
 *
 * This is deliberately scoped to development / local playtests: the app has no
 * production deployment target yet, and nothing here opens the server to
 * arbitrary origins — an unset `HOST_LAN_IP` leaves behaviour exactly as it was.
 */
export function allowedOrigins(hostLanIp = process.env.HOST_LAN_IP): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [
    Origins.LOCALHOST,
    // `Origins.LOCALHOST` does not cover the numeric loopback address.
    /^https?:\/\/127\.0\.0\.1:\d+$/,
  ];

  if (hostLanIp) {
    origins.push(new RegExp(`^https?://${escapeForRegExp(hostLanIp)}(:\\d+)?$`));
  }

  return origins;
}

export interface CreateServerOptions {
  /** Directory of the built client (`vite build` output) to serve as static
   * files. Defaults to `dist-client` under the process's working directory
   * — resolved at call time via `process.cwd()`, not `__dirname`, so it
   * doesn't depend on how deep the compiled server output is nested.
   * Overridable so tests can point it at a small fixture directory instead
   * of requiring a real client build to exist. */
  staticDir?: string;
}

export function createServer({
  staticDir = path.join(process.cwd(), 'dist-client'),
}: CreateServerOptions = {}) {
  const server = Server({
    games: [ApologeticsGame],
    origins: allowedOrigins(),
    // Default socket.io behaviour starts every connection on HTTP long-
    // polling and later upgrades to a WebSocket. Behind Render's proxy (and
    // similar platforms), that long-poll never survives — the connection
    // gets cut and reconnects with a brand new session every few seconds,
    // so moves get lost mid-flight instead of ever reaching a stable
    // connection. Going straight to `websocket` (which Render's web
    // services support natively) skips the flaky long-poll phase entirely.
    // The client (`src/client/index.tsx`) must request the same transport.
    // `socketOpts`'s declared type is the full socket.io `ServerOptions`
    // interface rather than a `Partial<>` of it, even though socket.io
    // itself only needs the fields you actually pass. The `any` here
    // reflects a real, valid runtime value against an overly strict
    // ambient type, not an actual type-safety gap.
    transport: new SocketIO({ socketOpts: { transports: ['websocket'] } as any }),
  });

  // Render puts this server behind a reverse proxy, so the real client
  // address only arrives via `X-Forwarded-For`/`X-Forwarded-Proto`. Koa
  // ignores those headers unless told to trust the proxy, which without this
  // flag makes `ctx.ip` (and therefore the per-IP referee rate limiter below)
  // resolve to the proxy's own address for every request.
  server.app.proxy = true;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Serves the built client (index.html, JS/CSS bundles) for any request
  // that doesn't match a real file — which, in this app, means every page
  // load, since every screen lives at `/` with different query strings
  // (`?match=...&role=...`), not different paths. Mounted before `.run()`
  // ever wires up boardgame.io's own cors/secret/router middleware (see the
  // comment below on route-mount ordering), but that's fine here: unlike
  // that earlier bug, `koa-static` calls `next()` for any request that
  // doesn't resolve to a real file, so requests for `/games/*`, `/referee/*`,
  // and `/socket.io/*` correctly fall through to boardgame.io's own routing
  // rather than ever being short-circuited by this middleware.
  server.app.use(serveStatic(staticDir));

  const refereeRateLimiter = createRateLimiter(REFEREE_RATE_LIMIT);

  // Body parsing is attached directly to this route (not globally via
  // `server.app.use(bodyParser())`) to match how boardgame.io itself scopes
  // `koaBody()` to its own lobby routes (see `src/server/api.ts` in the
  // `boardgame.io` package). A request body stream can only be read once:
  // mounting koa-bodyparser globally on `server.app` was found to consume
  // the stream before boardgame.io's own lobby routes (e.g.
  // `POST /games/:name/create`) got to run their route-specific `koaBody()`
  // middleware, which then threw `stream is not readable` and turned every
  // lobby request into an HTTP 500. Scoping the parser to this route only
  // avoids touching the stream for any request this route doesn't handle.
  server.router.post('/referee/score', refereeRateLimiter, bodyParser(), async (ctx) => {
    const { cardId, response } = ctx.request.body as { cardId: string; response: string };
    const card = STARTER_DECK.find((c) => c.id === cardId);

    if (!card) {
      ctx.status = 400;
      ctx.body = { error: 'unknown card id' };
      return;
    }

    if (typeof response !== 'string' || response.length > MAX_RESPONSE_LENGTH) {
      ctx.status = 400;
      ctx.body = { error: `response must be a string of at most ${MAX_RESPONSE_LENGTH} characters` };
      return;
    }

    try {
      const result = await scoreResponse(anthropic, card, response);

      // Playtest observability: the spec's rollout criterion is "zero
      // brand-guardrail violations observed in referee output across the
      // playtest sample," but the tip is overwritten in the host UI on the
      // next round. One JSON line per scored response makes a whole session
      // reviewable afterwards from the server's stdout / log file. Nothing
      // fancier is warranted yet — no database, no rotation.
      console.log(
        JSON.stringify({
          event: 'referee_score',
          cardId,
          response,
          score: result.score,
          tip: result.tip,
        })
      );

      ctx.body = { timedOut: false, ...result };
    } catch (err) {
      if (err instanceof RefereeTimeoutError) {
        ctx.body = { timedOut: true };
        return;
      }
      throw err;
    }
  });

  return server;
}

if (require.main === module) {
  createServer().run(PORT);
  console.log(`Apologetics game server running on port ${PORT}`);
}
