import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { hasCompletedProfileSetup } from './profile-setup';

export default function Index() {
  const { user, initialized } = useAuthStore();
  const [profileChecked, setProfileChecked] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!initialized || !user?.uid) {
      setProfileChecked(initialized);
      setProfileComplete(false);
      return;
    }

    setProfileChecked(false);
    hasCompletedProfileSetup(user.uid).then((complete) => {
      if (cancelled) return;
      setProfileComplete(complete);
      setProfileChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [initialized, user?.uid]);

  if (!initialized || !profileChecked) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#161616',
        }}
      >
        <ActivityIndicator color="#F44A22" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!profileComplete) return <Redirect href="/profile-setup" />;
  return <Redirect href="/(tabs)/explore" />;
}
