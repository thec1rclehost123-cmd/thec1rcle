import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

vi.mock('@c1rcle/core/security-logger', () => ({
  queryIncidents: vi.fn(),
  createIncident: vi.fn(),
}));

vi.mock('@/lib/server/adminMiddleware', () => ({
  withAdminAuth: (handler: Function) => handler,
}));

vi.mock('@/lib/server/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));

import { queryIncidents, createIncident } from '@c1rcle/core/security-logger';

const mockIncidents = [
  { id: 'inc_1', entityType: 'user', severity: 'high', status: 'flagged' },
  { id: 'inc_2', entityType: 'ip', severity: 'medium', status: 'under_review' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/security/incidents', () => {
  it('returns incidents', async () => {
    vi.mocked(queryIncidents).mockResolvedValue(mockIncidents);

    const req = new NextRequest('http://localhost/api/security/incidents');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.incidents).toEqual(mockIncidents);
    expect(body.count).toBe(2);
    expect(queryIncidents).toHaveBeenCalledWith({ status: undefined, severity: undefined, entityType: undefined, limit: 50 });
  });
});

describe('POST /api/security/incidents', () => {
  it('returns 400 when entityType, entityId, or reason are missing', async () => {
    const req = new NextRequest('http://localhost/api/security/incidents', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'user' }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('entityType, entityId, and reason are required');
  });

  it('returns 400 with invalid entityType', async () => {
    const req = new NextRequest('http://localhost/api/security/incidents', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'invalid', entityId: 'abc', reason: 'test' }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid entityType');
  });

  it('returns 201 with valid data', async () => {
    vi.mocked(createIncident).mockResolvedValue('inc_123');

    const req = new NextRequest('http://localhost/api/security/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'user', entityId: 'user_1', reason: 'Suspicious activity' }),
    });
    (req as any).user = { uid: 'admin_1' };
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.incidentId).toBe('inc_123');
    expect(createIncident).toHaveBeenCalledWith({
      entityType: 'user',
      entityId: 'user_1',
      severity: 'medium',
      reason: 'Suspicious activity',
      evidence: {},
      linkedEventId: null,
      createdBy: 'admin_1',
    });
  });
});
