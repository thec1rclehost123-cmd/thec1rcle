import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, RefreshControl, StyleSheet, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useScannerStore } from '@/store/scannerStore';
import { fetchGuestList, manualCheckIn } from '@/lib/scanner';
import { Guest } from '@/lib/scanner/types';
import { colors } from '@/lib/design/theme';

type FilterType = 'all' | 'entered' | 'not_entered' | 'door';

export default function GuestListScreen() {
  const { eventData, sessionToken } = useScannerStore();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventData?.valid) {
      router.replace('/scanner' as any);
      return;
    }
    loadGuests();
  }, []);

  const loadGuests = useCallback(async () => {
    try {
      const data = await fetchGuestList(
        eventData?.event.id || '',
        eventData?.code || '',
        sessionToken || eventData?.sessionToken,
      );
      setGuests(data);
    } catch {
      console.warn('[guestlist] failed to fetch guests');
    }
    setLoading(false);
  }, [eventData, sessionToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGuests();
    setRefreshing(false);
  }, [loadGuests]);

  // M9: useMemo — filter only recomputes when deps change
  const filteredGuests = useMemo(
    () =>
      guests.filter((g) => {
        if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'entered') return g.status === 'entered';
        if (filter === 'not_entered') return g.status === 'not_entered';
        if (filter === 'door') return g.source === 'door';
        return true;
      }),
    [guests, search, filter],
  );

  const counts = useMemo(
    () => ({
      all: guests.length,
      entered: guests.filter((g) => g.status === 'entered').length,
      not_entered: guests.filter((g) => g.status === 'not_entered').length,
      door: guests.filter((g) => g.source === 'door').length,
    }),
    [guests],
  );

  // Manual check-in on long-press
  const handleLongPress = useCallback(
    async (guest: Guest) => {
      if (guest.status === 'entered') return;
      Alert.alert('Check In', `Mark ${guest.name} as checked in?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check In',
          onPress: async () => {
            const result = await manualCheckIn(
              guest.id,
              eventData?.event.id || '',
              eventData?.code || '',
              sessionToken || eventData?.sessionToken,
            );
            if (result.success) {
              setGuests((prev) =>
                prev.map((g) =>
                  g.id === guest.id
                    ? { ...g, status: 'entered' as const, enteredAt: new Date().toISOString() }
                    : g,
                ),
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
              Alert.alert('Error', result.error || 'Check-in failed');
            }
          },
        },
      ]);
    },
    [eventData, sessionToken],
  );

  const renderGuest = useCallback(
    ({ item }: { item: Guest }) => (
      <Pressable onLongPress={() => handleLongPress(item)} style={styles.guestCard}>
        <View
          style={[
            styles.statusIcon,
            item.status === 'entered' ? styles.statusEntered : styles.statusPending,
          ]}
        >
          <Text style={{ fontSize: 16 }}>{item.status === 'entered' ? '✓' : '⏳'}</Text>
        </View>
        <View style={styles.guestInfo}>
          <View style={styles.guestNameRow}>
            <Text style={styles.guestName}>{item.name}</Text>
            {item.source === 'door' && (
              <View style={styles.doorBadge}>
                <Text style={styles.doorBadgeText}>DOOR</Text>
              </View>
            )}
          </View>
          <View style={styles.guestMeta}>
            <Text style={styles.guestTicket}>{item.ticketType}</Text>
            {item.quantity > 1 && <Text style={styles.guestQty}>×{item.quantity}</Text>}
          </View>
        </View>
        {item.enteredAt && (
          <Text style={styles.entryTime}>
            {new Date(item.enteredAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </Pressable>
    ),
    [handleLongPress],
  );

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'entered', label: 'Entered' },
    { key: 'not_entered', label: 'Pending' },
    { key: 'door', label: 'Door' },
  ];

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Text style={{ fontSize: 40 }}>👥</Text>
      <Text style={styles.emptyText}>
        {loading ? 'Loading guests...' : search ? 'No guests found' : 'No guests yet'}
      </Text>
      {!loading && !search && (
        <Text style={styles.emptyHint}>Long-press a guest to manually check them in</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Guest List</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search guests..."
            placeholderTextColor={colors.goldMetallic}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={{ fontSize: 16, color: colors.goldMetallic }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          {filters.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            >
              <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
                {f.label}
              </Text>
              <Text style={[styles.filterCount, filter === f.key && styles.filterCountActive]}>
                {counts[f.key]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlashList
        bounces={false}
        overScrollMode="never"
        data={filteredGuests}
        renderItem={renderGuest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
        }
        ListEmptyComponent={emptyComponent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerBack: { color: colors.iris, fontSize: 16, fontWeight: '600' },
  headerTitle: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  searchContainer: { paddingHorizontal: 16, paddingTop: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, color: colors.gold, fontSize: 16, marginLeft: 10 },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
  },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  filterTabActive: { backgroundColor: colors.iris },
  filterLabel: { color: colors.goldMetallic, fontSize: 13, fontWeight: '600' },
  filterLabelActive: { color: '#fff' },
  filterCount: { color: colors.goldMetallic, fontSize: 11, marginTop: 2 },
  filterCountActive: { color: 'rgba(255,255,255,0.7)' },
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statusEntered: { backgroundColor: 'rgba(0,214,143,0.15)' },
  statusPending: { backgroundColor: 'rgba(255,255,255,0.05)' },
  guestInfo: { flex: 1 },
  guestNameRow: { flexDirection: 'row', alignItems: 'center' },
  guestName: { color: colors.gold, fontSize: 16, fontWeight: '700' },
  doorBadge: {
    backgroundColor: 'rgba(244,74,34,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  doorBadgeText: { color: colors.iris, fontSize: 10, fontWeight: '700' },
  guestMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  guestTicket: { color: colors.goldMetallic, fontSize: 13 },
  guestQty: { color: colors.goldMetallic, fontSize: 13, marginLeft: 8 },
  entryTime: { color: colors.goldMetallic, fontSize: 12 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: colors.goldMetallic, fontSize: 15, marginTop: 12 },
  emptyHint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
