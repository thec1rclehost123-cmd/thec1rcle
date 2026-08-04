import { describe, expect, it } from 'vitest';
import { dedupeCurrentOnboardingRequests } from './onboardingRequests.js';

describe('current onboarding request projection', () => {
  it('returns one current row per applicant and keeps duplicate ids as audit metadata', () => {
    const result = dedupeCurrentOnboardingRequests([
      {
        id: 'old-approved',
        uid: 'user-1',
        type: 'host',
        status: 'approved',
        updatedAt: '2026-07-20T00:00:00.000Z',
      },
      {
        id: 'retry-pending',
        uid: 'user-1',
        type: 'host',
        status: 'pending',
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
      {
        id: 'other',
        uid: 'user-2',
        type: 'promoter',
        status: 'pending',
        updatedAt: '2026-07-22T00:00:00.000Z',
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((request) => request.uid === 'user-1')).toMatchObject({
      id: 'old-approved',
      status: 'approved',
      attemptCount: 2,
      duplicateRequestIds: ['retry-pending'],
    });
  });
});
