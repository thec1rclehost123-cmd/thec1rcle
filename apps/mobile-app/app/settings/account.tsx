import { useState } from 'react';
import { Alert, ActivityIndicator, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import {
  DittoSettingsScreen,
  Divider,
  HelperText,
  SectionLabel,
  SettingsGroup,
  SettingsRow,
} from '@/components/settings/DittoSettings';

export default function AccountSettingsScreen() {
  const { user, signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const email = user?.email || 'No email';
  const phoneNumber = user?.phoneNumber || 'No phone number';

  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete My Account',
      'This permanently deletes your profile, photos, likes, passes, and account access. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await apiFetch('/api/v1/users/me', { method: 'DELETE' });
              // Also delete the Firebase Auth account so it is fully removed
              const auth = getFirebaseAuth();
              if (auth.currentUser) {
                await auth.currentUser.delete().catch(() => undefined);
              }
              // Only clear app-specific keys, not everything in AsyncStorage
              await AsyncStorage.multiRemove(['@user_settings', '@auth_state', '@profile']);
              useProfileStore.getState().clearProfile();
              useAuthStore.getState().setUser(null);
              try {
                await signOut();
              } catch {
                // Ignore sign out errors if already deleted
              }
              router.replace('/(auth)/login');
            } catch (error: any) {
              setIsDeleting(false);
              Alert.alert('Could not delete account', error?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
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
            value={phoneNumber}
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
          <SettingsRow title="Delete Account" danger onPress={handleDeleteAccount} />
        </SettingsGroup>
      </DittoSettingsScreen>

      {isDeleting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
