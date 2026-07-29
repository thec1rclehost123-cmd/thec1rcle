import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Users, User, Sparkles, Crown, Ticket } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEventsStore, type Event, type TicketTier } from '@/store/eventsStore';
import { useCartStore } from '@/store/cartStore';
import { useShallow } from 'zustand/react/shallow';
import { colors, gradients, typography } from '@/lib/design/theme';
import { resolveEventAccentColor, TICKET_ACCENT } from '@/hooks/useEventAccent';
import { getEventImage } from '@/lib/utils/event';
import { formatEventDate, formatEventTime } from '@/lib/utils/date';
import { discardPendingCheckout } from '@/lib/payments';
import { formatInr } from '@/lib/money';

const ticketFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

function getTierMeta(tier: TicketTier, index: number) {
  const fallbackDescriptions = [
    'Entry access, event group chat unlock, and QR ticket delivery after payment.',
    'Priority entry window with a dedicated check-in lane and event access.',
    'Premium access with host-managed perks where available.',
  ];

  const benefits = [
    tier.entryType ? `${tier.entryType} access` : 'Mobile QR ticket',
    'Instant ticket wallet sync',
    'Transfer eligible after purchase',
  ];

  return {
    description: tier.description || fallbackDescriptions[index] || fallbackDescriptions[0],
    benefits,
  };
}

function getTicketPersona(tier: TicketTier) {
  const source = `${tier.name} ${tier.description || ''} ${tier.entryType || ''}`.toLowerCase();
  if (source.includes('couple')) {
    return {
      kind: 'couple',
      label: 'Couple',
      caption: 'Two tickets are pairing up.',
      palette: ['#FF6B8A', '#FFB86B', '#8C5CFF'],
    };
  }
  if (source.includes('stag') || source.includes('male') || source.includes('gent')) {
    return {
      kind: 'stag',
      label: 'Stag',
      caption: 'A sharp solo entry just joined.',
      palette: ['#4BA3FF', '#73E2A7', '#F44A22'],
    };
  }
  if (source.includes('female') || source.includes('ladies') || source.includes('women')) {
    return {
      kind: 'ladies',
      label: 'Ladies',
      caption: 'The glam crew is getting ready.',
      palette: ['#FF7AD9', '#FFD166', '#9B8CFF'],
    };
  }
  if (source.includes('vip') || source.includes('premium') || source.includes('table')) {
    return {
      kind: 'vip',
      label: 'VIP',
      caption: 'A premium guest is stepping in.',
      palette: ['#F7C948', '#F44A22', '#FFFFFF'],
    };
  }
  return {
    kind: 'general',
    label: 'General',
    caption: 'Your night is taking shape.',
    palette: ['#F44A22', '#FFB86B', '#64D2FF'],
  };
}

function getPersonaImage(kind: string) {
  switch (kind) {
    case 'couple':
      return require('../../assets/images/personas/couple.png');
    case 'stag':
      return require('../../assets/images/personas/stag.png');
    case 'ladies':
      return require('../../assets/images/personas/ladies.png');
    case 'vip':
      return require('../../assets/images/personas/vip.png');
    default:
      return require('../../assets/images/personas/general.png');
  }
}

function MiniCharacter({
  persona,
  index,
}: {
  persona: ReturnType<typeof getTicketPersona>;
  index: number;
}) {
  const imageSource = getPersonaImage(persona.kind);
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 45)}
      style={[styles.avatarWrap, { marginLeft: index > 0 ? -16 : 0, zIndex: 10 - index }]}
    >
      <Image source={imageSource} style={styles.avatarImage} contentFit="cover" transition={200} />
      {persona.kind === 'vip' && (
        <View style={styles.vipBadge}>
          <Crown size={12} color="#000" strokeWidth={3} />
        </View>
      )}
    </Animated.View>
  );
}

