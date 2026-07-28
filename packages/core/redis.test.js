import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { waitForRedisReady } from './redis.js';

describe('core Redis readiness', () => {
  it('waits for the ready event instead of treating startup as a cache miss', async () => {
    const client = new EventEmitter();
    client.status = 'connecting';

    const pending = waitForRedisReady(client, 1000);
    client.status = 'ready';
    client.emit('ready');

    await expect(pending).resolves.toBe(true);
  });

  it('returns immediately for an already-ready client', async () => {
    const client = new EventEmitter();
    client.status = 'ready';

    await expect(waitForRedisReady(client, 1000)).resolves.toBe(true);
  });
});
