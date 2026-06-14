import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useScannerStore } from "@/store/scannerStore";
import { refreshEventStats } from "@/lib/scanner";
import { colors } from "@/lib/design/theme";

interface StatsData {
  totalEntered: number;
  prebooked: number;
  doorEntries: number;
  capacity: number;
  doorRevenue: number;
  byEntryType: Record<string, number>;
}

export default function StatsScreen() {
  const { eventData } = useScannerStore();

  const [stats, setStats] = useState<StatsData>({
    totalEntered: eventData?.stats?.totalEntered || 0,
    prebooked: eventData?.stats?.prebooked || 0,
    doorEntries: eventData?.stats?.doorEntries || 0,
    capacity: eventData?.event.capacity || 500,
    doorRevenue: eventData?.stats?.doorRevenue || 0,
    byEntryType: {},
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!eventData?.valid) router.replace("/scanner" as any);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await refreshEventStats(eventData?.code || "");
      if (data) {
        setStats({
          totalEntered: data.totalEntered ?? stats.totalEntered,
          prebooked: data.prebooked ?? stats.prebooked,
          doorEntries: data.doorEntries ?? stats.doorEntries,
          capacity: eventData?.event.capacity || 500,
          doorRevenue: data.doorRevenue ?? stats.doorRevenue,
          byEntryType: data.byEntryType || {},
        });
      }
    } catch (e) {
      console.error("Stats refresh failed:", e);
    }
    setRefreshing(false);
  }, [eventData?.code]);

  const fillPct = Math.min(100, (stats.totalEntered / stats.capacity) * 100);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Live Stats</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
        }
      >
        {/* Main Counter */}
        <View style={styles.mainCard}>
          <Text style={styles.mainLabel}>Currently Inside</Text>
          <Text style={styles.mainNumber}>{stats.totalEntered}</Text>
          <Text style={styles.mainCapacity}>of {stats.capacity} capacity</Text>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${fillPct}%`,
                  backgroundColor:
                    fillPct >= 90 ? colors.error : fillPct >= 70 ? colors.warning : colors.success,
                } as any,
              ]}
            />
          </View>
          <Text style={styles.progressText}>{fillPct.toFixed(0)}% full</Text>
        </View>

        {/* Entry Sources */}
        <View style={styles.row}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={styles.statIcon}>🎫</Text>
            <Text style={styles.statLabel}>Pre-booked</Text>
            <Text style={styles.statValue}>{stats.prebooked}</Text>
          </View>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={styles.statIcon}>🚪</Text>
            <Text style={styles.statLabel}>Door Entry</Text>
            <Text style={styles.statValue}>{stats.doorEntries}</Text>
          </View>
        </View>

        {/* Door Revenue */}
        <View style={styles.statCard}>
          <View style={styles.revenueRow}>
            <View>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={styles.statLabel}>Door Revenue</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.success, fontSize: 28 }]}>
              ₹{stats.doorRevenue.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Tier Breakdown */}
        <View style={styles.statCard}>
          <Text style={styles.breakdownTitle}>Entry Breakdown</Text>
          {eventData?.tiers.map((tier) => {
            const count = stats.byEntryType[tier.entryType] || 0;
            return (
              <View key={tier.id} style={styles.breakdownRow}>
                <View style={styles.breakdownLeft}>
                  <View
                    style={[
                      styles.breakdownDot,
                      {
                        backgroundColor:
                          tier.entryType === "vip"
                            ? colors.warning
                            : tier.entryType === "couple"
                              ? colors.iris
                              : colors.success,
                      },
                    ]}
                  />
                  <Text style={styles.breakdownLabel}>{tier.name}</Text>
                </View>
                <Text style={styles.breakdownValue}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Remaining */}
        <View style={[styles.statCard, { marginBottom: 32 }]}>
          <View style={styles.revenueRow}>
            <Text style={styles.statLabel}>Remaining Capacity</Text>
            <Text style={styles.statValue}>{Math.max(0, stats.capacity - stats.totalEntered)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerBack: { color: colors.iris, fontSize: 16, fontWeight: "600" },
  headerTitle: { color: colors.gold, fontSize: 18, fontWeight: "800" },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  mainLabel: { color: colors.goldMetallic, fontSize: 16 },
  mainNumber: { color: colors.gold, fontSize: 64, fontWeight: "800", marginTop: 4 },
  mainCapacity: { color: colors.goldMetallic, fontSize: 15, marginTop: 4 },
  progressBar: {
    width: "100%",
    height: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 6,
    marginTop: 20,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 6 },
  progressText: { color: colors.goldMetallic, fontSize: 13, marginTop: 8 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statLabel: { color: colors.goldMetallic, fontSize: 14 },
  statValue: { color: colors.gold, fontSize: 28, fontWeight: "800", marginTop: 4 },
  revenueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  breakdownTitle: { color: colors.goldMetallic, fontSize: 14, marginBottom: 16 },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  breakdownLeft: { flexDirection: "row", alignItems: "center" },
  breakdownDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  breakdownLabel: { color: colors.gold, fontSize: 16 },
  breakdownValue: { color: colors.gold, fontSize: 20, fontWeight: "800" },
});
