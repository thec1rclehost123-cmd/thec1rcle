import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
  Share,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useTicketsStore } from '@/store/ticketsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { initiateTransfer, acceptTransfer } from '@/lib/transfers';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design/theme';

export default function TransferScreen() {
  const { orderId, ticketName } = useLocalSearchParams<{ orderId?: string; ticketName?: string }>();
  const { user } = useAuthStore();
  const { fetchUserOrders } = useTicketsStore();
  const openPaywall = useSubscriptionStore((state) => state.openPaywall);

  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [transferResult, setTransferResult] = useState<{ code: string; expiresAt?: string } | null>(null);

  const handleInitiateTransfer = async () => {
    Keyboard.dismiss();

    if (!orderId || !user?.uid || !recipientEmail.trim()) {
      Alert.alert('Error', 'Please enter recipient email');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await initiateTransfer(
      orderId,
      user.uid,
      { tierName: ticketName || 'Ticket', quantity: 1 },
      recipientEmail.trim(),
    );

    setLoading(false);

    if (result.success && result.transferCode) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTransferResult({ code: result.transferCode, expiresAt: result.expiresAt });
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (result.premiumRequired) {
        openPaywall('ticketTransfers', result.error);
        return;
      }
      Alert.alert('Error', result.error || 'Failed to initiate transfer');
    }
  };

  const handleAcceptTransfer = async () => {
    Keyboard.dismiss();

    if (!user?.uid || !transferCode.trim()) {
      Alert.alert('Error', 'Please enter transfer code');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await acceptTransfer(transferCode.trim().toUpperCase(), user.uid);

    setLoading(false);

    if (result.success) {
      if (user?.uid) {
        await fetchUserOrders().catch(() => {});
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success! 🎉', 'Ticket transferred successfully! Check your My Tickets.', [
        { text: 'View Tickets', onPress: () => router.replace('/(tabs)/tickets') },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to accept transfer');
    }
  };

  const handleShareCode = async () => {
    if (!transferResult?.code) return;

    try {
      const expiryText = transferResult.expiresAt
        ? `Expires ${new Date(transferResult.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
        : 'Code expires in 24 hours.';
      await Share.share({
        message: `I'm sending you a ticket!\n\nUse this code in THE C1RCLE app to claim it:\n\n${transferResult.code}\n\n${expiryText}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Success state after initiating transfer
  if (transferResult) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Transfer Ticket</Text>
        </View>

        <View style={styles.successContent}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Transfer Initiated!</Text>
          <Text style={styles.successSubtitle}>Share this code with your friend</Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Transfer Code</Text>
            <Text style={styles.codeText}>{transferResult.code}</Text>
            {transferResult.expiresAt ? (
              <Text style={styles.codeExpiry}>
                Expires {new Date(transferResult.expiresAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                })}
              </Text>
            ) : (
              <Text style={styles.codeExpiry}>Expires in 24 hours</Text>
            )}
          </View>

          <Pressable onPress={handleShareCode} style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share Code 📤</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Transfer Ticket</Text>
      </View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <Pressable
            onPress={() => setMode('send')}
            style={[styles.modeButton, mode === 'send' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'send' && styles.modeButtonTextActive]}>
              Send Ticket
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('receive')}
            style={[styles.modeButton, mode === 'receive' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'receive' && styles.modeButtonTextActive]}>
              Receive Ticket
            </Text>
          </Pressable>
        </View>

        {mode === 'send' ? (
          <>
            {/* Send Ticket Mode */}
            <View style={styles.sendingCard}>
              <Text style={styles.sendingLabel}>📤 Sending</Text>
              <Text style={styles.sendingValue}>{ticketName || '1 Ticket'}</Text>
            </View>

            <Text style={styles.inputLabel}>Recipient's Email</Text>
            <TextInput
              placeholder="friend@email.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              style={styles.textInput}
            />

            <Pressable
              onPress={handleInitiateTransfer}
              disabled={loading || !recipientEmail.trim()}
              style={[
                styles.primaryButton,
                (loading || !recipientEmail.trim()) && styles.primaryButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Generate Transfer Code</Text>
              )}
            </Pressable>

            <Text style={styles.helperText}>
              The recipient will need to enter the code in the app to receive the ticket
            </Text>
          </>
        ) : (
          <>
            {/* Receive Ticket Mode */}
            <View style={styles.receiveHeader}>
              <Text style={styles.receiveIcon}>🎟️</Text>
              <Text style={styles.receiveTitle}>Enter Transfer Code</Text>
              <Text style={styles.receiveSubtitle}>Ask your friend for the 6-character code</Text>
            </View>

            <TextInput
              placeholder="ABC123"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              maxLength={6}
              value={transferCode}
              onChangeText={setTransferCode}
              style={styles.codeInput}
            />

            <Pressable
              onPress={handleAcceptTransfer}
              disabled={loading || transferCode.length !== 6}
              style={[
                styles.primaryButton,
                (loading || transferCode.length !== 6) && styles.primaryButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Claim Ticket</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: colors.gold,
    fontSize: 18,
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: typography.fontFamily.heading,
    fontSize: 20,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  successTitle: {
    color: colors.gold,
    fontFamily: typography.fontFamily.heading,
    fontSize: 24,
    marginBottom: 8,
  },
  successSubtitle: {
    color: colors.goldStone,
    textAlign: 'center',
    marginBottom: 32,
  },
  codeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.iris,
    padding: 24,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  codeLabel: {
    color: colors.goldStone,
    fontSize: 14,
    marginBottom: 8,
  },
  codeText: {
    color: colors.iris,
    fontFamily: typography.fontFamily.brandAccent,
    fontSize: 36,
    letterSpacing: 4,
  },
  codeExpiry: {
    color: colors.goldStone,
    fontSize: 12,
    marginTop: 12,
  },
  shareButton: {
    backgroundColor: colors.iris,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    marginBottom: 16,
  },
  shareButtonText: {
    color: '#fff',
    fontFamily: typography.fontFamily.heading,
  },
  doneButton: {
    paddingVertical: 12,
  },
  doneButtonText: {
    color: colors.goldStone,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.iris,
  },
  modeButtonText: {
    color: colors.goldStone,
  },
  modeButtonTextActive: {
    color: '#fff',
    fontFamily: typography.fontFamily.heading,
  },
  sendingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    marginBottom: 24,
  },
  sendingLabel: {
    color: colors.gold,
    fontFamily: typography.fontFamily.heading,
    marginBottom: 4,
  },
  sendingValue: {
    color: colors.iris,
  },
  inputLabel: {
    color: colors.goldStone,
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.gold,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: colors.iris,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(244, 74, 34, 0.5)', // iris/50
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: typography.fontFamily.heading,
    fontSize: 18,
  },
  helperText: {
    color: colors.goldStone,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  receiveHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  receiveIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  receiveTitle: {
    color: colors.gold,
    fontFamily: typography.fontFamily.heading,
    fontSize: 18,
  },
  receiveSubtitle: {
    color: colors.goldStone,
    textAlign: 'center',
    marginTop: 8,
  },
  codeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.gold,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 24,
  },
});
