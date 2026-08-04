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
import { API_BASE, getAuthToken, apiFetch } from '@/lib/api';

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

type NativeWalletResult =
  | { status: 'ready'; uri: string }
  | { status: 'ready'; saveUrl: string }
  | { status: 'unavailable'; code: 'not_configured' | 'not_implemented'; message?: string }
  | { status: 'error'; message?: string };

async function readDownloadedJson(fileUri: string): Promise<any | null> {
  try {
    const body = await FileSystem.readAsStringAsync(fileUri);
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function readResponseJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isWalletUnavailable(
  body: any,
): body is { code: 'not_configured' | 'not_implemented'; message?: string } {
  return body?.code === 'not_configured' || body?.code === 'not_implemented';
}

// ─── Download Ticket PDF ────────────────────────────────────────────────────

/**
 * Download a PDF ticket from the backend and save it to the device.
 * Returns the local file URI on success, null on failure.
 */
async function getAuthHeaders(): Promise<Record<string, string> | undefined> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function downloadTicketPDF(orderId: string): Promise<string | null> {
  try {
    const fileUri = `${FileSystem.cacheDirectory}ticket-${orderId.substring(0, 8)}.pdf`;

    const existing = await FileSystem.getInfoAsync(fileUri);
    if (existing.exists) {
      return fileUri;
    }

    const headers = await getAuthHeaders();
    const downloadResult = await FileSystem.downloadAsync(
      `${API_BASE}/api/v1/tickets/download?orderId=${encodeURIComponent(orderId)}`,
      fileUri,
      headers ? { headers } : undefined,
    );

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    return downloadResult.uri;
  } catch (error) {
    if (__DEV__) console.error('[Wallet] Download error:', error);
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
    if (__DEV__) console.error('[Wallet] Save ticket error:', error);
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
    if (__DEV__) console.error('[Wallet] Share ticket error:', error);
    Alert.alert('Error', 'Failed to share ticket.');
    return false;
  }
}

// ─── Wallet Integration ─────────────────────────────────────────────────────

/**
 * Generate and add Apple Wallet pass (.pkpass)
 * Requires server-side pass generation with Apple certificates.
 */
async function requestAppleWalletPass(passData: PassData): Promise<NativeWalletResult> {
  if (Platform.OS !== 'ios')
    return { status: 'error', message: 'Apple Wallet is only available on iOS.' };

  try {
    const fileUri = `${FileSystem.cacheDirectory}pass-${passData.orderId.substring(0, 8)}.pkpass`;

    const headers = await getAuthHeaders();
    const downloadResult = await FileSystem.downloadAsync(
      `${API_BASE}/api/v1/passes/apple?orderId=${encodeURIComponent(passData.orderId)}`,
      fileUri,
      headers ? { headers } : undefined,
    );

    if (downloadResult.status === 200) {
      return { status: 'ready', uri: downloadResult.uri };
    }

    const body = await readDownloadedJson(downloadResult.uri);
    if (isWalletUnavailable(body)) {
      return { status: 'unavailable', code: body.code, message: body.message };
    }
    return {
      status: 'error',
      message: `Apple Wallet failed with status ${downloadResult.status}.`,
    };
  } catch (error) {
    if (__DEV__) console.error('[Wallet] Apple pass error:', error);
    return { status: 'error', message: 'Apple Wallet pass request failed.' };
  }
}

export async function generateAppleWalletPass(passData: PassData): Promise<string | null> {
  const result = await requestAppleWalletPass(passData);
  return result.status === 'ready' && 'uri' in result ? result.uri : null;
}

/**
 * Generate and add Google Wallet pass
 * Requires server-side JWT generation with Google Wallet credentials.
 */
async function requestGoogleWalletPass(passData: PassData): Promise<NativeWalletResult> {
  if (Platform.OS !== 'android')
    return { status: 'error', message: 'Google Wallet is only available on Android.' };

  try {
    const data: any = await apiFetch(
      `/api/v1/passes/google?orderId=${encodeURIComponent(passData.orderId)}`,
    );

    const saveUrl = data?.saveUrl;
    if (saveUrl) {
      return { status: 'ready', saveUrl };
    }

    return { status: 'error', message: 'Google Wallet save URL was missing.' };
  } catch (error: any) {
    if (error?.code === 'not_configured' || error?.code === 'not_implemented') {
      return { status: 'unavailable', code: error.code, message: error.message };
    }
    if (__DEV__) console.error('[Wallet] Google pass error:', error);
    return { status: 'error', message: 'Google Wallet pass request failed.' };
  }
}

export async function generateGoogleWalletPass(passData: PassData): Promise<string | null> {
  const result = await requestGoogleWalletPass(passData);
  return result.status === 'ready' && 'saveUrl' in result ? result.saveUrl : null;
}

/**
 * Add to wallet (platform-agnostic).
 * Falls back to PDF download if wallet pass generation isn't available.
 */
export async function addToWallet(passData: PassData): Promise<boolean> {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === 'ios') {
      const passResult = await requestAppleWalletPass(passData);
      if (passResult.status === 'ready' && 'uri' in passResult) {
        await Sharing.shareAsync(passResult.uri, {
          mimeType: 'application/vnd.apple.pkpass',
          UTI: 'com.apple.pkpass',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      }
      if (passResult.status === 'error') {
        Alert.alert('Apple Wallet', passResult.message || 'Apple Wallet pass is not available.');
        return false;
      }
    } else if (Platform.OS === 'android') {
      const passResult = await requestGoogleWalletPass(passData);
      if (passResult.status === 'ready' && 'saveUrl' in passResult) {
        await Linking.openURL(passResult.saveUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      }
      if (passResult.status === 'error') {
        Alert.alert('Google Wallet', passResult.message || 'Google Wallet pass is not available.');
        return false;
      }
    }

    // Fallback: only when the backend explicitly says native wallet credentials are unavailable.
    Alert.alert(
      Platform.OS === 'ios' ? 'Apple Wallet' : 'Google Wallet',
      'Native wallet credentials are not configured yet. Would you like to download the ticket as a PDF instead?',
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
    if (__DEV__) console.error('[Wallet] Add to wallet error:', error);
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
  headerFields: Array<{ label: string; value: string }>;
  primaryFields: Array<{ label: string; value: string }>;
  secondaryFields: Array<{ label: string; value: string }>;
  auxiliaryFields: Array<{ label: string; value: string }>;
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
          timeZone: 'Asia/Kolkata',
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
