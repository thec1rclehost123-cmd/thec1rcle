import { describe, expect, it } from 'vitest';
import { resolveHostOverviewQueryPolicy } from './overviewQueryPolicy';

describe('resolveHostOverviewQueryPolicy', () => {
  it('uses one unified request by default', () => {
    expect(resolveHostOverviewQueryPolicy(undefined, undefined)).toEqual({
      unifiedEnabled: true,
      legacyEnabled: false,
    });
  });

  it('does not enable legacy requests when the unified request fails at runtime', () => {
    expect(resolveHostOverviewQueryPolicy('true', undefined)).toEqual({
      unifiedEnabled: true,
      legacyEnabled: false,
    });
  });

  it('permits legacy traffic only for explicit rollback or comparison', () => {
    expect(resolveHostOverviewQueryPolicy('false', undefined)).toEqual({
      unifiedEnabled: false,
      legacyEnabled: true,
    });
    expect(resolveHostOverviewQueryPolicy('true', 'true')).toEqual({
      unifiedEnabled: true,
      legacyEnabled: true,
    });
  });
});
