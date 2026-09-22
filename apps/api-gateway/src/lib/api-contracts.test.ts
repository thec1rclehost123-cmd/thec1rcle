import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { z } from 'zod';
import {
  buildErrorResponse,
  buildValidationDetails,
  buildV2ErrorResponse,
  errorCodeForStatus,
  V2_STATUS_CODE_TO_ERROR_CODE,
  zodToFieldErrors,
} from './api-contracts';
import { genReqId, onRequestHook } from './request-tracing';

describe('api-contracts (V1, frozen)', () => {
  it('builds the standard nested error response shape', () => {
    expect(
      buildErrorResponse({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        requestId: 'req_123',
      }),
    ).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        requestId: 'req_123',
      },
    });
  });

  it('normalizes zod issues into path/message pairs', () => {
    expect(
      buildValidationDetails([{ path: ['body', 'items', 0, 'tierId'], message: 'Required' }]),
    ).toEqual([{ path: 'body.items.0.tierId', message: 'Required' }]);
  });
});

describe('V2 status → code mapping (locked)', () => {
  it('covers every mapped status', () => {
    expect(V2_STATUS_CODE_TO_ERROR_CODE).toEqual({
      400: 'validation',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      422: 'validation',
      429: 'rate_limited',
    });
  });

  it('maps all statuses to the contract codes', () => {
    expect(errorCodeForStatus(400)).toBe('validation');
    expect(errorCodeForStatus(422)).toBe('validation');
    expect(errorCodeForStatus(401)).toBe('unauthorized');
    expect(errorCodeForStatus(403)).toBe('forbidden');
    expect(errorCodeForStatus(404)).toBe('not_found');
    expect(errorCodeForStatus(409)).toBe('conflict');
    expect(errorCodeForStatus(429)).toBe('rate_limited');
  });

  it('maps every server error to server and unknown statuses to unknown', () => {
    for (const status of [500, 502, 503, 504, 599]) {
      expect(errorCodeForStatus(status)).toBe('server');
    }
    expect(errorCodeForStatus(301)).toBe('unknown');
    expect(errorCodeForStatus(499)).toBe('unknown');
  });

  it('frontend statusToErrorCode parity: 400/422→validation, 401→unauthorized, 403→forbidden, 404→not_found, 409→conflict, 429→rate_limited, ≥500→server', () => {
    const clientSide: Record<number, string> = {
      400: 'validation',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      422: 'validation',
      429: 'rate_limited',
    };
    for (const [status, code] of Object.entries(clientSide)) {
      expect(errorCodeForStatus(Number(status))).toBe(code);
    }
    expect(errorCodeForStatus(500)).toBe('server');
    expect(errorCodeForStatus(503)).toBe('server');
  });
});

describe('zodToFieldErrors', () => {
  it('flattens zod issues into { field: string[] }', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.email('Invalid email'),
      nested: z.object({ items: z.array(z.string().min(2, 'Too short')) }),
    });
    const result = schema.safeParse({ name: '', email: 'nope', nested: { items: ['a'] } });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(zodToFieldErrors(result.error)).toEqual({
      name: ['Name is required'],
      email: ['Invalid email'],
      'nested.items.0': ['Too short'],
    });
  });

  it('uses _root for issues with no path', () => {
    const schema = z.union([z.string(), z.number()], { error: 'Must be string or number' });
    const result = schema.safeParse(true);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(zodToFieldErrors(result.error)).toEqual({ _root: ['Must be string or number'] });
  });

  it('emits empty object for an empty issue list', () => {
    expect(zodToFieldErrors(new z.ZodError([]))).toEqual({});
  });
});

describe('buildV2ErrorResponse', () => {
  it('derives code from status when absent', () => {
    expect(buildV2ErrorResponse({ status: 422, message: 'Validation failed' })).toEqual({
      status: 422,
      code: 'validation',
      message: 'Validation failed',
    });
  });

  it('honors an explicit code', () => {
    expect(
      buildV2ErrorResponse({
        status: 403,
        code: 'forbidden',
        message: 'Not allowed',
        requestId: 'req_abc',
        fieldErrors: { orgId: ['Not yours'] },
      }),
    ).toEqual({
      status: 403,
      code: 'forbidden',
      message: 'Not allowed',
      requestId: 'req_abc',
      fieldErrors: { orgId: ['Not yours'] },
    });
  });

  it('omits empty fieldErrors and optional details', () => {
    expect(
      buildV2ErrorResponse({
        status: 500,
        code: 'server',
        message: 'Internal error',
        fieldErrors: {},
      }),
    ).toEqual({ status: 500, code: 'server', message: 'Internal error' });
    expect(
      buildV2ErrorResponse({
        status: 409,
        code: 'conflict',
        message: 'Version conflict',
        details: { expectedVersion: 2, currentVersion: 3 },
      }).details,
    ).toEqual({ expectedVersion: 2, currentVersion: 3 });
  });

  it('emits the backend-owned ApiError shape the frontend consumes', () => {
    const body = buildV2ErrorResponse({
      status: 429,
      message: 'Rate limited',
      requestId: 'req_id',
    });
    expect(Object.keys(body).sort()).toEqual(['code', 'message', 'requestId', 'status']);
  });
});

describe('request tracing (x-request-id)', () => {
  async function buildTracingServer() {
    const server = Fastify({ logger: false, genReqId });
    server.addHook('onRequest', onRequestHook);
    server.get('/ping', async () => ({ ok: true }));
    await server.ready();
    return server;
  }

  it('echos a client-supplied x-request-id', async () => {
    const server = await buildTracingServer();
    const res = await server.inject({
      method: 'GET',
      url: '/ping',
      headers: { 'x-request-id': 'client_req_42' },
    });
    expect(res.headers['x-request-id']).toBe('client_req_42');
    await server.close();
  });

  it('mints an id when absent', async () => {
    const server = await buildTracingServer();
    const res = await server.inject({ method: 'GET', url: '/ping' });
    const echoed = res.headers['x-request-id'] as string | undefined;
    expect(typeof echoed).toBe('string');
    expect(String(echoed).length).toBeGreaterThan(0);
    await server.close();
  });
});
