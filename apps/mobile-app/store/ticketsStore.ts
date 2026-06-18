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
  status: 'pending_payment' | 'confirmed' | 'checked_in' | 'cancelled' | 'refunded';
  tickets: OrderTicket[];
  totalAmount: number;
  currency?: string;
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string;
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

export interface QRCode {
  ticketId: string;
  ticketIndex: number;
  qrCode: string;
  qrUrl?: string;
  qrExpiresAt?: string;
  qrMode?: 'jwt' | 'static' | string;
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

function toIso(value: any): string | null {
  try {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value.seconds != null) return new Date(value.seconds * 1000).toISOString();
  } catch {
    // ignore
  }
  return null;
}

function mapOrder(docId: string, data: any): Order {
  const eventDate =
    toIso(data.eventDate) ||
    toIso(data.eventStartDate) ||
    toIso(data.startDate) ||
    toIso(data.startAt) ||
    toIso(data.date);
  return {
    id: docId,
    userId: data.userId || data.uid || data.customerId || '',
    userEmail: data.userEmail || undefined,
    userName: data.userName || undefined,
    eventId: data.eventId || '',
    eventTitle: data.eventTitle || data.eventName || data.title,
    eventDate: eventDate || undefined,
    eventStartDate: toIso(data.eventStartDate) || toIso(data.startDate) || undefined,
    eventTime: data.eventTime || data.time || undefined,
    eventCoverImage:
      data.eventCoverImage || data.eventImage || data.image || data.posterUrl || data.poster,
    venueLocation: data.venueLocation || data.eventLocation || data.location || data.venue,
    hostName: data.hostName || data.host?.name || data.host || undefined,
    accentColor: data.accentColor || undefined,
    status: (data.status || 'confirmed') as any,
    tickets: (data.tickets || []).map((t: any) => ({
      ticketId: t.ticketId || t.id,
      tierId: t.tierId || t.ticketId || t.id,
      tierName: t.tierName || t.name || 'General Entry',
      quantity: Number(t.quantity) || 1,
      price: Number(t.price) || 0,
      subtotal: Number(t.subtotal) || (Number(t.price) || 0) * (Number(t.quantity) || 1),
      entryType: t.entryType,
      isClaimed: !!t.isClaimed || !!t.claimedBy,
      claimedBy: t.claimedBy || null,
      requiredGender: t.requiredGender || undefined,
      shareToken: t.shareToken || undefined,
      transferStatus: t.transferStatus || undefined,
      transferId: t.transferId || undefined,
      transferRecipientEmail: t.transferRecipientEmail || undefined,
      receivedFrom: t.receivedFrom || undefined,
    })),
    totalAmount: Number(data.totalAmount ?? data.total ?? 0),
    currency: data.currency || undefined,
    createdAt: toIso(data.createdAt) || new Date().toISOString(),
    updatedAt: toIso(data.updatedAt) || undefined,
    confirmedAt: toIso(data.confirmedAt) || undefined,
    qrData: data.qrData,
    qrCodes: (data.qrCodes || []).map((qr: any, index: number) => ({
      ticketId: qr.ticketId || qr.tierId || `${docId}-${index}`,
      ticketIndex: Number(qr.ticketIndex ?? index),
      qrCode:
        qr.qrCode ||
        qr.qrData ||
        qr.qrPayload ||
        qr.qrJwt ||
        JSON.stringify({ orderId: docId, index }),
      qrUrl: qr.qrUrl || undefined,
      qrExpiresAt: qr.qrExpiresAt || undefined,
      qrMode: qr.qrMode || undefined,
      isUsed: !!qr.isUsed,
    })),
    isClaimed: !!data.isClaimed,
    bundleId: data.bundleId || undefined,
    isRSVP: !!data.isRSVP || data.source === 'rsvp',
    source: data.source,
  };
}

export const useTicketsStore = create<TicketsState>((set, get) => ({
  orders: [],
  loading: false,
  error: null,

  fetchUserOrders: async (_userId: string) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      const response = await apiFetch<{
        success: boolean;
        data?: { orders?: any[] };
        orders?: any[];
      }>('/api/v1/tickets/my-wallet');
      const walletOrders = response.data?.orders || response.orders || [];
      const all = walletOrders.map((order: any) => mapOrder(order.id, order));

      set({ orders: all, loading: false });
    } catch (error: any) {
      console.warn('Unable to fetch wallet orders; showing an empty ticket wallet.', error);
      set({ orders: [], error: null, loading: false });
    }
  },

  getOrderById: async (orderId: string): Promise<Order | null> => {
    try {
      const cached = get().orders.find((order) => order.id === orderId);
      if (cached) return cached;

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
