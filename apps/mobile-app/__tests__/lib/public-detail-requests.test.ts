jest.mock('../../lib/api', () => {
  const flights = new Map<string, Promise<unknown>>();
  return {
    apiFetch: jest.fn(),
    deduplicateRequest: jest.fn((key: string, fetcher: () => Promise<unknown>) => {
      const existing = flights.get(key);
      if (existing) return existing;
      const promise = fetcher().finally(() => flights.delete(key));
      flights.set(key, promise);
      return promise;
    }),
  };
});

import { apiFetch } from '../../lib/api';
import { fetchPublicHostPage, fetchPublicVenuePage } from '../../lib/publicDetailRequests';
import { createLatestRequestGuard } from '../../lib/requestGuard';

const mockApiFetch = apiFetch as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('public detail requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shares one in-flight host request across duplicate route effects', async () => {
    const request = deferred<any>();
    mockApiFetch.mockReturnValueOnce(request.promise);

    const first = fetchPublicHostPage('demo-host-03');
    const second = fetchPublicHostPage('demo-host-03');

    expect(second).toBe(first);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/public/hosts/demo-host-03', {
      requireAuth: false,
    });

    request.resolve({ host: { id: 'demo-host-03' } });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('shares one in-flight venue request but keeps different venue keys independent', async () => {
    const nowlRequest = deferred<any>();
    const otherRequest = deferred<any>();
    mockApiFetch.mockReturnValueOnce(nowlRequest.promise).mockReturnValueOnce(otherRequest.promise);

    const firstNowl = fetchPublicVenuePage('demo-venue-nowl');
    const secondNowl = fetchPublicVenuePage('demo-venue-nowl');
    const otherVenue = fetchPublicVenuePage('demo-venue-other');

    expect(secondNowl).toBe(firstNowl);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);

    nowlRequest.resolve({ venue: { id: 'demo-venue-nowl' } });
    otherRequest.resolve({ venue: { id: 'demo-venue-other' } });
    await Promise.all([firstNowl, secondNowl, otherVenue]);
  });

  it('reuses a successful host response across sequential rapid invocations', async () => {
    mockApiFetch.mockResolvedValue({ host: { id: 'rapid-host' } });

    await fetchPublicHostPage('rapid-host');
    await fetchPublicHostPage('rapid-host');
    await fetchPublicHostPage('rapid-host');

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('reuses a successful venue response across sequential rapid invocations', async () => {
    mockApiFetch.mockResolvedValue({ venue: { id: 'rapid-venue' } });

    await fetchPublicVenuePage('rapid-venue');
    await fetchPublicVenuePage('rapid-venue');

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('bypasses the short cache for an explicit host refresh', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ host: { id: 'refresh-host', name: 'Before' } })
      .mockResolvedValueOnce({ host: { id: 'refresh-host', name: 'After' } });

    await fetchPublicHostPage('refresh-host');
    const refreshed = await fetchPublicHostPage('refresh-host', { bypassCache: true });

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(refreshed.host?.name).toBe('After');
  });
});

describe('latest request guard', () => {
  it('rejects results from an older resource and invalidated screen', () => {
    const guard = createLatestRequestGuard();
    const hostA = guard.begin('host-a');
    const hostB = guard.begin('host-b');

    expect(guard.isCurrent(hostA)).toBe(false);
    expect(guard.isCurrent(hostB)).toBe(true);

    guard.invalidate();
    expect(guard.isCurrent(hostB)).toBe(false);
  });
});
