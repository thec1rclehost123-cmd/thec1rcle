import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { FirstRunButton, firstRunTokens } from '@/components/first-run';
import { firstRunRoute, resolveFirstRunStage } from '@/lib/firstRun';
import { logout } from '@/lib/firebase';
import { completeAuthSessionAfterSignIn, useAuthStore } from '@/store/authStore';
import { getFirebaseAuth } from '@/lib/firebase';
import { useFirstRunStore } from '@/store/firstRunStore';
import { useProfileStore } from '@/store/profileStore';

export default function Index() {
  const { user, initialized, serverSynced, authSyncInProgress, authSyncFailed, isGuest } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const profileLoading = useProfileStore((state) => state.loading);
  const { snapshot, hydrated, load, loading, error } = useFirstRunStore();

  useEffect(() => {
    if (user?.uid && serverSynced && !hydrated) void load();
  }, [hydrated, load, serverSynced, user?.uid]);

  const destination = useMemo(() => {
    if (!user) return null;
    return firstRunRoute(resolveFirstRunStage(user, profile, snapshot));
  }, [profile, snapshot, user]);

  if (!initialized || authSyncInProgress || (user && !serverSynced) || (user && (!hydrated || (!profile && profileLoading)))) {
    return <View style={styles.center}><ActivityIndicator color={firstRunTokens.accent} /><Text style={styles.status}>Getting your night ready…</Text></View>;
  }

  if (authSyncFailed || (error && !profile)) {
    const retry = async () => {
      const firebaseUser = getFirebaseAuth().currentUser;
      if (firebaseUser) await completeAuthSessionAfterSignIn(firebaseUser);
      else await load();
    };
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.title}>We couldn’t load your account</Text>
        <Text style={styles.status}>Check your connection and try again. Your progress is safe.</Text>
        <FirstRunButton label="Try again" onPress={() => void retry()} loading={loading || authSyncInProgress} />
        <FirstRunButton label="Sign out" onPress={() => void logout()} secondary />
      </View>
    );
  }

  if (!user) return <Redirect href={isGuest ? '/(tabs)/explore' : '/(auth)/login'} />;
  return <Redirect href={(destination ?? '/(tabs)/explore') as any} />;
}

const styles = StyleSheet.create({ center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 14 }, errorWrap: { flex: 1, backgroundColor: '#000', justifyContent: 'center', paddingHorizontal: 24, gap: 14 }, title: { color: firstRunTokens.text, fontSize: 28, fontWeight: '800' }, status: { color: firstRunTokens.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' } });
