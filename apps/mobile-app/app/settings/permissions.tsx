import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { Bell, Camera, MapPin } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSettings } from '@/hooks/useSettings';
import {
  DittoSettingsScreen,
  Divider,
  HelperText,
  SectionLabel,
  SettingsGroup,
  SettingsRow,
  SettingsSwitchRow,
  TileIcon,
} from '@/components/settings/DittoSettings';
import {
  checkLocationSystemPermission,
  checkNotificationSystemPermission,
  requestLocationSystemPermission,
  showSettingsAlert,
} from '@/lib/permissions';
import { registerPushToken } from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';

export default function PermissionsSettingsScreen() {
  const { privacy, setPrivacySetting } = useSettings();
  const userId = useAuthStore((state) => state.user?.uid);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);

  const refreshPermissionState = useCallback(async () => {
    const [location, notification, camera] = await Promise.allSettled([
      checkLocationSystemPermission(),
      checkNotificationSystemPermission(),
      ImagePicker.getCameraPermissionsAsync().then(({ status }) => status === 'granted'),
    ]);
    if (location.status === 'fulfilled') setLocationGranted(location.value);
    if (notification.status === 'fulfilled') setNotificationGranted(notification.value);
    if (camera.status === 'fulfilled') setCameraGranted(camera.value);
  }, []);

  useEffect(() => {
    void refreshPermissionState();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermissionState();
    });
    return () => subscription.remove();
  }, [refreshPermissionState]);

  const handleLocationPress = async () => {
    if (locationGranted) {
      showSettingsAlert('Location Access', 'Revoke location permission in system settings.');
      return;
    }

    const granted = await requestLocationSystemPermission();
    setLocationGranted(granted);
    if (!granted) {
      showSettingsAlert(
        'Location Access',
        'Location permission is disabled. Open system settings to enable it.',
      );
    }
  };

  const handleNotificationPress = async () => {
    if (!userId) {
      Alert.alert('Sign in required', 'Sign in to register this device for push notifications.');
      return;
    }

    const registered = await registerPushToken(userId, {
      requestPermission: !notificationGranted,
    });
    const granted = await checkNotificationSystemPermission();
    setNotificationGranted(granted);
    if (!granted) {
      showSettingsAlert(
        'Push Notifications',
        'Push notification permission is disabled. Open system settings to enable it.',
      );
    } else if (!registered) {
      Alert.alert(
        'Could not register notifications',
        'Permission is enabled, but this device could not be registered. Check your connection and try again.',
      );
    }
  };

  return (
    <DittoSettingsScreen title="Permissions">
      <SettingsGroup>
        <SettingsRow title="Contacts Syncing" value="Not available" />
      </SettingsGroup>
      <HelperText>
        Contact access is not collected in this release. You can still invite friends with share
        links.
      </HelperText>

      <SettingsGroup>
        <SettingsRow
          icon={
            <TileIcon>
              <MapPin size={17} color="#fff" strokeWidth={2.4} />
            </TileIcon>
          }
          title="Location Access"
          value={locationGranted ? 'Enabled' : 'Disabled'}
          onPress={() => void handleLocationPress()}
        />
      </SettingsGroup>
      <HelperText>
        View events near you and get better location suggestions when creating events.
      </HelperText>

      <SettingsGroup>
        <SettingsRow
          icon={
            <TileIcon>
              <Camera size={17} color="#fff" strokeWidth={2.4} />
            </TileIcon>
          }
          title="Camera Access"
          value={cameraGranted ? 'Enabled' : 'Disabled'}
          onPress={() =>
            showSettingsAlert('Camera Access', 'Open system settings to update camera permissions.')
          }
        />
      </SettingsGroup>
      <HelperText>Check in guests or take photos for your events, avatar and chats.</HelperText>

      <SectionLabel title="Notifications" />
      <SettingsGroup>
        <SettingsRow
          icon={
            <TileIcon>
              <Bell size={17} color="#fff" strokeWidth={2.4} />
            </TileIcon>
          }
          title="Push Notifications"
          value={notificationGranted ? 'Enabled' : 'Disabled'}
          onPress={handleNotificationPress}
        />
      </SettingsGroup>
      <HelperText>Receive event invites, reminders, and chat messages.</HelperText>

      <SectionLabel title="Privacy" />
      <SettingsGroup>
        <SettingsSwitchRow
          title="Public profile"
          value={privacy.publicProfile}
          onValueChange={(val) => setPrivacySetting('publicProfile', val)}
        />
        <Divider />
        <SettingsSwitchRow
          title="Show me on public guestlists"
          value={privacy.showOnGuestlists}
          onValueChange={(val) => setPrivacySetting('showOnGuestlists', val)}
        />
        <Divider />
        <SettingsSwitchRow
          title="Show events I'm attending"
          value={privacy.showEventsAttending}
          onValueChange={(val) => setPrivacySetting('showEventsAttending', val)}
        />
      </SettingsGroup>
      <HelperText>Control your profile visibility and privacy settings across the app.</HelperText>

      <SettingsGroup>
        <SettingsRow
          title="Blocked Accounts"
          onPress={() => router.push('/settings/blocked-accounts' as any)}
        />
      </SettingsGroup>
      <HelperText>Blocked accounts can't chat with you or invite you to events.</HelperText>
    </DittoSettingsScreen>
  );
}
