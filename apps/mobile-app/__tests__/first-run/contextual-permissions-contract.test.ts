/* global __dirname */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mobile = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(mobile, path), 'utf8');

describe('contextual permission contract', () => {
  it('never requests notification permission during silent token refresh', () => {
    const source = read('lib/notifications.ts');
    const refresh = source.match(/export async function refreshPushToken[\s\S]*?\n}/)?.[0] || '';
    expect(refresh).toContain('getExpoPushToken()');
    expect(refresh).not.toContain('requestNotificationPermissions');
    expect(source).toContain('getExpoPushToken({ requestPermission: true })');
  });

  it('offers notifications only after successful save or follow actions', () => {
    expect(read('store/eventInterestStore.ts')).toContain(
      "offerNotificationPermissionForAction('save_event', userId)",
    );
    expect(read('store/followStore.ts')).toContain(
      "offerNotificationPermissionForAction('follow_venue', userId)",
    );
  });

  it('keeps the generic permission route retired', () => {
    expect(read('app/permission.tsx')).toContain('Redirect');
  });

  it('uses dedicated contextual permission experiences', () => {
    const location = read('app/location-permission.tsx');
    const notifications = read('app/notification-permission.tsx');
    const notificationService = read('lib/notifications.ts');

    expect(location).toContain('requestForegroundPermissionsAsync');
    expect(location).toContain('Find the night around you');
    expect(location).not.toContain('Redirect');

    expect(notifications).toContain('registerPushToken');
    expect(notifications).toContain('Don’t miss the moment');
    expect(notifications).not.toContain('Redirect');

    expect(notificationService).toContain("pathname: '/notification-permission'");
  });
});
