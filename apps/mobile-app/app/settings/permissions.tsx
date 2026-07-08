import { useEffect, useState } from 'react';
import { Camera, MapPin, Users } from 'lucide-react-native';
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
  showSettingsAlert,
} from '@/lib/permissions';

export default function PermissionsSettingsScreen() {
  const { privacy, setPrivacySetting } = useSettings();
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);

  useEffect(() => {
    checkLocationSystemPermission().then(setLocationGranted);
    checkNotificationSystemPermission().then(setNotificationGranted);
  }, []);

  const handleLocationToggle = (val: boolean) => {
    if (val && !locationGranted) {
      showSettingsAlert(
        'Location Access',
        'Location permission was denied. Open system settings to enable it.',
      );
      return;
    }
    setPrivacySetting('locationAccess', val);
  };

  return (
    <DittoSettingsScreen title="Permissions">
      <SettingsGroup>
        <SettingsSwitchRow
          title="Contacts Syncing"
          value={privacy.contactsSyncing}
          onValueChange={(val) => setPrivacySetting('contactsSyncing', val)}
        />
      </SettingsGroup>
      <HelperText>
        Invite your contacts to events and see which of your friends is going to an event.
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
          onPress={() => {
            if (!locationGranted) {
              showSettingsAlert(
                'Location Access',
                'Open system settings to enable location access for event discovery.',
              );
            } else {
              showSettingsAlert(
                'Location Access',
                'Revoke location permission in system settings.',
              );
            }
          }}
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
          value={undefined}
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
              <Users size={17} color="#fff" strokeWidth={2.4} />
            </TileIcon>
          }
          title="Push Notifications"
          value={notificationGranted ? 'Enabled' : 'Disabled'}
          onPress={() => {
            if (!notificationGranted) {
              showSettingsAlert(
                'Push Notifications',
                'Open system settings to enable push notifications.',
              );
            }
          }}
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
          onPress={() => {}}
        />
      </SettingsGroup>
      <HelperText>Blocked accounts can't chat with you or invite you to events.</HelperText>
    </DittoSettingsScreen>
  );
}
