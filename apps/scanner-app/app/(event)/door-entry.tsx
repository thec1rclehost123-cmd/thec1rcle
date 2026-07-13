import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { submitDoorEntry, fetchWalkIns, fetchDineIns, fetchCapacity } from '@/lib/api/doorEntry';
import type {
  WalkInEntry,
  DineInEntry,
  EventCapacity,
  DoorEntryRequest,
} from '@/lib/api/doorEntry';
import { useEvent } from '@/store/eventContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type DoorGender = 'male' | 'female';
type EntryType = 'walkins' | 'dinein' | null;
type FlashState = { type: 'success' | 'error'; message: string } | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mirrors DoorSellClient.idempotencyKey */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DoorEntryScreen() {
  const { eventData } = useEvent();

  // ── Sub-tabs (mirrors DoorPageClient TABS) ────────────────────────────────
  const [activeTab, setActiveTab] = useState<'sell' | 'walkins' | 'dinein'>('sell');

  // ── Form state — mirrors DoorSellClient exactly ───────────────────────────
  const [guestName, setGuestName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<DoorGender | null>(null);
  const [age, setAge] = useState('');
  const [entryType, setEntryType] = useState<EntryType>(null);
  const [totalGuests, setTotalGuests] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<FlashState>(null);

  // ── Local entry state — populated optimistically on submit ────────────────
  // Mirrors DoorHubContext.walkInEntries / dineInEntries + addEntry()
  const [walkInEntries, setWalkInEntries] = useState<WalkInEntry[]>([]);
  const [dineInEntries, setDineInEntries] = useState<DineInEntry[]>([]);
  const [loadingWalkIns, setLoadingWalkIns] = useState(false);
  const [loadingDineIns, setLoadingDineIns] = useState(false);
  const [refreshingWalkIns, setRefreshingWalkIns] = useState(false);
  const [refreshingDineIns, setRefreshingDineIns] = useState(false);

  // ── Capacity state ─────────────────────────────────────────────────────────
  const [capacity, setCapacity] = useState<EventCapacity | null>(null);
  const [capLoading, setCapLoading] = useState(false);

  // ── Flash animation refs ──────────────────────────────────────────────────
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashTranslate = useRef(new Animated.Value(-8)).current;
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canDoorEntry = eventData?.permissions.canDoorEntry ?? false;

  // ── Validation — mirrors DoorSellClient.canSubmit ─────────────────────────
  // Scanner has event pre-selected from scanner code, so no selectedEventId check needed.
  // Capacity/soldOut not available without partner-level auth — omitted per plan.
  const soldOut = entryType === 'walkins' && capacity?.isSoldOut;

  const canSubmit =
    guestName.trim().length > 0 &&
    contact.length === 10 &&
    gender !== null &&
    age !== '' &&
    entryType !== null &&
    !submitting &&
    !soldOut;

  // ── Flash feedback — mirrors DoorSellClient.showFlash (2.5 s auto-dismiss) ─
  const showFlash = useCallback(
    (type: 'success' | 'error', message: string) => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setFlash({ type, message });
      flashOpacity.setValue(0);
      flashTranslate.setValue(-8);
      Animated.parallel([
        Animated.timing(flashOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(flashTranslate, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      flashTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(flashOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(flashTranslate, { toValue: -8, duration: 200, useNativeDriver: true }),
        ]).start(() => setFlash(null));
      }, 2500);
    },
    [flashOpacity, flashTranslate],
  );

  // ── Reset form — mirrors DoorSellClient.resetForm ─────────────────────────
  const resetForm = () => {
    setGuestName('');
    setContact('');
    setEmail('');
    setGender(null);
    setAge('');
    setEntryType(null);
    setTotalGuests('');
  };

  // Reset totalGuests when entry type changes — mirrors DoorSellClient useEffect
  useEffect(() => {
    setTotalGuests('');
  }, [entryType]);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadCapacity = useCallback(async () => {
    if (!eventData?.event.id) return;
    setCapLoading(true);
    try {
      const cap = await fetchCapacity(eventData.event.id, eventData.event.venueId);
      setCapacity(cap);
    } catch {
      // silent
    } finally {
      setCapLoading(false);
    }
  }, [eventData]);

  // Load capacity when selecting walkins or on mount
  useEffect(() => {
    if (activeTab === 'sell' && entryType === 'walkins') loadCapacity();
  }, [activeTab, entryType, loadCapacity]);

  const loadWalkIns = useCallback(
    async (showLoading = true) => {
      if (!eventData?.event.id) return;
      if (showLoading) setLoadingWalkIns(true);
      try {
        const data = await fetchWalkIns(
          eventData.event.id,
          eventData.code,
          eventData.event.venueId,
        );
        setWalkInEntries(data);
      } catch {
        // Optimistic entries already visible — silent failure
      } finally {
        if (showLoading) setLoadingWalkIns(false);
      }
    },
    [eventData],
  );

  const loadDineIns = useCallback(
    async (showLoading = true) => {
      if (!eventData?.event.venueId) return;
      if (showLoading) setLoadingDineIns(true);
      try {
        const data = await fetchDineIns(eventData.event.venueId);
        setDineInEntries(data);
      } catch {
        // Optimistic entries already visible — silent failure
      } finally {
        if (showLoading) setLoadingDineIns(false);
      }
    },
    [eventData],
  );

  // Initial load when switching to list tabs
  useEffect(() => {
    if (activeTab === 'walkins') loadWalkIns();
    else if (activeTab === 'dinein') loadDineIns();
  }, [activeTab, loadWalkIns, loadDineIns]);

  // ── Submit — mirrors DoorSellClient.handleSubmit ──────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!eventData) {
      showFlash('error', 'Event not loaded — please wait a moment and try again');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const purpose = entryType === 'dinein' ? 'dinein' : 'party';

      const req: DoorEntryRequest = {
        eventId: eventData.event.id,
        venueId: eventData.event.venueId,
        guestName: guestName.trim(),
        contact: contact.trim(),
        email: email.trim() || undefined,
        age: parseInt(age, 10) || 0,
        partySize: entryType === 'dinein' ? parseInt(totalGuests, 10) || 1 : 1,
        totalGuests: entryType === 'dinein' ? parseInt(totalGuests, 10) || 1 : undefined,
        gender: gender || null,
        purpose,
        idempotencyKey: generateId(),
      };

      const result = await submitDoorEntry(req);

      if (!result.success) {
        showFlash('error', result.error ?? 'Failed to create entry');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFlash('success', purpose === 'party' ? 'Walk-in entry added' : 'Dine-in entry added');

      if (entryType === 'walkins') {
        setWalkInEntries((prev) => [
          {
            id: result.entryId ?? generateId(),
            eventId: eventData.event.id,
            venueId: eventData.event.venueId,
            guestName: guestName.trim(),
            age: parseInt(age, 10) || null,
            contact: contact.trim(),
            gender,
            addedAt: new Date().toISOString(),
            totalGuests: 1,
          },
          ...prev,
        ]);
      } else {
        setDineInEntries((prev) => [
          {
            id: result.entryId ?? generateId(),
            eventId: eventData.event.id,
            venueId: eventData.event.venueId,
            guestName: guestName.trim(),
            totalGuests: parseInt(totalGuests, 10) || 1,
            contact: contact.trim(),
            gender: gender!,
            age: parseInt(age, 10) || 0,
            addedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      if (result.remainingCapacity !== null && result.remainingCapacity !== undefined) {
        setCapacity((prev) =>
          prev
            ? {
                ...prev,
                available: result.remainingCapacity!,
                isSoldOut: result.remainingCapacity === 0,
              }
            : prev,
        );
      }

      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  // ── Permission guard ──────────────────────────────────────────────────────

  if (!canDoorEntry) {
    return (
      <SafeAreaView className="flex-1 bg-background-primary items-center justify-center px-6">
        <Ionicons name="lock-closed" size={64} color="#71717A" />
        <Text className="text-text-primary text-xl font-bold mt-4 text-center">
          Door Entry Disabled
        </Text>
        <Text className="text-text-secondary text-center mt-2">
          This event code does not have door entry permission
        </Text>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background-primary" edges={['bottom']}>
      {/* ── Sub-tab bar — mirrors DoorPageClient TABS ── */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row bg-background-secondary rounded-xl p-1">
          {[
            { key: 'sell' as const, label: 'Entry Form', icon: 'ticket-outline' as const },
            { key: 'walkins' as const, label: 'Walk-Ins', icon: 'people-outline' as const },
            { key: 'dinein' as const, label: 'Dine-in', icon: 'restaurant-outline' as const },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center ${
                activeTab === tab.key ? 'bg-accent' : ''
              }`}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? '#FFFFFF' : '#71717A'}
                style={{ marginRight: 5 }}
              />
              <Text
                className={`text-xs font-semibold ${
                  activeTab === tab.key ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          ENTRY FORM TAB
          Mirrors: DoorSellClient — identical fields, validation, submit logic
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sell' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 px-4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Flash feedback — animated slide-in, 2.5s auto-dismiss */}
            {flash && (
              <Animated.View
                style={[
                  {
                    opacity: flashOpacity,
                    transform: [{ translateY: flashTranslate }],
                    marginTop: 12,
                    marginBottom: 8,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                  },
                  flash.type === 'success'
                    ? {
                        backgroundColor: 'rgba(52,211,153,0.1)',
                        borderColor: 'rgba(52,211,153,0.2)',
                      }
                    : {
                        backgroundColor: 'rgba(248,113,113,0.1)',
                        borderColor: 'rgba(248,113,113,0.2)',
                      },
                ]}
              >
                <Ionicons
                  name={flash.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={flash.type === 'success' ? '#34D399' : '#F87171'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={`text-sm font-semibold flex-1 ${
                    flash.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {flash.message}
                </Text>
              </Animated.View>
            )}

            {/* Capacity bar — only visible after a walk-in entryType is selected */}
            {entryType === 'walkins' &&
              (capLoading ? (
                <View className="bg-background-secondary rounded-2xl px-4 py-5 mt-3 flex-row items-center">
                  <ActivityIndicator color="#71717A" size="small" />
                  <Text className="text-text-muted text-sm ml-2">Checking capacity…</Text>
                </View>
              ) : capacity ? (
                <View className="bg-background-secondary rounded-2xl px-4 py-4 mt-3">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                      <Ionicons name="people" size={14} color="#71717A" />
                      <Text className="text-xs font-bold uppercase tracking-widest text-text-muted ml-1.5">
                        Capacity
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold text-text-primary">
                        {capacity.currentCount ?? capacity.soldCount + capacity.doorWalkInCount}
                        <Text className="text-text-muted font-normal"> / {capacity.total}</Text>
                      </Text>
                      {capacity.isSoldOut ? (
                        <View className="px-2 py-0.5 rounded-full bg-red-500/10">
                          <Text className="text-[10px] font-black uppercase tracking-widest text-red-400">
                            Sold Out
                          </Text>
                        </View>
                      ) : (
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: capacity.isNearCapacity
                              ? 'rgba(251,191,36,0.1)'
                              : 'rgba(52,211,153,0.1)',
                          }}
                        >
                          <Text
                            className="text-[11px] font-bold"
                            style={{ color: capacity.isNearCapacity ? '#FBBF24' : '#34D399' }}
                          >
                            {capacity.available} left
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View className="h-2 rounded-full overflow-hidden bg-background-primary">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${capacity.capacityPercentage}%`,
                        backgroundColor: capacity.isSoldOut
                          ? '#F87171'
                          : capacity.isNearCapacity
                            ? '#FBBF24'
                            : '#34D399',
                      }}
                    />
                  </View>
                  {capacity.isNearCapacity && (
                    <View className="flex-row items-center mt-3">
                      <Ionicons name="warning" size={12} color="#FBBF24" />
                      <Text className="text-xs font-medium text-amber-400 ml-1">
                        {capacity.availabilityMessage ||
                          `Near capacity — ${capacity.available} spots remaining`}
                      </Text>
                    </View>
                  )}
                </View>
              ) : null)}

            {/* Sold-out banner */}
            {soldOut && (
              <View
                className="rounded-2xl border px-4 py-3 mt-3 flex-row items-center"
                style={{
                  backgroundColor: 'rgba(248,113,113,0.08)',
                  borderColor: 'rgba(248,113,113,0.3)',
                }}
              >
                <Ionicons name="warning" size={16} color="#F87171" style={{ marginRight: 10 }} />
                <View>
                  <Text className="text-[13px] font-bold text-red-400">Event Sold Out</Text>
                  <Text className="text-[12px] text-red-400/70">
                    Walk-in entries are disabled. Dine-in is still available.
                  </Text>
                </View>
              </View>
            )}

            {/* Entry form card */}
            <View className="bg-background-secondary rounded-2xl px-4 py-5 mt-3">
              <Text className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">
                Entry Form
              </Text>

              {/* ── Person Name ──────────────────────────────────────────── */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-text-secondary mb-1.5">
                  Person Name <Text className="text-red-400">*</Text>
                </Text>
                <TextInput
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Enter full name…"
                  placeholderTextColor="#52525B"
                  autoCapitalize="words"
                  autoComplete="off"
                  className="bg-background-primary border border-border rounded-xl px-4 py-3 text-text-primary text-sm"
                />
              </View>

              {/* ── Contact No ───────────────────────────────────────────── */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-text-secondary mb-1.5">
                  Contact No <Text className="text-red-400">*</Text>
                </Text>
                <TextInput
                  value={contact}
                  onChangeText={(text) => setContact(text.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#52525B"
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoComplete="off"
                  style={
                    contact.length > 0 && contact.length < 10
                      ? {
                          backgroundColor: '#18181B',
                          borderWidth: 1,
                          borderColor: 'rgba(248,113,113,0.5)',
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          color: '#FAFAFA',
                          fontSize: 14,
                        }
                      : {
                          backgroundColor: '#18181B',
                          borderWidth: 1,
                          borderColor: '#27272A',
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          color: '#FAFAFA',
                          fontSize: 14,
                        }
                  }
                />
                {contact.length > 0 && contact.length < 10 && (
                  <Text className="text-xs font-medium text-red-400 mt-1 pl-1">
                    Enter exactly 10 digits ({10 - contact.length} remaining)
                  </Text>
                )}
              </View>

              {/* ── Email (optional) ─────────────────────────────────────── */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-text-secondary mb-1.5">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email (optional)…"
                  placeholderTextColor="#52525B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="off"
                  className="bg-background-primary border border-border rounded-xl px-4 py-3 text-text-primary text-sm"
                />
              </View>

              {/* ── Gender + Age — side by side ──────────────────────────── */}
              <View className="flex-row gap-3 mb-4">
                {/* Gender */}
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-text-secondary mb-1.5">
                    Gender <Text className="text-red-400">*</Text>
                  </Text>
                  <View className="flex-row gap-2" style={{ height: 46 }}>
                    {(['male', 'female'] as DoorGender[]).map((g) => (
                      <TouchableOpacity
                        key={g}
                        onPress={() => {
                          setGender(g);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        className="flex-1 rounded-xl items-center justify-center"
                        style={
                          gender === g
                            ? g === 'male'
                              ? {
                                  backgroundColor: 'rgba(59,130,246,0.2)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(59,130,246,0.3)',
                                  borderRadius: 12,
                                }
                              : {
                                  backgroundColor: 'rgba(236,72,153,0.2)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(236,72,153,0.3)',
                                  borderRadius: 12,
                                }
                            : {
                                backgroundColor: '#18181B',
                                borderWidth: 1,
                                borderColor: '#27272A',
                                borderRadius: 12,
                              }
                        }
                      >
                        <Text
                          className="text-sm font-bold capitalize"
                          style={{
                            color:
                              gender === g ? (g === 'male' ? '#60A5FA' : '#F472B6') : '#71717A',
                          }}
                        >
                          {g === 'male' ? 'Male' : 'Female'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Age */}
                <View style={{ width: 100 }}>
                  <Text className="text-xs font-semibold text-text-secondary mb-1.5">
                    Age <Text className="text-red-400">*</Text>
                  </Text>
                  <TextInput
                    value={age}
                    onChangeText={setAge}
                    placeholder="Age"
                    placeholderTextColor="#52525B"
                    keyboardType="number-pad"
                    maxLength={3}
                    style={{
                      height: 46,
                      backgroundColor: '#18181B',
                      borderWidth: 1,
                      borderColor: '#27272A',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      color: '#FAFAFA',
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>

              {/* ── Entry Type — mirrors Dashboard's Type <select> ───────── */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-text-secondary mb-1.5">
                  Type <Text className="text-red-400">*</Text>
                </Text>
                <View className="flex-row gap-3">
                  {[
                    {
                      key: 'walkins' as const,
                      label: 'Walk-ins',
                      icon: 'person-add-outline' as const,
                    },
                    {
                      key: 'dinein' as const,
                      label: 'Dine-ins',
                      icon: 'restaurant-outline' as const,
                    },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => {
                        setEntryType(t.key);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
                      style={
                        entryType === t.key
                          ? {
                              backgroundColor: 'rgba(99,102,241,0.15)',
                              borderWidth: 2,
                              borderColor: 'rgba(99,102,241,0.4)',
                              borderRadius: 12,
                            }
                          : {
                              backgroundColor: '#18181B',
                              borderWidth: 2,
                              borderColor: '#27272A',
                              borderRadius: 12,
                            }
                      }
                    >
                      <Ionicons
                        name={t.icon}
                        size={16}
                        color={entryType === t.key ? '#6366F1' : '#71717A'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        className="text-sm font-bold"
                        style={{ color: entryType === t.key ? '#6366F1' : '#71717A' }}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── Dine-ins: Guests with you — mirrors Dashboard AnimatePresence ── */}
              {entryType === 'dinein' && (
                <View className="mb-4">
                  <Text className="text-xs font-semibold text-text-secondary mb-1.5">
                    Guests with you <Text className="text-red-400">*</Text>
                  </Text>
                  <TextInput
                    value={totalGuests}
                    onChangeText={setTotalGuests}
                    placeholder="Total no. of guests…"
                    placeholderTextColor="#52525B"
                    keyboardType="number-pad"
                    maxLength={2}
                    className="bg-background-primary border border-border rounded-xl px-4 py-3 text-text-primary text-sm"
                  />
                </View>
              )}

              {/* ── Walk-ins: Today's Event card (auto-selected) ─────────── */}
              {/* Mirrors Dashboard's "Today's Events" picker — pre-selected since
                  the scanner is always scoped to a single event via event code. */}
              {entryType === 'walkins' && eventData && (
                <View
                  className="rounded-xl overflow-hidden mb-4"
                  style={{ borderWidth: 1, borderColor: '#27272A' }}
                >
                  {/* Section header */}
                  <View
                    className="flex-row items-center px-4 py-2.5"
                    style={{
                      backgroundColor: '#18181B',
                      borderBottomWidth: 1,
                      borderBottomColor: '#27272A',
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color="#71717A"
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-xs font-bold uppercase tracking-widest text-text-muted">
                      Today's Event
                    </Text>
                  </View>

                  {/* Pre-selected event card */}
                  <View className="p-3">
                    <View
                      className="flex-row items-center px-3 py-2.5 rounded-xl"
                      style={{
                        backgroundColor: 'rgba(99,102,241,0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(99,102,241,0.4)',
                      }}
                    >
                      {/* Avatar */}
                      <View
                        className="w-9 h-9 rounded-lg items-center justify-center"
                        style={{ backgroundColor: 'rgba(99,102,241,0.18)', marginRight: 12 }}
                      >
                        <Text className="text-sm font-black" style={{ color: '#6366F1' }}>
                          {(eventData.event.title ?? 'E').trim()[0].toUpperCase()}
                        </Text>
                      </View>

                      {/* Event name + time */}
                      <View className="flex-1">
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: '#6366F1' }}
                          numberOfLines={1}
                        >
                          {eventData.event.title}
                        </Text>
                        <Text className="text-xs text-text-muted mt-0.5">
                          {eventData.event.startTime || 'Time TBA'}
                        </Text>
                      </View>

                      {/* Pre-selected indicator */}
                      <View
                        className="w-4 h-4 rounded-full items-center justify-center"
                        style={{ borderWidth: 2, borderColor: '#6366F1', marginLeft: 8 }}
                      >
                        <View
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: '#6366F1' }}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ── Submit button — mirrors DoorSellClient submit ─────────── */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit}
                activeOpacity={0.8}
                className="py-3.5 rounded-xl items-center justify-center flex-row"
                style={{ backgroundColor: canSubmit ? '#6366F1' : 'rgba(99,102,241,0.4)' }}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-white text-sm font-black uppercase tracking-widest">
                      Submit Entry
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          WALK-INS TAB
          Mirrors: DoorWalkInsView — totals strip + animated entry list
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'walkins' && (
        <FlatList
          data={walkInEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshingWalkIns}
              onRefresh={async () => {
                setRefreshingWalkIns(true);
                await loadWalkIns(false);
                setRefreshingWalkIns(false);
              }}
              tintColor="#6366F1"
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              {/* Totals strip — mirrors DoorWalkInsView totals strip */}
              <View
                className="rounded-2xl px-5 py-4 flex-row items-center"
                style={{
                  backgroundColor: '#1C1C1E',
                  borderWidth: 1,
                  borderColor: '#27272A',
                  marginBottom: 12,
                }}
              >
                <View>
                  <Text
                    className="text-xs font-bold uppercase tracking-widest text-text-muted"
                    style={{ marginBottom: 2 }}
                  >
                    Walk-ins
                  </Text>
                  <Text className="text-text-primary font-black" style={{ fontSize: 24 }}>
                    {walkInEntries.length}
                  </Text>
                </View>
              </View>
              {/* List header */}
              <View
                className="rounded-t-2xl px-5 py-3.5"
                style={{
                  backgroundColor: '#1C1C1E',
                  borderWidth: 1,
                  borderColor: '#27272A',
                  borderBottomWidth: 0,
                }}
              >
                <Text className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Walk-in Entries
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const genderIsFemale = item.gender === 'female';
            const avatarBg = genderIsFemale ? 'rgba(236,72,153,0.1)' : 'rgba(59,130,246,0.1)';
            const avatarColor = genderIsFemale ? '#F472B6' : '#60A5FA';
            const time = new Date(item.addedAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const date = new Date(item.addedAt)
              .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              .toUpperCase();

            return (
              <View
                className="px-5 py-3.5 flex-row items-center"
                style={{
                  backgroundColor: '#1C1C1E',
                  borderWidth: 1,
                  borderTopWidth: 0,
                  borderColor: '#27272A',
                }}
              >
                {/* Avatar — matches DoorWalkInsView gender-coloured initial */}
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center"
                  style={{ backgroundColor: avatarBg, marginRight: 12 }}
                >
                  <Text className="text-xs font-black" style={{ color: avatarColor }}>
                    {(item.guestName[0] ?? '?').toUpperCase()}
                  </Text>
                </View>

                {/* Name + event title */}
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                    {item.guestName}
                  </Text>
                  {item.contact && (
                    <Text className="text-xs text-text-secondary" numberOfLines={1}>
                      {item.contact.length > 4 ? `••••${item.contact.slice(-4)}` : item.contact}
                    </Text>
                  )}
                </View>

                {/* Gender badge */}
                {item.gender && (
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: avatarBg, marginHorizontal: 8 }}
                  >
                    <Text className="text-xs font-bold uppercase" style={{ color: avatarColor }}>
                      {item.gender === 'male' ? 'M' : 'F'}
                    </Text>
                  </View>
                )}

                {/* Age */}
                {item.age ? (
                  <Text
                    className="text-xs text-text-secondary tabular-nums"
                    style={{ marginHorizontal: 8 }}
                  >
                    {item.age}
                  </Text>
                ) : (
                  <Text className="text-xs text-text-muted" style={{ marginHorizontal: 8 }}>
                    —
                  </Text>
                )}

                {/* Date + Time */}
                <View className="items-end">
                  <Text className="text-xs text-text-muted tabular-nums">{date}</Text>
                  <Text className="text-xs text-text-muted tabular-nums">{time}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View
              className="items-center py-16 rounded-2xl"
              style={{
                backgroundColor: '#1C1C1E',
                borderWidth: 1,
                borderTopWidth: 0,
                borderColor: '#27272A',
              }}
            >
              <View
                className="w-12 h-12 rounded-2xl items-center justify-center"
                style={{ backgroundColor: '#27272A', marginBottom: 12 }}
              >
                <Ionicons name="person-add-outline" size={20} color="#71717A" />
              </View>
              <Text className="text-sm text-text-muted">
                {loadingWalkIns ? 'Loading walk-ins…' : 'No walk-in entries yet'}
              </Text>
              {!loadingWalkIns && (
                <Text className="text-xs text-text-muted mt-1">
                  Use the Entry Form tab to add walk-in guests
                </Text>
              )}
            </View>
          }
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DINE-IN TAB
          Mirrors: DoorDineinClient — tables + total guests strip + entry list
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dinein' && (
        <FlatList
          data={dineInEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshingDineIns}
              onRefresh={async () => {
                setRefreshingDineIns(true);
                await loadDineIns(false);
                setRefreshingDineIns(false);
              }}
              tintColor="#6366F1"
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              {/* Totals strip — mirrors DoorDineinClient totals strip */}
              <View
                className="rounded-2xl px-5 py-4 flex-row items-center"
                style={{
                  backgroundColor: '#1C1C1E',
                  borderWidth: 1,
                  borderColor: '#27272A',
                  marginBottom: 12,
                }}
              >
                <View>
                  <Text
                    className="text-xs font-bold uppercase tracking-widest text-text-muted"
                    style={{ marginBottom: 2 }}
                  >
                    Tables
                  </Text>
                  <Text className="text-text-primary font-black" style={{ fontSize: 24 }}>
                    {dineInEntries.length}
                  </Text>
                </View>
                <View
                  style={{ width: 1, height: 40, backgroundColor: '#27272A', marginHorizontal: 24 }}
                />
                <View>
                  <Text
                    className="text-xs font-bold uppercase tracking-widest text-text-muted"
                    style={{ marginBottom: 2 }}
                  >
                    Total Guests
                  </Text>
                  <Text className="text-text-primary font-black" style={{ fontSize: 24 }}>
                    {dineInEntries.reduce((s, e) => s + (e.totalGuests || 1), 0)}
                  </Text>
                </View>
              </View>
              {/* List header */}
              <View
                className="rounded-t-2xl px-5 py-3.5"
                style={{
                  backgroundColor: '#1C1C1E',
                  borderWidth: 1,
                  borderColor: '#27272A',
                  borderBottomWidth: 0,
                }}
              >
                <Text className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Dine-in Entries
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const genderIsFemale = item.gender === 'female';
            const avatarBg = genderIsFemale ? 'rgba(236,72,153,0.1)' : 'rgba(59,130,246,0.1)';
            const avatarColor = genderIsFemale ? '#F472B6' : '#60A5FA';
            const time = new Date(item.addedAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const date = new Date(item.addedAt)
              .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              .toUpperCase();

            return (
              <View
                className="px-5 py-3.5 flex-row items-center"
                style={{
                  backgroundColor: '#1C1C1E',
                  borderWidth: 1,
                  borderTopWidth: 0,
                  borderColor: '#27272A',
                }}
              >
                {/* Avatar — dine-in uses amber utensil icon, matching DoorDineinClient */}
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center"
                  style={{ backgroundColor: 'rgba(251,191,36,0.1)', marginRight: 12 }}
                >
                  <Ionicons name="restaurant-outline" size={14} color="#FBBF24" />
                </View>

                {/* Name */}
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                    {item.guestName}
                  </Text>
                  <View className="flex-row items-center" style={{ gap: 8, marginTop: 2 }}>
                    <Ionicons name="people-outline" size={11} color="#71717A" />
                    <Text className="text-xs text-text-secondary">
                      {item.totalGuests} {item.totalGuests === 1 ? 'guest' : 'guests'}
                    </Text>
                  </View>
                </View>

                {/* Gender badge — matches DoorDineinClient gender column */}
                {item.gender && (
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: avatarBg, marginHorizontal: 8 }}
                  >
                    <Text className="text-xs font-bold uppercase" style={{ color: avatarColor }}>
                      {item.gender === 'male' ? 'M' : 'F'}
                    </Text>
                  </View>
                )}

                {/* Age */}
                {item.age > 0 ? (
                  <Text
                    className="text-xs text-text-secondary tabular-nums"
                    style={{ marginHorizontal: 8 }}
                  >
                    {item.age}
                  </Text>
                ) : (
                  <Text className="text-xs text-text-muted" style={{ marginHorizontal: 8 }}>
                    —
                  </Text>
                )}

                {/* Date + Time + party size */}
                <View className="items-end">
                  <Text className="text-xs text-text-muted tabular-nums">{date}</Text>
                  <Text className="text-xs text-text-muted tabular-nums">{time}</Text>
                  <View className="flex-row items-center" style={{ gap: 4, marginTop: 2 }}>
                    <Ionicons name="people-outline" size={11} color="#71717A" />
                    <Text className="text-sm font-bold tabular-nums text-text-primary">
                      {item.totalGuests}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View
              className="items-center py-16 rounded-2xl"
              style={{
                backgroundColor: '#1C1C1E',
                borderWidth: 1,
                borderTopWidth: 0,
                borderColor: '#27272A',
              }}
            >
              <View
                className="w-12 h-12 rounded-2xl items-center justify-center"
                style={{ backgroundColor: '#27272A', marginBottom: 12 }}
              >
                <Ionicons name="restaurant-outline" size={20} color="#71717A" />
              </View>
              <Text className="text-sm text-text-muted">
                {loadingDineIns ? 'Loading dine-in sessions…' : 'No dine-in entries yet'}
              </Text>
              {!loadingDineIns && (
                <Text className="text-xs text-text-muted mt-1">
                  Use the Entry Form tab to add dine-in guests
                </Text>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
