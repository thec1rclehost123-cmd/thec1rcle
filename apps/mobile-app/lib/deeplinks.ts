// Deep linking configuration and helpers
import * as Linking from 'expo-linking';
import { Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import * as SecureStore from 'expo-secure-store';
import { useProfileStore } from '@/store/profileStore';
import { useFirstRunStore } from '@/store/firstRunStore';
import { resolveFirstRunStage } from '@/lib/firstRun';

// App scheme for deep links
const APP_SCHEME = 'c1rcle';
const WEB_DOMAIN = 'thec1rcle.com';
const PENDING_DEEP_LINK_KEY = 'c1rcle:pending_deep_link';
const PENDING_APP_ROUTE_KEY = 'c1rcle:pending_app_route';

// Deep link types
export type DeepLinkType =
  | 'event'
  | 'transfer'
  | 'profile'
  | 'invite'
  | 'ticket'
  | 'chat'
  | 'safety'
  | 'claim'
  | 'going';

// Build deep link URL
export function buildDeepLink(type: DeepLinkType, params: Record<string, string>): string {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  // Universal link for web (works on both platforms)
  return `https://${WEB_DOMAIN}/app/${type}?${queryString}`;
}

// Build app-specific deep link
export function buildAppLink(type: DeepLinkType, params: Record<string, string>): string {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `${APP_SCHEME}://${type}?${queryString}`;
}

// Share event link
export async function shareEventLink(
  eventId: string,
  eventTitle: string,
  customMessage?: string,
): Promise<boolean> {
  try {
    const link = `https://${WEB_DOMAIN}/event/${encodeURIComponent(eventId)}`;
    const message = customMessage || `🎉 Check out ${eventTitle} on THE C1RCLE!\n\n${link}`;

    const result = await Share.share({
      message,
      url: Platform.OS === 'ios' ? link : undefined, // iOS shows URL separately
      title: eventTitle,
    });

    return result.action === Share.sharedAction;
  } catch (error) {
    if (__DEV__) console.error('Error sharing event:', error);
    return false;
  }
}

// Share ticket transfer code
export async function shareTransferCode(code: string, eventTitle: string): Promise<boolean> {
  try {
    const message = `🎟️ I'm sending you a ticket to ${eventTitle}!\n\nOpen THE C1RCLE app and enter this code:\n\n${code}\n\nCode expires in 24 hours.`;

    const result = await Share.share({
      message,
      title: 'Ticket Transfer',
    });

    return result.action === Share.sharedAction;
  } catch (error) {
    if (__DEV__) console.error('Error sharing transfer code:', error);
    return false;
  }
}

// Share invite link
export async function shareInviteLink(referralCode?: string): Promise<boolean> {
  try {
    const params: Record<string, string> = {};
    if (referralCode) {
      params.ref = referralCode;
    }

    const link = buildDeepLink('invite', params);
    const message = `Join me on THE C1RCLE - the best way to discover events and parties! 🎉\n\n${link}`;

    const result = await Share.share({
      message,
      title: 'Join THE C1RCLE',
    });

    return result.action === Share.sharedAction;
  } catch (error) {
    if (__DEV__) console.error('Error sharing invite:', error);
    return false;
  }
}

// Copy link to clipboard
export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

// Check user has social profile before routing to dating features
function requireSocialProfile(): boolean {
  const { useProfileStore } = require('@/store/profileStore');
  const profile = useProfileStore.getState().profile;
  if (!profile?.socialSetupComplete) {
    const { router } = require('expo-router');
    router.push('/social-setup');
    return false;
  }
  return true;
}

// --- 🛡️ DEEP LINK PARAM SANITIZATION ---
// Strips non-alphanumeric, dash, underscore, slash, colon, dot characters
// and caps length at 200 to prevent injection / buffer-overflow attacks.
// eslint-disable-next-line no-useless-escape
const SANITIZE_RE = /[^a-zA-Z0-9\-_\/:.\s]/g;
const MAX_PARAM_LENGTH = 200;

function sanitizeParam(value: string): string {
  return value.replace(SANITIZE_RE, '').slice(0, MAX_PARAM_LENGTH);
}

// Parse deep link URL
export function parseDeepLink(url: string): {
  type: DeepLinkType | null;
  params: Record<string, string>;
} {
  try {
    const parsed = Linking.parse(url);

    // Extract type and potential ID from path
    // Pattern: scheme://type/id or scheme://type?id=xxx
    const pathParts = (parsed.path || '').split('/').filter(Boolean);
    const type = pathParts[0] as DeepLinkType | undefined;

    // Extract query params and path params
    const params: Record<string, string> = {};

    // If we have an ID in the path (e.g. event/123), add it to params
    if (pathParts.length > 1) {
      const sanitized = sanitizeParam(pathParts[1]);
      params.id = sanitized;
      if (type === 'event') params.eventId = sanitized;
      if (type === 'ticket') params.orderId = sanitized;
      if (type === 'chat') params.eventId = sanitized;
      if (type === 'claim') params.token = sanitized;
      if (type === 'going') params.orderId = sanitized;
      if (type === 'transfer') params.code = sanitized;
    }

    if (parsed.queryParams) {
      Object.entries(parsed.queryParams).forEach(([key, value]) => {
        if (typeof value === 'string') {
          params[key] = sanitizeParam(value);
        }
      });
    }

    return {
      type: type || null,
      params,
    };
  } catch (error) {
    if (__DEV__) console.error('Error parsing deep link:', error);
    return { type: null, params: {} };
  }
}

// Handle incoming deep link using expo-router
export function handleDeepLink(url: string): void {
  const user = useAuthStore.getState().user;
  const profile = useProfileStore.getState().profile;
  const snapshot = useFirstRunStore.getState().snapshot;
  if (!user) {
    void SecureStore.setItemAsync(PENDING_DEEP_LINK_KEY, url);
    router.replace('/(auth)/login');
    return;
  }
  if (resolveFirstRunStage(user, profile, snapshot) !== 'complete') {
    void SecureStore.setItemAsync(PENDING_DEEP_LINK_KEY, url);
    router.replace('/');
    return;
  }

  const { type, params } = parseDeepLink(url);

  switch (type) {
    case 'event':
      if (params.id) {
        router.push(`/event/${params.id}`);
      }
      break;
    case 'ticket':
      if (params.orderId || params.id) {
        router.push(`/ticket/${params.orderId || params.id}`);
      }
      break;
    case 'transfer':
      if (params.code || params.id) {
        router.push(`/transfer/${params.code || params.id}`);
      }
      break;
    case 'claim':
      if (params.token || params.id) {
        router.push(`/claim/${params.token || params.id}`);
      }
      break;

    case 'profile':
      if (params.userId) {
        // Dating profile deep links require social setup
        if (!requireSocialProfile()) return;
        router.push(`/profile/${params.userId}` as any);
      }
      break;
    case 'chat':
      if (params.eventId || params.id) {
        router.push(`/social/group/${params.eventId || params.id}`);
      }
      break;
    case 'going':
      if (params.orderId || params.id) {
        router.push(`/going/${params.orderId || params.id}`);
      }
      break;
    case 'invite':
      if (params.ref) {
        if (__DEV__) console.log('Referral code:', params.ref);
      }
      break;
    case 'safety':
      router.push('/safety');
      break;
    default:
      if (__DEV__) console.log('Unknown deep link type:', type);
  }
}

/** Gate trusted in-app destinations behind authentication and first-run setup. */
export function handleProtectedRoute(route: string): void {
  const user = useAuthStore.getState().user;
  const profile = useProfileStore.getState().profile;
  const snapshot = useFirstRunStore.getState().snapshot;

  if (!user) {
    void SecureStore.setItemAsync(PENDING_APP_ROUTE_KEY, route);
    router.replace('/(auth)/login');
    return;
  }
  if (resolveFirstRunStage(user, profile, snapshot) !== 'complete') {
    void SecureStore.setItemAsync(PENDING_APP_ROUTE_KEY, route);
    router.replace('/');
    return;
  }
  router.push(route as any);
}

export async function resumePendingDeepLink(): Promise<boolean> {
  const url = await SecureStore.getItemAsync(PENDING_DEEP_LINK_KEY);
  if (url) {
    await SecureStore.deleteItemAsync(PENDING_DEEP_LINK_KEY);
    handleDeepLink(url);
    return true;
  }

  const route = await SecureStore.getItemAsync(PENDING_APP_ROUTE_KEY);
  if (!route) return false;
  await SecureStore.deleteItemAsync(PENDING_APP_ROUTE_KEY);
  handleProtectedRoute(route);
  return true;
}

// Subscribe to incoming links
export function subscribeToDeepLinks(handler: (url: string) => void): () => void {
  // Handle initial URL (app opened via link)
  Linking.getInitialURL().then((url) => {
    if (url) handler(url);
  });

  // Handle links while app is running
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handler(url);
  });

  return () => subscription.remove();
}
