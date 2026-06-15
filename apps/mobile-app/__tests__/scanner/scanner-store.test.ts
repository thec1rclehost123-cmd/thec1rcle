/**
 * scannerStore unit tests
 */

import * as SecureStore from 'expo-secure-store';

import { useScannerStore } from '../../store/scannerStore';

const MOCK_EVENT_DATA = {
    valid: true,
    code: 'TEST-CODE',
    codeId: 'code_123',
    sessionToken: 'session-token-abc123',
    sessionExpiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
    event: {
        id: 'evt_123', title: 'Test Event', venue: 'Test Venue',
        venueId: 'venue_123', date: '2026-03-23', startTime: '22:00',
        endTime: '04:00', capacity: 500,
    },
    permissions: { canScan: true, canDoorEntry: true },
    tiers: [],
};

beforeEach(() => {
    // Reset store to initial state
    useScannerStore.setState({
        eventData: null,
        isAuthenticated: false,
        sessionToken: null,
        sessionExpiresAt: null,
    });
    jest.clearAllMocks();
});

describe('scannerStore', () => {
    it('setEventData sets isAuthenticated=true and sessionToken from data', async () => {
        await useScannerStore.getState().setEventData(MOCK_EVENT_DATA as any);
        const state = useScannerStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.sessionToken).toBe('session-token-abc123');
        expect(state.eventData?.code).toBe('TEST-CODE');
    });

    it('setEventData persists to SecureStore on valid data', async () => {
        await useScannerStore.getState().setEventData(MOCK_EVENT_DATA as any);
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
            'c1rcle_scanner_session',
            JSON.stringify(MOCK_EVENT_DATA),
        );
    });

    it('setEventData with null sets isAuthenticated=false and sessionToken=null', async () => {
        await useScannerStore.getState().setEventData(MOCK_EVENT_DATA as any);
        await useScannerStore.getState().setEventData(null);
        const state = useScannerStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.sessionToken).toBeNull();
    });

    it('clearEvent resets all fields', async () => {
        await useScannerStore.getState().setEventData(MOCK_EVENT_DATA as any);
        await useScannerStore.getState().clearEvent();
        const state = useScannerStore.getState();
        expect(state.eventData).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.sessionToken).toBeNull();
    });

    it('clearEvent deletes SecureStore key', async () => {
        await useScannerStore.getState().clearEvent();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('c1rcle_scanner_session');
    });

    it('rehydrate: populates store from SecureStore on valid session', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
            JSON.stringify(MOCK_EVENT_DATA)
        );
        await useScannerStore.getState().rehydrate();
        const state = useScannerStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.sessionToken).toBe('session-token-abc123');
    });

    it('rehydrate: clears SecureStore on expired session', async () => {
        const expired = {
            ...MOCK_EVENT_DATA,
            sessionToken: 'expired-token',
            sessionExpiresAt: new Date(Date.now() - 1000).toISOString(), // in the past
        };
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(expired));
        await useScannerStore.getState().rehydrate();
        const state = useScannerStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('rehydrate: silently handles null SecureStore value', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
        await expect(useScannerStore.getState().rehydrate()).resolves.not.toThrow();
        expect(useScannerStore.getState().isAuthenticated).toBe(false);
    });
});
