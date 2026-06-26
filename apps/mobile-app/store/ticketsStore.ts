import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

// Order/Ticket type matching Firestore schema
export interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  eventId: string;
  eventTitle?: string;
  eventDate?: string;
  eventStartDate?: string;
  eventTime?: string;
  eventCoverImage?: string;
  venueLocation?: string;
  hostName?: string;
  accentColor?: string;
  status:
    | 'payment_pending'
    | 'pending_payment'
    | 'confirmed'
    | 'checked_in'
    | 'cancelled'
    | 'refunded';
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

  fetchUserOrders: (userId: string) => Promise<void>;
  getOrderById: (orderId: string) => Promise<Order | null>;
  clearOrders: () => void;
}

let pendingFetchPromise: Promise<void> | null = null;

export const useTicketsStore = create<TicketsState>((set, get) => ({
  orders: [],
  loading: false,
  error: null,

  fetchUserOrders: async (_userId: string) => {
    if (get().loading) return pendingFetchPromise || Promise.resolve();
    if (pendingFetchPromise) return pendingFetchPromise;

    set({ loading: true, error: null });
    pendingFetchPromise = (async () => {
      try {
        const response = await apiFetch<{
          success: boolean;
          data?: { orders?: Order[] };
          orders?: Order[];
        }>('/api/v1/tickets/my-wallet');
        const walletOrders: Order[] = response.data?.orders || response.orders || [];

        set({ orders: walletOrders, loading: false, error: null });
      } catch (error: any) {
        console.warn('Unable to fetch wallet orders; keeping existing ticket wallet.', error);
        set({
          error: error?.message || 'Unable to sync ticket wallet. Pull to retry.',
          loading: false,
        });
      }
    })();

    try {
      await pendingFetchPromise;
    } finally {
      pendingFetchPromise = null;
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

      await get().fetchUserOrders('');
      return get().orders.find((order) => order.id === orderId) || null;
    } catch (error: any) {
      console.warn('Unable to fetch order by ID:', error);
      return null;
    }
  },

  clearOrders: () => {
    set({ orders: [], loading: false, error: null });
  },
}));
