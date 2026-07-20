import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { FirstRunButton, firstRunTokens } from '@/components/first-run';
import { logout } from '@/lib/firebase';
import { retryAuthSession, useAuthStore } from '@/store/authStore';
import { useFirstRunStore } from '@/store/firstRunStore';
import { useProfileStore } from '@/store/profileStore';
import { resolveBootState } from '@/lib/boot/bootCoordinator';

export default function Index() {
  const {
    user,
    initialized,
    serverSynced,
    authSyncInProgress,
    authSyncFailed,
    authSyncError,
    usingCachedSession,
    isGuest,
  } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const snapshot = useFirstRunStore((state) => state.snapshot);

  const boot = resolveBootState({
    initialized,
    user,
    isGuest,
    serverSynced,
    authSyncInProgress,
    authSyncFailed,
    authSyncError,
    usingCachedSession,
    profile,
    snapshot,
  });

  if (boot.type === 'starting' || boot.type === 'syncing-auth') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={firstRunTokens.accent} />
        <Text style={styles.status}>Getting your night ready…</Text>
      </View>
    );
  }

  if (boot.type === 'recoverable-error' || boot.type === 'fatal-error') {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.title}>
          {boot.type === 'fatal-error'
            ? 'Your account needs attention'
            : 'We couldn’t load your account'}
        </Text>
        <Text style={styles.status}>{boot.message} Your saved progress is safe.</Text>
        <FirstRunButton
          label="Try again"
          onPress={() => void retryAuthSession()}
          loading={authSyncInProgress}
        />
        <FirstRunButton label="Sign out" onPress={() => void logout()} secondary />
      </View>
    );
  }

  return <Redirect href={boot.destination as any} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  errorWrap: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: { color: firstRunTokens.text, fontSize: 28, fontWeight: '800' },
  status: { color: firstRunTokens.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
