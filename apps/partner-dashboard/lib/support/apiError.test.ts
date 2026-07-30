import { describe, expect, it } from 'vitest';
import { formatSupportApiError } from './apiError';

describe('formatSupportApiError', () => {
  it('renders field-level gateway validation details', () => {
    expect(
      formatSupportApiError(
        {
          error: {
            message: 'Validation failed',
            details: [
              { path: 'expectedResult', message: 'Expected Result is required' },
              { path: 'actualResult', message: 'Actual Result is required' },
            ],
          },
        },
        'Submission failed',
      ),
    ).toBe('expectedResult: Expected Result is required · actualResult: Actual Result is required');
  });

  it('supports legacy string errors and a safe fallback', () => {
    expect(formatSupportApiError({ error: 'Unauthorized' }, 'Submission failed')).toBe(
      'Unauthorized',
    );
    expect(formatSupportApiError(null, 'Submission failed')).toBe('Submission failed');
  });
});