function TicketCharacterStage({
  selectedItems,
}: {
  selectedItems: Array<{ tier: TicketTier; quantity: number }>;
}) {
  const total = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasTickets = total > 0;
  if (!hasTickets) return null;

  const characters = selectedItems
    .flatMap((item) => {
      const persona = getTicketPersona(item.tier);
      return Array.from({ length: Math.min(item.quantity, 6) }, (_, index) => ({
        id: `${item.tier.id}-${index}`,
        persona,
      }));
    })
    .slice(0, 5);

  return (
    <Animated.View entering={FadeInDown.delay(80)} style={styles.characterStage}>
      <View style={styles.characterRunway}>
        {characters.map((character, index) => (
          <MiniCharacter key={character.id} persona={character.persona} index={index} />
        ))}
      </View>
    </Animated.View>
  );
}

function QuantityButton({
  disabled,
  icon,
  onPress,
}: {
  disabled?: boolean;
  icon: 'add' | 'remove';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.quantityButton, disabled && styles.quantityButtonDisabled]}
    >
      <Ionicons name={icon} size={16} color={disabled ? 'rgba(255,255,255,0.28)' : '#fff'} />
    </Pressable>
  );
}

function QuantityDial({ value }: { value: number }) {
  const previous = useRef(value);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (previous.current === value) return;
    const direction = value > previous.current ? 1 : -1;
    translateY.value = direction * 18;
    opacity.value = 0.25;
    translateY.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) });
    previous.current = value;
  }, [opacity, translateY, value]);

  const dialStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.quantityDialWindow}>
      <Animated.Text key={value} style={[styles.quantityValue, dialStyle]}>
        {value}
      </Animated.Text>
    </View>
  );
}

