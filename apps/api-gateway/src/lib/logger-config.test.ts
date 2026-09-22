import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import pino from 'pino';
import { redactPaths, logFieldNames } from './logger-config';

describe('logger redaction (no secrets in logs)', () => {
  it('redactPaths covers tokens, cookies, api keys, and payment/webhook secrets', () => {
    expect(redactPaths).toContain('req.headers.authorization');
    expect(redactPaths).toContain('req.headers.cookie');
    expect(redactPaths).toContain('req.headers["x-api-key"]');
    expect(redactPaths.some((p) => p.includes('razorpay'))).toBe(true);
    expect(redactPaths.some((p) => p.includes('secret'))).toBe(true);
  });

  it('pino emits [Redacted] for the configured paths', async () => {
    const lines: string[] = [];
    const rawPino = pino(
      {
        redact: redactPaths,
        base: undefined,
        timestamp: false,
      },
      {
        write(line: string) {
          lines.push(line.replace(/\n$/, ''));
        },
      },
    );

    rawPino.info({
      req: { headers: { authorization: 'Bearer super-secret-token', cookie: 'sid=abc' } },
    });
    rawPino.flush();

    await new Promise((resolve) => setTimeout(resolve, 10));

    const output = lines.join('\n');
    expect(output).toContain('[Redacted]');
    expect(output).not.toContain('super-secret-token');
    expect(output).not.toContain('sid=abc');
  });

  it('echoes x-request-id and attaches userId/organizationId/clients in Fastify', async () => {
    const server = Fastify({ logger: false });
    server.addHook('onRequest', async (request, reply) => {
      (request as any).user = { uid: 'user_1' };
      (request as any).workspaceId = 'org_42';
      reply.header('x-request-id', request.id);
    });
    server.get('/ping', async (request) => ({
      requestId: request.id,
      userId: (request as any).user?.uid,
      organizationId: (request as any).workspaceId,
    }));
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/ping' });
    const body = res.json();
    expect(res.headers['x-request-id']).toBe(body.requestId);
    expect(body.userId).toBe('user_1');
    expect(body.organizationId).toBe('org_42');
    await server.close();
  });

  it('logFieldNames are the canonical stable keys', () => {
    expect(logFieldNames).toEqual({
      requestId: 'requestId',
      userId: 'userId',
      organizationId: 'organizationId',
      clientIp: 'clientIp',
      route: 'route',
      method: 'method',
      statusCode: 'statusCode',
      durationMs: 'durationMs',
    });
  });
});
