import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { DEMO_EVENTS, PUBLIC_DEMO_MODE } from '@/lib/demo';
import { getEventImage } from '@/lib/utils/event';

// Order/Ticket type matching Firestore schema
export interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  eventId: string;
  eventTitle?: string;
  eventCategory?: string;
  category?: string;
  eventDate?: string;
  eventStartDate?: string;
  eventTime?: string;
  eventTimezone?: string;
  eventCoverImage?: string;
  coverImage?: string;
  coverPhoto?: string;
  posterUrl?: string;
  poster?: string;
  image?: string;
  images?: string[];
  gallery?: string[];
  flyer?: string;
  banner?: string;
  thumbnail?: string;
  venueLocation?: string;
  hostName?: string;
  accentColor?: string;
  eventAccentColor?: string;
  posterAccentColor?: string;
  dominantColor?: string;
  status:
    'payment_pending' | 'pending_payment' | 'confirmed' | 'checked_in' | 'cancelled' | 'refunded';
  tickets: OrderTicket[];
  totalAmount: number;
  currency?: string;
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string;
  bookingCode?: string;
  bookingCodes?: BookingCode[];
  qrData?: string;
  qrCodes?: QRCode[];
  isClaimed?: boolean;
  bundleId?: string;
  isRSVP?: boolean;
  source?: string;
}

export interface OrderTicket {
  tierId: string;
  tierName: string;
  quantity: number;
  price: number;
  subtotal?: number;
  entryType?: string;
  ticketId?: string;
  bookingCode?: string;
  isClaimed?: boolean;
  claimedBy?: {
    uid?: string;
    email?: string;
    name?: string;
    photoURL?: string;
  } | null;
  requiredGender?: string;
  shareToken?: string;
  transferStatus?: 'pending' | 'accepted' | 'cancelled' | 'expired';
  transferId?: string;
  transferRecipientEmail?: string;
  receivedFrom?: string;
}

export interface BookingCode {
  ticketId?: string;
  ticketDocumentId?: string;
  bookingCode: string;
  tierId?: string | null;
  tierName?: string | null;
}

export interface QRCode {
  ticketId: string;
  ticketIndex: number;
  qrCode: string;
  bookingCode?: string;
  qrUrl?: string;
  qrExpiresAt?: string;
  qrMode?: 'raw_id' | 'jwt' | 'static' | string;
  isUsed?: boolean;
}

interface TicketsState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  fetchUserOrders: () => Promise<void>;
  getOrderById: (orderId: string) => Promise<Order | null>;
  clearOrders: () => void;
}

function getCanonicalDemoEvent(eventId?: string) {
  if (!PUBLIC_DEMO_MODE) return null;
  if (!eventId) return null;
  return (DEMO_EVENTS as any[]).find((event) => event.id === eventId) || null;
}

function getCanonicalDemoPoster(eventId?: string): string | undefined {
  const demoEvent = getCanonicalDemoEvent(eventId);
  return (
    demoEvent?.poster ||
    demoEvent?.coverImage ||
    demoEvent?.image ||
    demoEvent?.posterUrl ||
    demoEvent?.images?.[0]
  );
}

function getCanonicalDemoAccent(eventId?: string): string | undefined {
  const demoEvent = getCanonicalDemoEvent(eventId);
  return (
    demoEvent?.posterAccentColor ||
    demoEvent?.dominantColor ||
    demoEvent?.eventAccentColor ||
    demoEvent?.accentColor
  );
}

function normalizeOrder(raw: Order): Order {
  const canonicalDemoPoster = getCanonicalDemoPoster(raw.eventId);
  const canonicalPoster =
    canonicalDemoPoster ||
    getEventImage({
      ...raw,
      coverImage: raw.coverImage || raw.eventCoverImage,
    }) ||
    raw.eventCoverImage;
  const canonicalAccent =
    getCanonicalDemoAccent(raw.eventId) ||
    raw.posterAccentColor ||
    raw.dominantColor ||
    raw.eventAccentColor ||
    raw.accentColor;

  return {
    ...raw,
    eventCoverImage: canonicalPoster,
    coverImage: canonicalPoster || raw.coverImage,
    coverPhoto: canonicalPoster || raw.coverPhoto,
    posterUrl: canonicalPoster || raw.posterUrl || raw.poster,
    poster: canonicalPoster || raw.poster || raw.posterUrl,
    image: canonicalPoster || raw.image,
    images: canonicalPoster ? [canonicalPoster] : raw.images,
    gallery: canonicalPoster ? [canonicalPoster] : raw.gallery,
    flyer: canonicalPoster || raw.flyer,
    banner: canonicalPoster || raw.banner,
    thumbnail: canonicalPoster || raw.thumbnail,
    accentColor: canonicalAccent || raw.accentColor,
    eventAccentColor: canonicalAccent || raw.eventAccentColor,
    posterAccentColor: canonicalAccent || raw.posterAccentColor,
    dominantColor: canonicalAccent || raw.dominantColor,
  };
}

export const useTicketsStore = create<TicketsState>((set, get) => {
  let pendingFetchPromise: Promise<void> | null = null;
  let requestGeneration = 0;

  return {
    orders: [],
    loading: false,
    error: null,

    fetchUserOrders: async () => {
      if (get().loading && pendingFetchPromise) return pendingFetchPromise;

      const generation = requestGeneration;
      set({ loading: true, error: null });
      const fetchPromise = (async () => {
        try {
          const response = await apiFetch<{
            success: boolean;
            data?: { orders?: Order[] };
            orders?: Order[];
          }>('/api/v1/tickets/my-wallet');
          const walletOrders: Order[] = (response.data?.orders || response.orders || []).map(
            normalizeOrder,
          );

          if (generation !== requestGeneration) return;
          set({ orders: walletOrders, loading: false, error: null });
        } catch (error: any) {
          if (generation !== requestGeneration) return;
          console.warn('Unable to fetch wallet orders; keeping existing ticket wallet.', error);
          set({
            error: error?.message || 'Unable to sync ticket wallet. Pull to retry.',
            loading: false,
          });
        }
      })();
      pendingFetchPromise = fetchPromise;

      try {
        await fetchPromise;
      } finally {
        if (pendingFetchPromise === fetchPromise) pendingFetchPromise = null;
      }
    },

    getOrderById: async (orderId: string): Promise<Order | null> => {
      try {
        const cached = get().orders.find((order) => order.id === orderId);
        if (cached) return cached;

        if (get().loading && pendingFetchPromise) {
          await pendingFetchPromise;
          return get().orders.find((order) => order.id === orderId) || null;
        }

        await get().fetchUserOrders();
        return get().orders.find((order) => order.id === orderId) || null;
      } catch (error: any) {
        console.warn('Unable to fetch order by ID:', error);
        return null;
      }
    },

    clearOrders: () => {
      requestGeneration += 1;
      pendingFetchPromise = null;
      set({ orders: [], loading: false, error: null });
    },
  };
});
