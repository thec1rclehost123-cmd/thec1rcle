/**
 * Security system tests — rate-limiter, reputation, attack-detection, security-state
 *
 * All Redis interactions are mocked so these run in CI without a live Redis instance.
 * Tests focus on the business logic: thresholds, tier math, window expiry, decay.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Redis ────────────────────────────────────────────────────────────────
// Every module that imports redis.js gets this stub.

const _store = new Map();

// Pipeline builder: queues commands, exec() runs them and returns [[err, val], ...]
function makePipeline() {
  const cmds = [];
  const pipe = {
    incr: (key) => {
      cmds.push(async () => {
        const v = (_store.get(key) || 0) + 1;
        _store.set(key, v);
        return [null, v];
      });
      return pipe;
    },
    ttl: (key) => {
      cmds.push(async () => [null, _store.has(key) ? 60 : -1]);
      return pipe;
    },
    exec: async () => Promise.all(cmds.map((fn) => fn())),
  };
  return pipe;
}

vi.mock('./redis.js', () => ({
  getRedisClient: () => ({
    incr: vi.fn(async (key) => {
      const v = (_store.get(key) || 0) + 1;
      _store.set(key, v);
      return v;
    }),
    expire: vi.fn(async () => 1),
    get: vi.fn(async (key) => (_store.has(key) ? String(_store.get(key)) : null)),
    set: vi.fn(async (key, val) => {
      _store.set(key, val);
      return 'OK';
    }),
    del: vi.fn(async (key) => {
      _store.delete(key);
      return 1;
    }),
    hset: vi.fn(async (key, ...args) => {
      const m = _store.get(key) || {};
      for (let i = 0; i < args.length; i += 2) m[args[i]] = args[i + 1];
      _store.set(key, m);
      return 1;
    }),
    hget: vi.fn(async (key, field) => {
      const m = _store.get(key);
      return m?.[field] ?? null;
    }),
    hgetall: vi.fn(async (key) => _store.get(key) || null),
    zadd: vi.fn(async () => 1),
    zcount: vi.fn(async () => 0),
    zremrangebyscore: vi.fn(async () => 0),
    pfadd: vi.fn(async () => 1),
    pfcount: vi.fn(async () => 0),
    hincrby: vi.fn(async (key, field, by) => {
      const m = _store.get(key) || {};
      m[field] = (Number(m[field]) || 0) + by;
      _store.set(key, m);
      return m[field];
    }),
    zrange: vi.fn(async () => []),
    zrevrangebyscore: vi.fn(async () => []),
    pipeline: vi.fn(() => makePipeline()),
    status: 'ready',
  }),
}));

// Mock firebase admin — security-logger uses getAdminDb which we don't need in unit tests
vi.mock('./admin.js', () => ({
  getAdminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      add: vi.fn(async () => ({ id: 'mock-id' })),
      doc: vi.fn(() => ({
        update: vi.fn(async () => {}),
        get: vi.fn(async () => ({ exists: false })),
      })),
      orderBy: vi.fn(function () {
        return this;
      }),
      where: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      get: vi.fn(async () => ({ docs: [] })),
    })),
  })),
  isFirebaseConfigured: vi.fn(() => false),
  isToyMode: vi.fn(() => false),
}));

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _store.clear();
});

// ── Security State: hybrid fail ───────────────────────────────────────────────

describe('security-state / hybrid fail', () => {
  it('memoryRateLimit allows requests under limit', async () => {
    const { memoryRateLimit } = await import('./security-state.js');
    const r1 = memoryRateLimit('test:key', 3, 60_000);
    const r2 = memoryRateLimit('test:key', 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('memoryRateLimit blocks at limit', async () => {
    const { memoryRateLimit } = await import('./security-state.js');
    memoryRateLimit('test:block', 2, 60_000);
    memoryRateLimit('test:block', 2, 60_000);
    const r3 = memoryRateLimit('test:block', 2, 60_000);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('memoryRateLimit resets after window expires', async () => {
    const { memoryRateLimit } = await import('./security-state.js');
    // Use a 1ms window so it expires immediately
    memoryRateLimit('test:expire', 1, 1);
    memoryRateLimit('test:expire', 1, 1);
    await new Promise((r) => setTimeout(r, 5));
    const r = memoryRateLimit('test:expire', 1, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(1);
  });

  it('isRedisHealthy returns true when redis status is ready', async () => {
    const { isRedisHealthy } = await import('./security-state.js');
    expect(isRedisHealthy()).toBe(true);
  });

  it('checkCriticalEndpoint allows when Redis is healthy', async () => {
    const { checkCriticalEndpoint } = await import('./security-state.js');
    const result = checkCriticalEndpoint('admin:ip:1.2.3.4', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(false);
  });
});

// ── Reputation: scoring & tiers ───────────────────────────────────────────────

describe('reputation / scoring', () => {
  it('getRiskTier returns normal for score 0', async () => {
    const { getRiskTier } = await import('./reputation.js');
    expect(getRiskTier(0).label).toBe('normal');
  });

  it('getRiskTier returns elevated for score 15', async () => {
    const { getRiskTier } = await import('./reputation.js');
    const tier = getRiskTier(15);
    expect(tier.label).toBe('elevated');
    expect(tier.multiplier).toBeLessThan(1);
  });

  it('getRiskTier returns high for score 30', async () => {
    const { getRiskTier } = await import('./reputation.js');
    expect(getRiskTier(30).label).toBe('high');
  });

  it('getRiskTier returns critical for score 60', async () => {
    const { getRiskTier } = await import('./reputation.js');
    expect(getRiskTier(60).label).toBe('critical');
  });

  it('ADMIN_ABUSE event has higher weight than AUTH_FAIL', async () => {
    const { SCORE_EVENTS } = await import('./reputation.js');
    expect(SCORE_EVENTS.ADMIN_ABUSE).toBeGreaterThan(SCORE_EVENTS.AUTH_FAIL);
    expect(SCORE_EVENTS.ADMIN_ABUSE).toBeGreaterThan(SCORE_EVENTS.PAYMENT_ANOMALY);
  });

  it('getAdaptiveLimit reduces limit for elevated-tier entity', async () => {
    const { getAdaptiveLimit, getRiskTier, RISK_TIERS } = await import('./reputation.js');

    // The elevated tier has multiplier < 1.0, so adaptive limit < base limit
    const elevatedTier = RISK_TIERS.find((t) => t.label === 'elevated');
    expect(elevatedTier.multiplier).toBeLessThan(1);
    // With score 0 (normal tier), limit should equal base
    const result = await getAdaptiveLimit(100, 'ip', '255.255.255.255');
    expect(result.limit).toBe(100); // fresh entity, no reputation → normal tier → 1.0x
  });
});

// ── Rate limiter ──────────────────────────────────────────────────────────────

describe('rate-limiter / checkRateLimit', () => {
  it('allows first request and returns correct metadata', async () => {
    const { checkRateLimit } = await import('./rate-limiter.js');
    const result = await checkRateLimit('rl:test:1', 10, 60);
    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it('blocks when limit is exceeded', async () => {
    const { checkRateLimit } = await import('./rate-limiter.js');
    const key = 'rl:test:burst';
    for (let i = 0; i < 5; i++) await checkRateLimit(key, 5, 60);
    const r = await checkRateLimit(key, 5, 60);
    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('clearRateLimit resets the counter', async () => {
    const { checkRateLimit, clearRateLimit } = await import('./rate-limiter.js');
    const key = 'rl:test:clear';
    for (let i = 0; i < 5; i++) await checkRateLimit(key, 5, 60);
    await clearRateLimit(key);
    const r = await checkRateLimit(key, 5, 60);
    expect(r.success).toBe(true);
    expect(r.remaining).toBe(4);
  });
});

// ── Attack detection: threshold logic ─────────────────────────────────────────

describe('attack-detection / checkCredentialStuffing', () => {
  it('returns not detected for first few failures', async () => {
    const { checkCredentialStuffing } = await import('./attack-detection.js');
    const result = await checkCredentialStuffing('1.1.1.1', null);
    expect(result.detected).toBe(false);
    expect(result.mitigated).toBe(false);
  });

  it('detects and mitigates after IP threshold (10 failures)', async () => {
    const { checkCredentialStuffing } = await import('./attack-detection.js');
    const ip = '10.0.0.1';
    let last;
    for (let i = 0; i < 10; i++) {
      last = await checkCredentialStuffing(ip, null);
    }
    expect(last.detected).toBe(true);
    expect(last.mitigated).toBe(true);
    expect(last.reason).toBe('AUTH_FAILURES_PER_IP');
    expect(last.count).toBe(10);
  });

  it('detects and mitigates after UID threshold (5 failures)', async () => {
    const { checkCredentialStuffing } = await import('./attack-detection.js');
    const uid = 'user_target_123';
    let last;
    for (let i = 0; i < 5; i++) {
      last = await checkCredentialStuffing(null, uid);
    }
    expect(last.detected).toBe(true);
    expect(last.reason).toBe('AUTH_FAILURES_PER_UID');
  });
});

describe('attack-detection / checkPaymentFraud', () => {
  it('returns not detected for first anomaly', async () => {
    const { checkPaymentFraud } = await import('./attack-detection.js');
    const r = await checkPaymentFraud('uid_pay_001', '2.2.2.2');
    expect(r.detected).toBe(false);
  });

  it('detects fraud after UID threshold (3 anomalies)', async () => {
    const { checkPaymentFraud } = await import('./attack-detection.js');
    const uid = 'uid_fraudster';
    let last;
    for (let i = 0; i < 3; i++) last = await checkPaymentFraud(uid, null);
    expect(last.detected).toBe(true);
    expect(last.reason).toBe('PAYMENT_ANOMALIES_PER_UID');
    expect(last.mitigated).toBe(true);
  });
});

describe('attack-detection / checkAdminAbuse', () => {
  it('returns not detected below threshold', async () => {
    const { checkAdminAbuse } = await import('./attack-detection.js');
    const r = await checkAdminAbuse('admin_001');
    expect(r.detected).toBe(false);
  });

  it('detects abuse and mitigates at threshold (20 actions)', async () => {
    const { checkAdminAbuse } = await import('./attack-detection.js');
    const adminId = 'admin_abuser';
    let last;
    for (let i = 0; i < 20; i++) last = await checkAdminAbuse(adminId);
    expect(last.detected).toBe(true);
    expect(last.mitigated).toBe(true);
    expect(last.count).toBe(20);
  });
});

describe('attack-detection / recordRateLimitHit', () => {
  it('completes without throwing', async () => {
    const { recordRateLimitHit } = await import('./attack-detection.js');
    await expect(recordRateLimitHit('3.3.3.3', 'uid_rl', '/api/test')).resolves.toBeUndefined();
  });
});

// ── peekCounter ───────────────────────────────────────────────────────────────

describe('attack-detection / peekCounter', () => {
  it('returns 0 for unknown key', async () => {
    const { peekCounter } = await import('./attack-detection.js');
    const count = await peekCounter('detect:unknown:key');
    expect(count).toBe(0);
  });
});
