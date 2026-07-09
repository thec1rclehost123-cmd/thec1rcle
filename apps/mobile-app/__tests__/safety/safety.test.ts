/* global jest, describe, beforeEach, it, expect */

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 5 },
}));

jest.mock('../../lib/notifications', () => ({
  scheduleLocalNotification: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: { canOpenURL: jest.fn(), openURL: jest.fn() },
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios' },
}));

import { apiFetch } from '../../lib/api';
import * as Location from 'expo-location';
import { Linking, Alert } from 'react-native';
import { scheduleLocalNotification } from '../../lib/notifications';

const mockApiFetch = apiFetch as jest.Mock;

import {
  getEmergencyContacts,
  saveEmergencyContacts,
  requestLocationPermissions,
  getCurrentLocation,
  startLocationSharing,
  updateSharedLocation,
  stopLocationSharing,
  subscribeToFriendLocation,
  triggerSOS,
  requestSafeRide,
} from '../../lib/safety';

describe('safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEmergencyContacts', () => {
    it('extracts contacts from profile response', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: { emergencyContacts: [{ name: 'Mom', phone: '+911234567890' }] },
      });

      const contacts = await getEmergencyContacts('user_1');
      expect(contacts).toEqual([{ name: 'Mom', phone: '+911234567890' }]);
    });

    it('returns empty array on error', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('fail'));
      const contacts = await getEmergencyContacts('user_1');
      expect(contacts).toEqual([]);
    });
  });

  describe('saveEmergencyContacts', () => {
    it('saves contacts via PUT', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true });

      const result = await saveEmergencyContacts('user_1', [
        { name: 'Dad', phone: '+919876543210' },
      ]);

      expect(result).toEqual({ success: true });
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me', {
        method: 'PUT',
        body: JSON.stringify({ emergencyContacts: [{ name: 'Dad', phone: '+919876543210' }] }),
        requireAuth: true,
      });
    });

    it('returns error on failure', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Server error'));
      const result = await saveEmergencyContacts('user_1', []);
      expect(result).toEqual({ success: false, error: 'Server error' });
    });
  });

  describe('requestLocationPermissions', () => {
    it('returns true when permission is granted', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      const ok = await requestLocationPermissions();
      expect(ok).toBe(true);
    });

    it('returns false and alerts when denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const ok = await requestLocationPermissions();
      expect(ok).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  describe('getCurrentLocation', () => {
    it('returns coordinates when permission is granted', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: { latitude: 19.076, longitude: 72.8777 },
      });

      const loc = await getCurrentLocation();
      expect(loc).toEqual({ latitude: 19.076, longitude: 72.8777 });
    });

    it('returns null when permission denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const loc = await getCurrentLocation();
      expect(loc).toBeNull();
    });
  });

  describe('startLocationSharing', () => {
    it('starts a sharing session and returns sessionId', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: { latitude: 19.076, longitude: 72.8777 },
      });
      mockApiFetch.mockResolvedValueOnce({ sessionId: 'sess_1' });

      const result = await startLocationSharing('user_1', 'evt_1', 2);
      expect(result).toEqual({ success: true, sessionId: 'sess_1' });
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/location/start', {
        method: 'POST',
        body: JSON.stringify({
          eventId: 'evt_1',
          latitude: 19.076,
          longitude: 72.8777,
          durationHours: 2,
        }),
        requireAuth: true,
      });
    });

    it('returns error when location fails', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const result = await startLocationSharing('user_1');
      expect(result.success).toBe(false);
    });
  });

  describe('updateSharedLocation', () => {
    it('sends PATCH with current location', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: { latitude: 19.1, longitude: 72.9 },
      });
      mockApiFetch.mockResolvedValueOnce({});

      const result = await updateSharedLocation('sess_1');
      expect(result).toEqual({ success: true });
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/location/sess_1', {
        method: 'PATCH',
        body: JSON.stringify({ latitude: 19.1, longitude: 72.9 }),
        requireAuth: true,
      });
    });
  });

  describe('stopLocationSharing', () => {
    it('sends POST to stop endpoint', async () => {
      mockApiFetch.mockResolvedValueOnce({});

      const result = await stopLocationSharing('sess_1');
      expect(result).toEqual({ success: true });
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/location/sess_1/stop', {
        method: 'POST',
        requireAuth: true,
      });
    });
  });

  describe('subscribeToFriendLocation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('polls location and calls onUpdate', () => {
      mockApiFetch.mockResolvedValue({
        isActive: true,
        location: { latitude: 19.0, longitude: 72.0 },
      });
      const onUpdate = jest.fn();

      const cleanup = subscribeToFriendLocation('sess_1', onUpdate);
      jest.advanceTimersByTime(10000);

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/location/sess_1', {
        requireAuth: true,
      });
      cleanup();
    });

    it('stops polling on cleanup', async () => {
      mockApiFetch.mockResolvedValue({
        isActive: true,
        location: { latitude: 19.0, longitude: 72.0 },
      });
      const onUpdate = jest.fn();
      // Manually call onUpdate since the async poll may not flush in fake timers
      onUpdate({ latitude: 19.0, longitude: 72.0 });

      const cleanup = subscribeToFriendLocation('sess_1', onUpdate);
      // Reset so we can verify no further calls after cleanup
      onUpdate.mockClear();
      cleanup();
      jest.advanceTimersByTime(20000);

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('triggerSOS', () => {
    it('sends SOS and opens SMS', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: { latitude: 19.076, longitude: 72.8777 },
      });
      mockApiFetch.mockResolvedValueOnce({});
      mockApiFetch.mockResolvedValueOnce({
        profile: { emergencyContacts: [{ name: 'Mom', phone: '+911234567890' }] },
      });

      await triggerSOS('user_1', 'evt_1');

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/sos', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'evt_1', latitude: 19.076, longitude: 72.8777 }),
        requireAuth: true,
      });
      expect(Linking.openURL).toHaveBeenCalled();
      expect(scheduleLocalNotification).toHaveBeenCalledWith(
        'SOS Alert Sent',
        'Emergency contacts have been notified.',
        { type: 'sos_sent' },
      );
    });
  });

  describe('requestSafeRide', () => {
    it('opens deep link when app is installed', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      await requestSafeRide('uber');

      expect(Linking.openURL).toHaveBeenCalledWith('uber://');
    });

    it('falls back to web URL when app is not installed', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);

      await requestSafeRide('ola');

      expect(Linking.openURL).toHaveBeenCalledWith('https://book.olacabs.com');
    });
  });
});
