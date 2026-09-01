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

  return server;
}

if (require.main === module) {
  createServer().run(PORT);
  console.log(`Apologetics game server running on port ${PORT}`);
}
