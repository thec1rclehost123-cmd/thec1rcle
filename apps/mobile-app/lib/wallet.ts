/**
 * Ticket Download, Share & Wallet Integration
 *
 * Provides:
 * - downloadTicketPDF: fetches PDF from backend → saves to device → option to share/open
 * - shareTicket: generates share sheet with ticket info + PDF attachment
 * - addToWallet: platform-specific wallet pass (Apple Wallet / Google Wallet)
 * - isWalletAvailable: checks if wallet app is installed
 */

import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://thec1rcle.com';

export interface PassData {
  orderId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  venueAddress?: string;
  ticketType: string;
  ticketCount: number;
  qrCodeData: string;
  organizerName?: string;
  coverImageUrl?: string;
}

// ─── Download Ticket PDF ────────────────────────────────────────────────────

/**
 * Download a PDF ticket from the backend and save it to the device.
 * Returns the local file URI on success, null on failure.
 */
export async function downloadTicketPDF(orderId: string): Promise<string | null> {
  try {
    const fileUri = `${FileSystem.cacheDirectory}ticket-${orderId.substring(0, 8)}.pdf`;

    // Check if already downloaded
    const existing = await FileSystem.getInfoAsync(fileUri);
    if (existing.exists) {
      return fileUri;
    }

    const downloadResult = await FileSystem.downloadAsync(
      `${API_BASE}/api/tickets/download?orderId=${orderId}`,
      fileUri,
    );

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    return downloadResult.uri;
  } catch (error) {
    console.error('[Wallet] Download error:', error);
    return null;
  }
}

/**
 * Download and open/share the ticket PDF
 */
export async function saveTicket(passData: PassData): Promise<boolean> {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const fileUri = await downloadTicketPDF(passData.orderId);

    if (!fileUri) {
      Alert.alert('Download Failed', 'Could not download the ticket. Please try again.');
      return false;
    }

    // Check sharing support
    const sharingAvailable = await Sharing.isAvailableAsync();
    if (sharingAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Ticket — ${passData.eventTitle}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Downloaded!', 'Your ticket has been saved to the app cache.');
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  } catch (error) {
    console.error('[Wallet] Save ticket error:', error);
    Alert.alert('Error', 'Failed to save ticket. Please try again.');
    return false;
  }
}

// ─── Share Ticket ───────────────────────────────────────────────────────────

/**
 * Share ticket as PDF attachment via the system share sheet.
 */
export async function shareTicket(passData: PassData): Promise<boolean> {
  try {
    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      Alert.alert('Error', 'Sharing is not available on this device.');
      return false;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Try to download PDF first
    const fileUri = await downloadTicketPDF(passData.orderId);

    if (fileUri) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `🎟️ ${passData.eventTitle} — Ticket`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      // Fallback: share text info
      Alert.alert(
        'Share Ticket',
        `🎟️ ${passData.eventTitle}\n📅 ${passData.eventDate} ${passData.eventTime}\n📍 ${passData.venue}\n🎫 ${passData.ticketType} × ${passData.ticketCount}\n\nOrder: ${passData.orderId.substring(0, 8)}`,
        [{ text: 'OK' }],
      );
    }

    return true;
  } catch (error) {
    console.error('[Wallet] Share ticket error:', error);
    Alert.alert('Error', 'Failed to share ticket.');
    return false;
  }
}

// ─── Wallet Integration ─────────────────────────────────────────────────────

/**
 * Generate and add Apple Wallet pass (.pkpass)
 * Requires server-side pass generation with Apple certificates.
 */
export async function generateAppleWalletPass(passData: PassData): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;

  try {
    const fileUri = `${FileSystem.cacheDirectory}pass-${passData.orderId.substring(0, 8)}.pkpass`;

    const downloadResult = await FileSystem.downloadAsync(
      `${API_BASE}/api/passes/apple?orderId=${passData.orderId}`,
      fileUri,
    );

    if (downloadResult.status === 200) {
      return downloadResult.uri;
    }

    // API not yet available — show PDF fallback
    return null;
  } catch (error) {
    console.error('[Wallet] Apple pass error:', error);
    return null;
  }
}

/**
 * Generate and add Google Wallet pass
 * Requires server-side JWT generation with Google Wallet credentials.
 */
export async function generateGoogleWalletPass(passData: PassData): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const response = await fetch(`${API_BASE}/api/passes/google?orderId=${passData.orderId}`);

    if (response.ok) {
      const { saveUrl } = await response.json();
      return saveUrl;
    }

    return null;
  } catch (error) {
    console.error('[Wallet] Google pass error:', error);
    return null;
  }
}

/**
 * Add to wallet (platform-agnostic).
 * Falls back to PDF download if wallet pass generation isn't available.
 */
export async function addToWallet(passData: PassData): Promise<boolean> {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === 'ios') {
      const passUrl = await generateAppleWalletPass(passData);
      if (passUrl) {
        // .pkpass files auto-open in Apple Wallet
        await Sharing.shareAsync(passUrl, {
          mimeType: 'application/vnd.apple.pkpass',
          UTI: 'com.apple.pkpass',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      }
    } else if (Platform.OS === 'android') {
      const saveUrl = await generateGoogleWalletPass(passData);
      if (saveUrl) {
        await Linking.openURL(saveUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      }
    }

    // Fallback: download PDF instead
    Alert.alert(
      Platform.OS === 'ios' ? 'Apple Wallet' : 'Google Wallet',
      'Wallet pass generation is coming soon. Would you like to download the ticket as a PDF instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download PDF',
          onPress: () => saveTicket(passData),
        },
      ],
    );

    return false;
  } catch (error) {
    console.error('[Wallet] Add to wallet error:', error);
    Alert.alert('Error', 'Failed to add to wallet.');
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if the device's native wallet app is available.
 */
export async function isWalletAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return await Linking.canOpenURL('wallet://');
    } else if (Platform.OS === 'android') {
      return await Linking.canOpenURL('https://pay.google.com/');
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Generate pass preview data for display in the app.
 */
export function generatePassPreview(passData: PassData): {
  headerFields: { label: string; value: string }[];
  primaryFields: { label: string; value: string }[];
  secondaryFields: { label: string; value: string }[];
  auxiliaryFields: { label: string; value: string }[];
} {
  const eventDate = new Date(passData.eventDate);

  return {
    headerFields: [{ label: 'EVENT', value: passData.eventTitle }],
    primaryFields: [
      {
        label: 'DATE',
        value: eventDate.toLocaleDateString('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
      },
      { label: 'TIME', value: passData.eventTime },
    ],
    secondaryFields: [
      { label: 'VENUE', value: passData.venue },
      { label: 'TICKET', value: passData.ticketType },
    ],
    auxiliaryFields: [
      { label: 'QTY', value: passData.ticketCount.toString() },
      {
        label: 'ORDER',
        value: passData.orderId.substring(0, 8).toUpperCase(),
      },
    ],
  };
}
