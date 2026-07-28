import React from 'react';
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  StyleSheet: { create: (styles: unknown) => styles },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

jest.mock('@/lib/scanner/api', () => ({
  submitDebit: jest.fn(),
}));

jest.mock('@/components/scanner/PresetGrid', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    PresetGrid: ({ items, onSelect }: any) => (
      <Pressable testID="select-water" onPress={() => onSelect(items[0])} />
    ),
  };
});

import { CoverDeductionOverlay } from '../../components/scanner/CoverDeductionOverlay';
import NetInfo from '@react-native-community/netinfo';
import { submitDebit } from '../../lib/scanner/api';

const mockFetchNetworkState = NetInfo.fetch as jest.Mock;
const mockSubmitDebit = submitDebit as jest.Mock;

const wallet = {
  id: 'wallet_1',
  orderId: 'order_1',
  eventId: 'event_1',
  venueId: 'venue_1',
  currentBalancePaise: 20_000,
  openingBalancePaise: 20_000,
  totalDebitedPaise: 0,
  guestFirstName: 'QA Guest',
  state: 'ACTIVE',
  terminationTime: null,
  paymentQrJwt: 'wallet.jwt.token',
  rules: {
    allowedPresetItems: [
      {
        id: 'water',
        name: 'Water',
        amountPaise: 5_000,
        isAvailable: true,
        sortOrder: 1,
      },
    ],
    showBalanceToGuest: true,
    maxChargeAmountPaise: 20_000,
    minChargeAmountPaise: 0,
  },
};

describe('CoverDeductionOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchNetworkState.mockResolvedValue({ isConnected: true });
  });

  it('submits the server preset and preserves one UUID across a failed-network retry', async () => {
    mockSubmitDebit
      .mockResolvedValueOnce({ success: false, error: 'Network error' })
      .mockResolvedValueOnce({ success: true, balanceAfterPaise: 15_000 });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(
        <CoverDeductionOverlay
          wallet={wallet as any}
          sessionToken="charge-session-token"
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'select-water' }).props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'cover-charge-process' }).props.disabled).toBe(
      false,
    );

    await act(async () => {
      await renderer.root.findByProps({ testID: 'cover-charge-process' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'select-water' }).props.onPress();
    });
    await act(async () => {
      await renderer.root.findByProps({ testID: 'cover-charge-process' }).props.onPress();
    });

    expect(mockSubmitDebit).toHaveBeenCalledTimes(2);
    expect(mockSubmitDebit.mock.calls[0][0]).toEqual({
      walletId: 'wallet_1',
      presetItemId: 'water',
      quantity: 1,
      idempotencyKey: 'test-uuid-1234-5678-abcd-efgh',
    });
    expect(mockSubmitDebit.mock.calls[1][0].idempotencyKey).toBe(
      mockSubmitDebit.mock.calls[0][0].idempotencyKey,
    );
    expect(mockSubmitDebit.mock.calls[0][1]).toBe('charge-session-token');
  });

  it('does not submit a debit while the scanner is offline', async () => {
    mockFetchNetworkState.mockResolvedValue({ isConnected: false });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(
        <CoverDeductionOverlay
          wallet={wallet as any}
          sessionToken="charge-session-token"
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'select-water' }).props.onPress();
    });
    await act(async () => {
      await renderer.root.findByProps({ testID: 'cover-charge-process' }).props.onPress();
    });

    expect(mockSubmitDebit).not.toHaveBeenCalled();
  });
});
