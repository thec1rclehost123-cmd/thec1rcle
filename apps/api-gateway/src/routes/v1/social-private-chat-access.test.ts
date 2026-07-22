import { describe, expect, it } from 'vitest';
import { directMessageAccessError } from './social';

describe('private chat send authorization', () => {
  const accepted = {
    participants: ['user_a', 'user_b'],
    status: 'accepted',
    expiresAt: '2099-01-01T00:00:00.000Z',
    isSaved: false,
  };

  it('allows an accepted participant', () => {
    expect(directMessageAccessError(accepted, 'user_a')).toBeNull();
  });

  it('rejects a non-participant', () => {
    expect(directMessageAccessError(accepted, 'attacker')).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('rejects messages before the recipient accepts', () => {
    expect(directMessageAccessError({ ...accepted, status: 'pending' }, 'user_a')).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('rejects an expired unsaved conversation', () => {
    expect(
      directMessageAccessError(
        { ...accepted, expiresAt: '2026-01-01T00:00:00.000Z' },
        'user_a',
        Date.parse('2026-07-16T00:00:00.000Z'),
      ),
    ).toMatchObject({ statusCode: 410, code: 'GONE' });
  });
});
