import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { fetchStaffEvents } from '@/lib/api/eventCode';
import { useEvent } from '@/store/eventContext';

interface EventItem {
  id: string;
  title: string;
  venueName?: string;
  venue?: string;
  startDate: string;
  startTime: string;
  endTime: string;
  capacity?: number;
}

export default function SelectEventScreen() {
  const params = useLocalSearchParams();
  const { venueId } = params as { venueId: string };
  const { setEventData, clearEvent } = useEvent();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venueId) {
      setError('Missing venue context');
      setLoading(false);
      return;
    }
    loadEvents();
  }, [venueId]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStaffEvents(venueId);
      setEvents(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch today's events");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = async (event: any) => {
    setSessionLoading(event.id);
    setError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const eventData = {
        valid: true,
        code: 'STAFF',
        event: {
          id: event.id,
          title: event.title || event.name || 'Event',
          venue: event.venueName || 'Venue',
          venueId: venueId,
          date: event.startDate || '',
          startTime: event.startTime || '',
          endTime: event.endTime || '',
          capacity: event.capacity || 500,
        },
        permissions: { canScan: true, canDoorEntry: true },
        tiers: [],
      };

      setEventData(eventData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Replace routing stack to clear navigation history
      router.replace('/(event)/scan');
    } catch (err: any) {
      setError(err.message || 'Failed to establish event session');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSessionLoading(null);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signOut(auth);
      await clearEvent();
      router.replace('/');
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-primary px-6">
      {/* Header */}
      <View className="flex-row justify-between items-center py-6 border-b border-border mb-6">
        <View>
          <Text className="text-2xl font-black text-text-primary">Today's Events</Text>
          <Text className="text-sm text-text-secondary mt-1">
            Select the event you are managing
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          className="w-10 h-10 rounded-xl bg-background-secondary items-center justify-center border border-border"
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#F87171" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#6366F1" size="large" />
          <Text className="text-text-secondary mt-4 font-semibold">Loading events...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center py-8">
          <View className="w-16 h-16 rounded-2xl bg-error/15 items-center justify-center mb-4">
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
          </View>
          <Text className="text-text-primary text-lg font-bold text-center">{error}</Text>
          <TouchableOpacity
            onPress={loadEvents}
            className="mt-6 px-6 py-3 rounded-xl bg-accent flex-row items-center"
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text className="text-white font-bold ml-2">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : events.length === 0 ? (
        <View className="flex-1 justify-center items-center py-8">
          <View className="w-16 h-16 rounded-2xl bg-background-secondary items-center justify-center mb-4">
            <Ionicons name="calendar-outline" size={32} color="#71717A" />
          </View>
          <Text className="text-text-primary text-lg font-bold text-center">
            No Events Scheduled
          </Text>
          <Text className="text-text-muted text-sm text-center mt-2 px-6">
            There are no active events scheduled for today at this venue.
          </Text>
          <TouchableOpacity
            onPress={loadEvents}
            className="mt-6 px-6 py-3 rounded-xl bg-background-secondary border border-border flex-row items-center"
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#71717A" />
            <Text className="text-text-secondary font-bold ml-2">Refresh List</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isEventLoading = sessionLoading === item.id;
            return (
              <TouchableOpacity
                onPress={() => handleSelectEvent(item)}
                disabled={sessionLoading !== null}
                className="mb-4 p-5 rounded-2xl bg-background-elevated border border-border flex-row items-center justify-between"
                activeOpacity={0.8}
                style={styles.cardShadow}
              >
                <View className="flex-1 pr-4">
                  <Text className="text-lg font-bold text-text-primary" numberOfLines={1}>
                    {item.title}
                  </Text>

                  <View className="flex-row items-center mt-3" style={{ gap: 6 }}>
                    <Ionicons name="location-outline" size={14} color="#71717A" />
                    <Text className="text-xs text-text-secondary" numberOfLines={1}>
                      {item.venueName || item.venue || 'Club Venue'}
                    </Text>
                  </View>

                  <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
                    <Ionicons name="time-outline" size={14} color="#71717A" />
                    <Text className="text-xs text-text-secondary">
                      {item.startTime} - {item.endTime}
                    </Text>
                  </View>
                </View>

                <View>
                  {isEventLoading ? (
                    <ActivityIndicator color="#6366F1" size="small" />
                  ) : (
                    <View className="w-10 h-10 rounded-xl bg-accent/10 items-center justify-center">
                      <Ionicons name="chevron-forward" size={20} color="#6366F1" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});
