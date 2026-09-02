import { createRateLimiter } from './rateLimit';

function fakeContext(ip: string) {
  return { ip, status: 200, body: undefined as unknown } as any;
}

describe('createRateLimiter', () => {
  it('allows requests under the limit through', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const next = jest.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 3; i++) {
      const ctx = fakeContext('1.2.3.4');
      await limiter(ctx, next);
      expect(ctx.status).toBe(200);
    }
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('rejects with 429 once an IP exceeds the limit within the window', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const next = jest.fn().mockResolvedValue(undefined);

    await limiter(fakeContext('5.6.7.8'), next);
    await limiter(fakeContext('5.6.7.8'), next);
    const ctx = fakeContext('5.6.7.8');
    await limiter(ctx, next);

    expect(ctx.status).toBe(429);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('tracks each IP independently', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = jest.fn().mockResolvedValue(undefined);

    const ctxA1 = fakeContext('1.1.1.1');
    await limiter(ctxA1, next);
    const ctxB1 = fakeContext('2.2.2.2');
    await limiter(ctxB1, next);

    expect(ctxA1.status).toBe(200);
    expect(ctxB1.status).toBe(200);

    const ctxA2 = fakeContext('1.1.1.1');
    await limiter(ctxA2, next);
    expect(ctxA2.status).toBe(429);
  });

  it('resets the count once the window has passed', async () => {
    jest.useFakeTimers();
    try {
      const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
      const next = jest.fn().mockResolvedValue(undefined);

      await limiter(fakeContext('9.9.9.9'), next);
      const blocked = fakeContext('9.9.9.9');
      await limiter(blocked, next);
      expect(blocked.status).toBe(429);

      jest.advanceTimersByTime(1001);

      const afterWindow = fakeContext('9.9.9.9');
      await limiter(afterWindow, next);
      expect(afterWindow.status).toBe(200);
    } finally {
      jest.useRealTimers();
    }
  });
});
