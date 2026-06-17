import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useEventsStore } from '@/store/eventsStore';
import { PremiumEventCard } from '@/components/ui/PremiumExploreSections';
import { StatusBar } from 'expo-status-bar';

export default function CategoryScreen() {
  const { id, bg, label } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { events } = useEventsStore();

  // Mapping for tags based on category ID
  const tagMap: Record<string, string[]> = {
    parties: ['party', 'club', 'dance', 'edm'],
    brunch: ['brunch', 'day party', 'food'],
    comedy: ['comedy', 'standup', 'laugh'],
    experiences: ['activity', 'workshop', 'game'],
    culinary: ['food', 'drink', 'tasting', 'wine', 'dinner'],
  };

  const categoryEvents = useMemo(() => {
    const catId = Array.isArray(id) ? id[0] : id;
    const tags = tagMap[catId] || [];
    // Note: For demonstration purposes if tags match, otherwise we fall back to a generic filter
    // If there are no tags on events, just return the first few events as a fallback demo
    const filtered = events.filter((e) => e.tags?.some((tag) => tags.includes(tag.toLowerCase())));
    return filtered.length > 0 ? filtered : events.slice(0, 3);
  }, [events, id]);

  const bgColor = (Array.isArray(bg) ? bg[0] : bg) || '#161616';
  const catLabel = Array.isArray(label) ? label[0] : label;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#000" size={24} />
        </Pressable>
        <Text style={styles.title}>{catLabel}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={categoryEvents}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 40 }}
        renderItem={({ item, index }) => (
          <PremiumEventCard event={item} index={index} variant="list" />
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No events found for this scene right now.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
