import { describe, expect, it } from 'vitest';
import { getScannerRefreshPlan } from './scannerRefreshPlan';

describe('getScannerRefreshPlan', () => {
  it('refreshes only the bounded scan stream for each check-in signal', () => {
    expect(getScannerRefreshPlan('TICKET_CHECKED_IN')).toEqual({
      refreshStream: true,
      refreshDevices: false,
    });
  });

  it('does not refetch scanner data for unrelated messages', () => {
    expect(getScannerRefreshPlan('ORDER_CONFIRMED')).toEqual({
      refreshStream: false,
      refreshDevices: false,
    });
  });
});
