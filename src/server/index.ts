import { Server, Origins } from 'boardgame.io/server';
import bodyParser from 'koa-bodyparser';
import Anthropic from '@anthropic-ai/sdk';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';
import { scoreResponse, RefereeTimeoutError } from '../referee/refereeService';

const PORT = Number(process.env.PORT) || 8000;

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

export function createServer() {
  const server = Server({
    games: [ApologeticsGame],
    origins: allowedOrigins(),
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
