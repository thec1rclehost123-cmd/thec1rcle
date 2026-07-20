import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from './route';

vi.mock('@c1rcle/core/security-logger', () => ({
  getIncident: vi.fn(),
  updateIncident: vi.fn(),
}));

vi.mock('@/lib/server/adminMiddleware', () => ({
  withAdminAuth: (handler: Function) => handler,
}));

import { getIncident, updateIncident } from '@c1rcle/core/security-logger';

const mockIncident = {
  id: 'inc_1',
  entityType: 'user',
  severity: 'high',
  status: 'flagged',
  createdBy: 'admin_1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/security/incidents/[id]', () => {
  it('returns the incident', async () => {
    vi.mocked(getIncident).mockResolvedValue(mockIncident);

    const req = new NextRequest('http://localhost/api/security/incidents/inc_1');
    const res = await GET(req, { params: { id: 'inc_1' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.incident).toEqual(mockIncident);
  });

  it('returns 404 when incident is not found', async () => {
    vi.mocked(getIncident).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/security/incidents/nonexistent');
    const res = await GET(req, { params: { id: 'nonexistent' } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
  });
});

describe('PATCH /api/security/incidents/[id]', () => {
  it('succeeds with a valid status transition', async () => {
    vi.mocked(getIncident).mockResolvedValue(mockIncident);
    vi.mocked(updateIncident).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/security/incidents/inc_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'under_review' }),
    });
    (req as any).user = { uid: 'admin_1' };
    const res = await PATCH(req, { params: { id: 'inc_1' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(updateIncident).toHaveBeenCalledWith('inc_1', { status: 'under_review' });
  });

  it('returns 400 with invalid status transition', async () => {
    vi.mocked(getIncident).mockResolvedValue(mockIncident);

    const req = new NextRequest('http://localhost/api/security/incidents/inc_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    (req as any).user = { uid: 'admin_1' };
    const res = await PATCH(req, { params: { id: 'inc_1' } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Cannot transition from 'flagged' to 'resolved'");
    expect(updateIncident).not.toHaveBeenCalled();
  });

  it('returns 404 when incident is not found', async () => {
    vi.mocked(getIncident).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/security/incidents/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'under_review' }),
    });
    (req as any).user = { uid: 'admin_1' };
    const res = await PATCH(req, { params: { id: 'nonexistent' } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
    expect(updateIncident).not.toHaveBeenCalled();
  });
});
