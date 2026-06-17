import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  DittoSettingsScreen,
  Divider,
  HelperText,
  SectionLabel,
  SettingsGroup,
  SettingsRow,
} from '@/components/settings/DittoSettings';

export default function AccountSettingsScreen() {
  const { user } = useAuth();
  const email = user?.email || 'outfitrank@gmail.com';

  return (
    <DittoSettingsScreen title="Account Settings">
      <SectionLabel title="Basic Info" />
      <SettingsGroup>
        <SettingsRow
          title="Email"
          value={email}
          onPress={() => Alert.alert('Email', 'Email changes will be available soon.')}
        />
        <Divider />
        <SettingsRow
          title="Phone Number"
          value="+1 602-349-2605"
          onPress={() =>
            Alert.alert('Phone Number', 'Phone number editing will be available soon.')
          }
        />
        <Divider />
        <SettingsRow title="Username" value="-" onPress={() => router.push('/profile/edit')} />
      </SettingsGroup>

      <SectionLabel title="Security" />
      <SettingsGroup>
        <SettingsRow
          title="Passkeys"
          onPress={() => Alert.alert('Coming Soon', 'Passkeys will be available soon.')}
        />
      </SettingsGroup>

      <SectionLabel title="Crypto Identities" />
      <SettingsGroup>
        <SettingsRow title="Ethereum Address" value="-" />
        <Divider />
        <SettingsRow title="Solana Address" value="-" />
      </SettingsGroup>
      <HelperText>
        We don't support linking crypto wallets in-app at this time. You can do so on the website.
      </HelperText>

      <SettingsGroup>
        <SettingsRow
          title="Delete Account"
          danger
          onPress={() => Alert.alert('Delete Account', 'Account deletion will be available soon.')}
        />
      </SettingsGroup>
    </DittoSettingsScreen>
  );
}