function TicketTierRow({
  tier,
  index,
  quantity,
  onChange,
  expanded,
  onToggleDetails,
}: {
  tier: TicketTier;
  index: number;
  quantity: number;
  onChange: (nextQuantity: number) => void;
  expanded: boolean;
  onToggleDetails: () => void;
}) {
  const isSoldOut = tier.remaining <= 0;
  const isLowStock = tier.remaining > 0 && tier.remaining <= 8;
  const limit =
    Number(tier.price || 0) <= 0
      ? Math.min(Math.max(tier.remaining || 0, 0), 1)
      : Math.max(0, Math.min(tier.remaining || 0, 10));
  const meta = getTierMeta(tier, index);
  const availabilityLabel = isSoldOut
    ? 'Sold out'
    : isLowStock
      ? `${tier.remaining} left`
      : 'Available';
  const persona = getTicketPersona(tier);
  const accentColor = persona.palette[0];
  const rowSelected = quantity > 0;

  return (
    <View
      style={[
        styles.tierRow,
        rowSelected && styles.tierRowSelected,
        isSoldOut && styles.tierRowSoldOut,
      ]}
    >
      <View
        style={[
          styles.tierAccent,
          { backgroundColor: rowSelected ? accentColor : 'rgba(255,255,255,0.12)' },
        ]}
      />
      <View style={styles.tierMainRow}>
        <View style={styles.tierTitleWrap}>
          <Pressable onPress={onToggleDetails} style={styles.tierNameRow}>
            <Text style={styles.tierName} numberOfLines={2}>
              {tier.name}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={colors.goldStone}
            />
          </Pressable>
          <View style={styles.tierMetaLine}>
            <Text style={styles.tierPrice}>{formatInr(tier.price)}</Text>
            {isLowStock || isSoldOut ? (
              <>
                <View style={styles.tierMetaDot} />
                <Text
                  style={[
                    styles.tierStock,
                    isLowStock && styles.tierStockUrgent,
                    isSoldOut && styles.tierStockSoldOut,
                  ]}
                >
                  {availabilityLabel}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.tierControls}>
          <View style={styles.quantityControl}>
            <QuantityButton
              icon="remove"
              disabled={quantity <= 0 || isSoldOut}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(Math.max(0, quantity - 1));
              }}
            />
            <QuantityDial value={quantity} />
            <QuantityButton
              icon="add"
              disabled={isSoldOut || quantity >= limit}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(Math.min(limit, quantity + 1));
              }}
            />
          </View>
        </View>
      </View>

      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.tierExpanded}
        >
          <Text style={styles.tierDescription}>{meta.description}</Text>
          <View style={styles.benefitWrap}>
            {meta.benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <View style={styles.benefitDot} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.inventoryLabel}>Max {limit || 0} per order</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function TicketSelectionScreen() {
  const { eventId, ref } = useLocalSearchParams<{ eventId?: string; ref?: string }>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { getEventById, events, featuredEvents } = useEventsStore(
    useShallow((state) => ({
      getEventById: state.getEventById,
      events: state.events,
      featuredEvents: state.featuredEvents,
    })),
  );
  const { cartItems, clearCart, addItem } = useCartStore(
    useShallow((state) => ({
      cartItems: state.items,
      clearCart: state.clearCart,
      addItem: state.addItem,
    })),
  );
  const [event, setEvent] = useState<Event | null>(() => {
    if (!eventId) return null;
    return (
      events.find((candidate) => candidate.id === eventId) ||
      featuredEvents.find((candidate) => candidate.id === eventId) ||
      null
    );
  });
  const [loading, setLoading] = useState(!event);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      cartItems
        .filter((item) => item.eventId === eventId)
        .map((item) => [item.tier.id, item.quantity]),
    ),
  );
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadEvent() {
      if (!eventId || event) return;
      setLoading(true);
      const loadedEvent = await getEventById(eventId);
      if (!cancelled) {
        setEvent(loadedEvent);
        setLoading(false);
      }
    }
    void loadEvent();
    return () => {
      cancelled = true;
    };
  }, [eventId, event, getEventById]);

  const tiers = event?.tickets?.length ? event.tickets : [];

  const selectedItems = useMemo(() => {
    return tiers
      .map((tier) => ({ tier, quantity: quantities[tier.id] || 0 }))
      .filter((item) => item.quantity > 0);
  }, [tiers, quantities]);

  const ticketCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = selectedItems.reduce((sum, item) => sum + item.tier.price * item.quantity, 0);
  const eventImage = event ? getEventImage(event) : undefined;
  const venueLabel = event?.venue || event?.location || 'Venue TBA';
  const clubLabel = event?.hostName || venueLabel;
  const heroTopPadding = Math.max(0, Math.round(screenHeight * 0.12 - insets.top - 48));
  const bottomHelper =
    ticketCount > 0
      ? selectedItems.map((item) => `${item.quantity}x ${item.tier.name}`).join(' · ')
      : 'Select tickets';

  const posterAccent = event ? resolveEventAccentColor(event as any, 'ticket') : TICKET_ACCENT;

  const handleProceed = async () => {
    if (!event || selectedItems.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await discardPendingCheckout();
    } catch {
      Alert.alert('Tickets still held', 'Could not release the current hold. Please retry.');
      return;
    }
    clearCart();
    selectedItems.forEach(({ tier, quantity }) => {
      addItem({
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.startDate,
        eventTimezone: event.timezone,
        eventVenue: venueLabel,
        eventCoverImage: eventImage ?? undefined,
        eventAccentColor: posterAccent,
        tier,
        quantity,
        promoterCode: typeof ref === 'string' ? ref : undefined,
      });
    });
    router.push('/checkout');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator color={colors.iris} />
        <Text style={styles.loadingText}>Loading tickets...</Text>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Ionicons name="ticket-outline" size={42} color={colors.iris} />
        <Text style={styles.emptyTitle}>Tickets unavailable</Text>
        <Text style={styles.emptyCopy}>This event could not be found.</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 92 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.eventHero, { paddingTop: heroTopPadding }]}>
          <View
            style={[
              styles.heroPoster,
              { shadowColor: posterAccent, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16 },
            ]}
          >
            {eventImage ? (
              <Image
                source={{ uri: eventImage }}
                style={styles.heroPosterImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <LinearGradient
                colors={gradients.primary as [string, string]}
                style={styles.heroPosterImage}
              />
            )}
          </View>
          <View style={styles.heroDetails}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.heroOrgName} numberOfLines={1}>
              {clubLabel}
            </Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.52)" />
              <Text style={styles.heroMetaText}>
                {formatEventDate(event.startDate, event.timezone)} ·{' '}
                {formatEventTime(event.startDate, event.timezone)}
              </Text>
            </View>
            <View style={styles.heroMetaRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.52)" />
              <Text style={styles.heroMetaText} numberOfLines={1}>
                {venueLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.ticketSelector}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Secure your entry</Text>
              <Text style={styles.sectionTitle}>Choose tickets</Text>
            </View>
            <View style={[styles.sectionMetaPill, ticketCount > 0 && styles.sectionMetaPillActive]}>
              <Text style={[styles.sectionMeta, ticketCount > 0 && styles.sectionMetaActive]}>
                {ticketCount} selected
              </Text>
            </View>
          </View>

          <TicketCharacterStage selectedItems={selectedItems} />

          {tiers.length > 0 ? (
            tiers.map((tier, index) => (
              <TicketTierRow
                key={tier.id}
                tier={tier}
                index={index}
                quantity={quantities[tier.id] || 0}
                expanded={!!expandedTiers[tier.id]}
                onToggleDetails={() => {
                  setExpandedTiers((current) => ({
                    ...current,
                    [tier.id]: !current[tier.id],
                  }));
                }}
                onChange={(nextQuantity) => {
                  setQuantities((current) => ({
                    ...current,
                    [tier.id]: nextQuantity,
                  }));
                }}
              />
            ))
          ) : (
            <View style={styles.emptyTicketState}>
              <Ionicons name="ticket-outline" size={24} color={colors.goldStone} />
              <Text style={styles.emptyTicketTitle}>Tickets are not available yet</Text>
              <Text style={styles.emptyTicketCopy}>
                This event has no live ticket tiers from the organizer.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { bottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.bottomCopy}>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomTotal}>{formatInr(subtotal)}</Text>
          <Text style={styles.bottomCount} numberOfLines={1}>
            {bottomHelper}
          </Text>
        </View>
        <Pressable
          onPress={handleProceed}
          disabled={selectedItems.length === 0}
          style={[styles.proceedButton, selectedItems.length === 0 && styles.proceedButtonDisabled]}
        >
          <Text style={styles.proceedButtonText}>Proceed</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.base.DEFAULT,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: colors.goldStone,
    marginTop: 12,
    fontFamily: ticketFont.medium,
  },
  emptyTitle: {
    color: colors.gold,
    fontFamily: ticketFont.black,
    fontSize: 22,
    marginTop: 18,
  },
  emptyCopy: {
    color: colors.goldStone,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  emptyTicketState: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 18,
    paddingVertical: 24,
    marginTop: 12,
  },
  emptyTicketTitle: {
    color: colors.gold,
    fontFamily: ticketFont.bold,
    fontSize: 16,
    marginTop: 10,
  },
  emptyTicketCopy: {
    color: colors.goldStone,
    fontFamily: ticketFont.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.gold,
    fontFamily: ticketFont.bold,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  backButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  backButtonText: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 13,
  },
  headerTitle: {
    color: colors.gold,
    fontSize: 18,
    fontFamily: ticketFont.black,
    fontWeight: '900',
  },
  eventHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingHorizontal: 20,
    gap: 16,
  },
  heroPoster: {
    width: 133,
    height: 177,
    borderRadius: 16,
    backgroundColor: colors.base[100],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  heroPosterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroDetails: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: ticketFont.black,
    fontWeight: '900',
    textAlign: 'left',
  },
  heroOrgName: {
    color: colors.gold,
    fontFamily: ticketFont.black,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'left',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
    marginTop: 6,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: ticketFont.medium,
    fontSize: 12,
    textAlign: 'left',
  },
  ticketSelector: {
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 10,
  },
  sectionEyebrow: {
    color: colors.irisGlow,
    fontFamily: ticketFont.bold,
    fontSize: 10,
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 25,
    lineHeight: 28,
    fontFamily: ticketFont.black,
    fontWeight: '900',
  },
  sectionMetaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  sectionMetaPillActive: {
    backgroundColor: 'rgba(244,74,34,0.16)',
    borderColor: 'rgba(244,74,34,0.36)',
  },
  sectionMeta: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: ticketFont.bold,
    fontSize: 11,
  },
  sectionMetaActive: {
    color: colors.gold,
  },
  characterStage: {
    marginTop: 12,
    marginBottom: 24,
  },
  characterStageCopy: {
    marginBottom: 6,
  },
  characterStageTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  characterStageEyebrow: {
    color: colors.irisGlow,
    fontFamily: ticketFont.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  previewStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  previewStatusPillActive: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  previewStatusText: {
    color: colors.goldStone,
    fontFamily: ticketFont.bold,
    fontSize: 10,
  },
  previewStatusTextActive: {
    color: colors.gold,
  },
  characterStageTitle: {
    color: colors.gold,
    fontFamily: ticketFont.black,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 7,
  },
  characterRunway: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: 'transparent',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  vipBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#F7C948',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#161616',
  },
  tierRow: {
    position: 'relative',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.075)',
    paddingVertical: 8,
    paddingLeft: 13,
    paddingRight: 11,
    marginBottom: 7,
  },
  tierRowSelected: {
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tierRowSoldOut: {
    opacity: 0.56,
  },
  tierAccent: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 0,
    borderRadius: 2,
  },
  tierMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  tierTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  tierNameRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    marginBottom: 6,
  },
  tierIndex: {
    color: 'rgba(255,255,255,0.36)',
    fontFamily: ticketFont.bold,
    fontSize: 10,
  },
  addedBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(244,74,34,0.22)',
  },
  addedBadgeText: {
    color: colors.gold,
    fontFamily: ticketFont.bold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  tierMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  tierName: {
    color: colors.gold,
    fontFamily: ticketFont.black,
    fontWeight: '900',
    fontSize: 17,
    lineHeight: 20,
  },
  tierDescription: {
    color: colors.goldStone,
    fontFamily: ticketFont.regular,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tierPrice: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: ticketFont.medium,
    fontWeight: '900',
    fontSize: 14,
  },
  tierMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  tierStock: {
    color: colors.success,
    fontFamily: ticketFont.bold,
    fontSize: 12,
  },
  tierStockUrgent: {
    color: colors.warning,
  },
  tierStockSoldOut: {
    color: colors.goldStone,
  },
  tierControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierDisclosure: {
    width: 28,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierExpanded: {
    paddingTop: 12,
  },
  benefitWrap: {
    gap: 7,
    marginBottom: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.irisGlow,
  },
  benefitText: {
    color: 'rgba(255,255,255,0.76)',
    fontFamily: ticketFont.medium,
    fontSize: 11,
  },
  inventoryLabel: {
    color: colors.goldStone,
    fontFamily: ticketFont.bold,
    fontSize: 12,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  quantityButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  quantityDialWindow: {
    width: 22,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  quantityValue: {
    minWidth: 24,
    textAlign: 'center',
    color: colors.gold,
    fontFamily: ticketFont.black,
    fontSize: 17,
    fontWeight: '900',
  },
  bottomBar: {
    position: 'absolute',
    left: 22,
    right: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(10,10,10,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
  },
  bottomCopy: {
    flex: 1,
    minWidth: 0,
  },
  bottomLabel: {
    color: colors.goldStone,
    fontFamily: ticketFont.medium,
    fontSize: 10,
  },
  bottomTotal: {
    color: colors.gold,
    fontFamily: ticketFont.black,
    fontSize: 18,
    fontWeight: '900',
  },
  bottomCount: {
    color: 'rgba(255,255,255,0.48)',
    fontFamily: ticketFont.medium,
    fontSize: 10,
  },
  proceedButton: {
    minWidth: 108,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.iris,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonDisabled: {
    opacity: 0.34,
  },
  proceedButtonText: {
    color: '#fff',
    fontFamily: ticketFont.black,
    fontSize: 14,
    fontWeight: '900',
  },
});
