import { Alert } from 'react-native';
import { Camera } from 'lucide-react-native';
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

export default function PermissionsSettingsScreen() {
  const { privacy, setPrivacySetting } = useSettings();

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
        <SettingsSwitchRow
          title="Location Access"
          value={privacy.locationAccess}
          onValueChange={(val) => setPrivacySetting('locationAccess', val)}
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
          title="Allow Camera Access"
          onPress={() =>
            Alert.alert('Camera Access', 'Open system settings to update camera permissions.')
          }
        />
      </SettingsGroup>
      <HelperText>Check in guests or take photos for your events, avatar and chats.</HelperText>

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
          onPress={() => Alert.alert('Coming Soon', 'Blocked accounts will be available soon.')}
        />
      </SettingsGroup>
      <HelperText>Blocked accounts can't chat with you or invite you to events.</HelperText>
    </DittoSettingsScreen>
  );
}
