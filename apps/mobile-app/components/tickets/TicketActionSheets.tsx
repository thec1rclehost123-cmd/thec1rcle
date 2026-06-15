import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import type { OrderTicket } from '@/store/ticketsStore';

interface ActionSheetProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

interface TicketTierGroup {
  id: string;
  name: string;
  gender?: string;
  count: number;
}

interface ShareSheetContentProps {
  tickets?: OrderTicket[];
  onShare: (channel: string, tierId?: string, expiresAt?: string) => Promise<void>;
}

interface TransferSheetContentProps {
  genderRestriction?: string;
  onTransferEmail: (email: string) => Promise<void>;
  onGenerateLink: () => Promise<void>;
}

const SHARE_OPTIONS = [
  { id: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', gradient: ['#25D366', '#128C7E'] },
  {
    id: 'instagram',
    icon: 'logo-instagram',
    label: 'Instagram',
    gradient: ['#833AB4', '#E1306C', '#FD1D1D'],
  },
  { id: 'sms', icon: 'chatbubble', label: 'Message', gradient: ['#34C759', '#28A745'] },
  { id: 'email', icon: 'mail', label: 'Email', gradient: ['#5856D6', '#4543C4'] },
  { id: 'copy', icon: 'copy', label: 'Copy Link', gradient: ['#8E8E93', '#636366'] },
] as const;

function buildTierGroups(tickets: OrderTicket[] = []): TicketTierGroup[] {
  return tickets
    .filter((ticket) => !ticket.isClaimed && ticket.tierId)
    .reduce<TicketTierGroup[]>((groups, ticket) => {
      const existing = groups.find((group) => group.id === ticket.tierId);
      if (existing) {
        existing.count += Math.max(ticket.quantity || 1, 1);
        return groups;
      }

      groups.push({
        id: ticket.tierId,
        name: ticket.tierName || 'General Entry',
        gender: ticket.requiredGender,
        count: Math.max(ticket.quantity || 1, 1),
      });
      return groups;
    }, []);
}

export function ActionSheet({
  isVisible,
  onClose,
  title,
  description,
  children,
}: ActionSheetProps) {
  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.modalContainer}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(250)}
          exiting={SlideOutDown.duration(200)}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <View style={styles.content}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ShareSheetContent({ tickets, onShare }: ShareSheetContentProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [expiryMode, setExpiryMode] = useState<'24h' | '48h' | 'event'>('event');

  const tiers = buildTierGroups(tickets);

  useEffect(() => {
    if (tiers.length === 1 && !selectedTierId) {
      setSelectedTierId(tiers[0].id);
    }
  }, [selectedTierId, tiers]);

  const selectedTier = tiers.find((tier) => tier.id === selectedTierId);

  const handleShare = async (channel: string) => {
    if (tiers.length > 1 && !selectedTierId) {
      Alert.alert('Select Ticket', 'Choose a ticket type to share first.');
      return;
    }

    setLoading(channel);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let expiresAt: string | undefined;
    if (expiryMode === '24h') expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (expiryMode === '48h') expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await onShare(channel, selectedTierId || tiers[0]?.id, expiresAt);
    setLoading(null);
  };

  return (
    <View>
      {tiers.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Select Ticket Type</Text>
          {tiers.map((tier) => (
            <Pressable
              key={tier.id}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedTierId(tier.id);
              }}
              style={[styles.tierOption, selectedTierId === tier.id && styles.tierOptionSelected]}
            >
              <View>
                <Text style={styles.tierName}>{tier.name}</Text>
                {tier.gender ? (
                  <Text style={styles.tierMeta}>{tier.gender.toUpperCase()} only</Text>
                ) : null}
              </View>
              <Text style={styles.tierCount}>{tier.count} left</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.75)" />
          <Text style={styles.bannerText}>
            No unclaimed tickets are available to share from this order.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Link Expiry</Text>
      <View style={styles.segmentRow}>
        {(['24h', '48h', 'event'] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setExpiryMode(mode)}
            style={[styles.segment, expiryMode === mode && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, expiryMode === mode && styles.segmentTextActive]}>
              {mode === 'event' ? 'Event Start' : mode === '24h' ? '24 Hours' : '48 Hours'}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedTier?.gender ? (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color="#FFB800" />
          <Text style={styles.warningText}>
            This ticket is restricted to {selectedTier.gender.toUpperCase()} attendees.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Share via</Text>
      <View style={styles.shareGrid}>
        {SHARE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => void handleShare(option.id)}
            disabled={!!loading || tiers.length === 0}
            style={({ pressed }) => [
              styles.shareOption,
              pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
              (loading === option.id || tiers.length === 0) && { opacity: 0.5 },
            ]}
          >
            <LinearGradient
              colors={option.gradient as unknown as [string, string, ...string[]]}
              style={styles.iconCircle}
            >
              <Ionicons name={option.icon as any} size={26} color="#fff" />
            </LinearGradient>
            <Text style={styles.shareLabel}>
              {loading === option.id ? 'Working...' : option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TransferSheetContent({
  genderRestriction,
  onTransferEmail,
  onGenerateLink,
}: TransferSheetContentProps) {
  const [mode, setMode] = useState<'email' | 'link'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<'email' | 'link' | null>(null);

  const handleEmail = () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Enter Email', 'Enter a valid email address for the recipient.');
      return;
    }

    Alert.alert(
      'Confirm Transfer',
      'This permanently transfers ownership of the ticket once accepted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            setLoading('email');
            await onTransferEmail(email.trim());
            setLoading(null);
          },
        },
      ],
    );
  };

  const handleLink = () => {
    Alert.alert(
      'Generate Transfer Link',
      'Anyone with this link can claim ownership of the ticket.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setLoading('link');
            await onGenerateLink();
            setLoading(null);
          },
        },
      ],
    );
  };

  return (
    <View>
      {genderRestriction ? (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color="#FFB800" />
          <Text style={styles.warningText}>
            This ticket is restricted to {genderRestriction.toUpperCase()} attendees.
          </Text>
        </View>
      ) : null}

      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setMode('email')}
          style={[styles.segment, mode === 'email' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'email' && styles.segmentTextActive]}>
            Email
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('link')}
          style={[styles.segment, mode === 'link' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'link' && styles.segmentTextActive]}>
            Share Link
          </Text>
        </Pressable>
      </View>

      {mode === 'email' ? (
        <View>
          <View style={styles.banner}>
            <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.bannerText}>
              Send a direct ownership transfer to a specific email address.
            </Text>
          </View>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="friend@example.com"
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable
            onPress={() => void handleEmail()}
            disabled={!!loading}
            style={[styles.primaryButton, loading === 'email' && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {loading === 'email' ? 'Sending...' : 'Send Transfer'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <View style={styles.banner}>
            <Ionicons name="link-outline" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.bannerText}>
              Generate a shareable transfer link for WhatsApp, SMS, or DM.
            </Text>
          </View>
          <Pressable
            onPress={() => void handleLink()}
            disabled={!!loading}
            style={[styles.primaryButton, loading === 'link' && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {loading === 'link' ? 'Generating...' : 'Generate Link'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerCopy: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  description: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  tierOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 10,
  },
  tierOptionSelected: {
    borderColor: '#F44A22',
    backgroundColor: 'rgba(244,74,34,0.14)',
  },
  tierName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  tierMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  tierCount: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  segmentActive: {
    backgroundColor: 'rgba(244,74,34,0.18)',
    borderColor: 'rgba(244,74,34,0.45)',
  },
  segmentText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  warningBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.28)',
  },
  warningText: {
    flex: 1,
    color: '#FFD27A',
    fontSize: 13,
    lineHeight: 18,
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bannerText: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    paddingBottom: 10,
  },
  shareOption: {
    width: 72,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shareLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    textAlign: 'center',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#F44A22',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
