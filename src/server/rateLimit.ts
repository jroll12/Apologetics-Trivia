import type { Middleware } from 'koa';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * A minimal in-memory, per-IP fixed-window limiter. Good enough for a small
 * party-game server (no Redis, no shared state across instances needed) —
 * its job is bounding worst-case Anthropic spend from a scripted abuser once
 * this server is reachable over the internet, not precise traffic shaping.
 */
export function createRateLimiter({ windowMs, max }: RateLimitOptions): Middleware {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (ctx, next) => {
    const key = ctx.ip;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count >= max) {
      ctx.status = 429;
      ctx.body = { error: 'Too many requests — please slow down.' };
      return;
    }

    entry.count += 1;
    await next();
  };
}
