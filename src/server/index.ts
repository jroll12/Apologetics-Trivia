import { Server, Origins } from 'boardgame.io/server';
import bodyParser from 'koa-bodyparser';
import Anthropic from '@anthropic-ai/sdk';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';
import { scoreResponse, RefereeTimeoutError } from '../referee/refereeService';

const PORT = Number(process.env.PORT) || 8000;

export function createServer() {
  const server = Server({
    games: [ApologeticsGame],
    origins: [Origins.LOCALHOST],
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  server.router.post('/referee/score', bodyParser(), async (ctx) => {
    const { cardId, response } = ctx.request.body as { cardId: string; response: string };
    const card = STARTER_DECK.find((c) => c.id === cardId);

    if (!card) {
      ctx.status = 400;
      ctx.body = { error: 'unknown card id' };
      return;
    }

    try {
      const result = await scoreResponse(anthropic, card, response);
      ctx.body = { timedOut: false, ...result };
    } catch (err) {
      if (err instanceof RefereeTimeoutError) {
        ctx.body = { timedOut: true };
        return;
      }
      throw err;
    }
  });

  // boardgame.io's `Server()` only wires `router.routes()` onto `app` inside
  // `.run()` (via its internal `configureRouter`/`configureApp`). Since this
  // function deliberately does NOT call `.run()` — so callers (like our
  // tests) can drive `server.app.callback()` without binding a real port —
  // we have to mount the router ourselves or `/referee/score` is never
  // reachable. This mirrors what boardgame.io's `configureApp` does.
  //
  // When the real server IS started via `.run()` (see `require.main` below),
  // boardgame.io mounts `router.routes()` a second time internally. That's
  // harmless here: every handler on this router (ours and boardgame.io's
  // lobby routes) is a single-argument `async (ctx) => {...}` that never
  // calls `next()`, so per koa-compose semantics a matched request is fully
  // handled by whichever mount matches first and never reaches the second
  // one. Only unmatched paths pay a redundant (harmless) second pass through
  // the cors/api-secret middleware `.run()` adds. If this version of
  // boardgame.io changes that assumption, route handlers could double-fire.
  server.app.use(server.router.routes()).use(server.router.allowedMethods());

  return server;
}

if (require.main === module) {
  createServer().run(PORT);
  console.log(`Apologetics game server running on port ${PORT}`);
}
