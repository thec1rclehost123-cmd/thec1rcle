import { Ionicons } from '@expo/vector-icons';
import { Tabs, Redirect } from 'expo-router';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

import { useEvent } from '@/store/eventContext';

export default function EventLayout() {
  const { isAuthenticated, eventData, isRestoring, clearEvent } = useEvent();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await clearEvent();
    } catch (e) {
      console.error('Failed to log out from event layout', e);
    }
  };

  if (isRestoring) {
    return (
      <View className="flex-1 bg-background-primary items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <View className="flex-1 bg-background-primary">
      {/* Event Header */}
      <View className="px-4 py-3 bg-background-secondary border-b border-border flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-text-primary font-bold text-lg" numberOfLines={1}>
            {eventData?.event.title}
          </Text>
          <Text className="text-text-secondary text-sm">
            {eventData?.event.venue} • {eventData?.gate || 'All Gates'}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View className="bg-success/20 px-3 py-1 rounded-full">
            <Text className="text-success text-xs font-bold">LIVE</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="w-10 h-10 rounded-xl bg-background-primary items-center justify-center border border-border"
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#F87171" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigator */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#141416',
            borderTopColor: '#27272A',
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarActiveTintColor: '#6366F1',
          tabBarInactiveTintColor: '#71717A',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color, size }) => <Ionicons name="qr-code" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="door-entry"
          options={{
            title: 'Door Entry',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-add" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="guestlist"
          options={{
            title: 'Guests',
            tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
