import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useScannerStore } from '@/store/scannerStore';
import { createDoorEntry } from '@/lib/scanner';
import { randomUUID } from 'expo-crypto';
import { EventTier } from '@/lib/scanner/types';
import { colors, gradients } from '@/lib/design/theme';
import QRCode from 'react-native-qrcode-svg';

type PaymentMethod = 'cash' | 'upi' | 'card';

export default function DoorEntryScreen() {
  const { eventData, sessionToken } = useScannerStore();

  // H1: Idempotency key — generated once per form session, regenerated on resetForm
  const idempotencyKeyRef = useRef<string>(randomUUID());

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [selectedTier, setSelectedTier] = useState<EventTier | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  useEffect(() => {
    if (!eventData?.valid) router.replace('/scanner' as any);
  }, []);

  const tiers = eventData?.tiers || [];
  const canDoorEntry = eventData?.permissions.canDoorEntry ?? false;
  const total = selectedTier ? selectedTier.price * quantity : 0;

  const resetForm = () => {
    // Generate new idempotency key for next guest
    idempotencyKeyRef.current = randomUUID();
    setGuestName('');
    setGuestPhone('');
    setSelectedTier(null);
    setQuantity(1);
    setPaymentMethod('cash');
    setSuccessData(null);
  };

  const handleSubmit = async () => {
    if (!guestName.trim()) {
      Alert.alert('Required', 'Please enter guest name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!selectedTier) {
      Alert.alert('Required', 'Please select a ticket type');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await createDoorEntry(
        {
          eventCode: eventData?.code || '',
          eventId: eventData?.event.id || '',
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim() || undefined,
          tierId: selectedTier.id,
          tierName: selectedTier.name,
          entryType: selectedTier.entryType,
          quantity,
          unitPrice: selectedTier.price,
          totalAmount: total,
          paymentMethod,
          gate: eventData?.gate,
          idempotencyKey: idempotencyKeyRef.current,
        },
        sessionToken || eventData?.sessionToken,
      );

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuccessData({
          ...result,
          guestName: guestName.trim(),
          tierName: selectedTier.name,
          quantity,
          total,
        });
      } else {
        Alert.alert('Error', result.error || 'Failed to create entry');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success Screen ──
  if (successData) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.success }]}>
        <View style={styles.successContent}>
          <Text style={{ fontSize: 72 }}>✅</Text>
          <Text style={styles.successTitle}>Entry Confirmed!</Text>
          <View style={styles.successCard}>
            <Text style={styles.successName}>{successData.guestName}</Text>
            <Text style={styles.successTier}>
              {successData.tierName}
              {successData.quantity > 1 ? ` × ${successData.quantity}` : ''}
            </Text>
            <Text style={styles.successTotal}>₹{successData.total.toLocaleString()}</Text>
          </View>
          {successData.qrData && (
            <View style={styles.successQrCard}>
              <QRCode
                value={successData.qrData}
                size={160}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
          )}
          <Text style={styles.successOrderId}>Order: {successData.orderId}</Text>
          <Pressable onPress={resetForm} style={styles.successButton}>
            <Text style={styles.successButtonText}>Next Guest</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── No Permission ──
  if (!canDoorEntry) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={{ fontSize: 56 }}>🔒</Text>
        <Text style={styles.noPermTitle}>Door Entry Disabled</Text>
        <Text style={styles.noPermSub}>This event code does not have door entry permission</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back to Scanner</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Main Form ──
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Door Entry</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
        {/* Guest Info */}
        <Text style={styles.sectionLabel}>GUEST INFORMATION</Text>
        <View style={styles.formCard}>
          <TextInput
            value={guestName}
            onChangeText={setGuestName}
            placeholder="Guest Name *"
            placeholderTextColor={colors.goldMetallic}
            style={[styles.textInput, styles.textInputBorder]}
            autoCapitalize="words"
          />
          <TextInput
            value={guestPhone}
            onChangeText={setGuestPhone}
            placeholder="Phone (optional)"
            placeholderTextColor={colors.goldMetallic}
            style={styles.textInput}
            keyboardType="phone-pad"
          />
          {eventData?.gate && (
            <View style={styles.gateBadge}>
              <Text style={styles.gateBadgeText}>{eventData.gate}</Text>
            </View>
          )}
        </View>

        {/* Ticket Type */}
        <Text style={styles.sectionLabel}>TICKET TYPE</Text>
        <View style={styles.tiersRow}>
          {tiers.map((tier) => (
            <Pressable
              key={tier.id}
              onPress={() => {
                setSelectedTier(tier);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              disabled={!tier.available}
              style={[
                styles.tierCard,
                selectedTier?.id === tier.id && styles.tierCardSelected,
                !tier.available && styles.tierCardDisabled,
              ]}
            >
              <Text
                style={[styles.tierName, selectedTier?.id === tier.id && styles.tierNameSelected]}
              >
                {tier.name}
              </Text>
              <Text
                style={[styles.tierPrice, selectedTier?.id === tier.id && styles.tierPriceSelected]}
              >
                ₹{tier.price}
              </Text>
              {!tier.available && <Text style={styles.tierSoldOut}>Sold Out</Text>}
            </Pressable>
          ))}
        </View>

        {/* Quantity */}
        <Text style={styles.sectionLabel}>QUANTITY</Text>
        <View style={styles.quantityRow}>
          <Pressable
            onPress={() => {
              if (quantity > 1) {
                setQuantity(quantity - 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            disabled={quantity <= 1}
            style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </Pressable>
          <Text style={styles.qtyValue}>{quantity}</Text>
          <Pressable
            onPress={() => {
              setQuantity(quantity + 1);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.qtyBtn}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </Pressable>
        </View>

        {/* Payment Method */}
        <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
        <View style={styles.paymentRow}>
          {[
            { id: 'cash' as const, icon: '💵', label: 'Cash' },
            { id: 'upi' as const, icon: '📱', label: 'UPI' },
            { id: 'card' as const, icon: '💳', label: 'Card' },
          ].map((method) => (
            <Pressable
              key={method.id}
              onPress={() => {
                setPaymentMethod(method.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.paymentCard,
                paymentMethod === method.id && styles.paymentCardSelected,
              ]}
            >
              <Text style={{ fontSize: 24 }}>{method.icon}</Text>
              <Text
                style={[
                  styles.paymentLabel,
                  paymentMethod === method.id && styles.paymentLabelSelected,
                ]}
              >
                {method.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCta}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{total.toLocaleString()}</Text>
        </View>
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !selectedTier || !guestName.trim()}
          style={[
            styles.submitBtn,
            (isSubmitting || !selectedTier || !guestName.trim()) && styles.submitBtnDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>✓ Admit Guest</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  formScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: {
    color: colors.goldMetallic,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 20,
  },
  formCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  textInput: { color: colors.gold, fontSize: 17, paddingVertical: 14 },
  textInputBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  gateBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gateBadgeText: { color: colors.goldMetallic, fontSize: 12, fontWeight: '700' },
  tiersRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  tierCard: {
    flex: 1,
    minWidth: 100,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tierCardSelected: { borderColor: colors.iris, backgroundColor: 'rgba(244,74,34,0.12)' },
  tierCardDisabled: { opacity: 0.4 },
  tierName: { color: colors.gold, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  tierNameSelected: { color: colors.iris },
  tierPrice: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  tierPriceSelected: { color: colors.irisGlow },
  tierSoldOut: { color: colors.goldMetallic, fontSize: 11, marginTop: 4 },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  qtyBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.iris,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  qtyBtnText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  qtyValue: { flex: 1, textAlign: 'center', color: colors.gold, fontSize: 36, fontWeight: '800' },
  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentCard: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
  },
  paymentCardSelected: { borderColor: colors.iris, backgroundColor: 'rgba(244,74,34,0.12)' },
  paymentLabel: { color: colors.goldMetallic, fontSize: 13, fontWeight: '600', marginTop: 4 },
  paymentLabelSelected: { color: colors.iris },
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.base[50],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  totalLabel: { color: colors.goldMetallic, fontSize: 16 },
  totalValue: { color: colors.gold, fontSize: 28, fontWeight: '800' },
  submitBtn: {
    backgroundColor: colors.success,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Success
  successContent: { alignItems: 'center', paddingHorizontal: 32 },
  successTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 16 },
  successCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 24,
    marginTop: 20,
    alignItems: 'center',
  },
  successName: { color: '#fff', fontSize: 22, fontWeight: '700' },
  successTier: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginTop: 8 },
  successTotal: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 12 },
  successQrCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginTop: 20 },
  successOrderId: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 20 },
  successButton: {
    backgroundColor: '#fff',
    marginTop: 28,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 14,
  },
  successButtonText: { color: colors.success, fontSize: 17, fontWeight: '700' },

  // No permission
  noPermTitle: { color: colors.gold, fontSize: 22, fontWeight: '700', marginTop: 16 },
  noPermSub: {
    color: colors.goldMetallic,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  backBtn: { marginTop: 24 },
  backBtnText: { color: colors.iris, fontSize: 16, fontWeight: '600' },
});
