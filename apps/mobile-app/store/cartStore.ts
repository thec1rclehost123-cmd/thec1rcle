/**
 * THE C1RCLE - Cart Store
 * Client-side cart state only. Order creation and payment happens via
 * the guest-portal backend APIs (see lib/api.ts and lib/payments.ts).
 *
 * Cart persistence uses AsyncStorage (not SecureStore) to avoid the
 * 2KB size limit that caused silent data loss on iOS.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TicketTier } from './eventsStore';
import { validatePromoCode as apiValidatePromo } from '@/lib/api';

export interface CartItem {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  eventCoverImage?: string;
  eventAccentColor?: string;
  tier: TicketTier;
  quantity: number;
  priceTotal?: number;
  promoterCode?: string;
  discount?: number;
}

interface PromoState {
  code: string;
  discountAmount: number; // absolute ₹ amount (from server)
  discountPercent: number; // percentage (for display)
  label?: string;
}

export interface PendingReservation {
  reservationId: string;
  eventId: string;
  eventTitle: string;
  expiresAt: string;
  items: { tierId: string; quantity: number }[];
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  promoCode?: string | null;
  promoterCode?: string | null;
}

interface AddItemResult {
  replacedEventId?: string;
  replacedEventTitle?: string;
}

interface CartState {
  items: CartItem[];
  promo: PromoState | null;
  reservationExpiry: number | null;
  pendingPaymentOrderId: string | null;
  pendingReservation: PendingReservation | null;

  // Cart actions
  addItem: (item: CartItem) => AddItemResult | void;
  removeItem: (eventId: string, tierId: string) => void;
  updateQuantity: (eventId: string, tierId: string, quantity: number) => void;
  clearCart: () => void;
  setPendingPaymentOrderId: (orderId: string | null) => void;
  setPendingReservation: (reservation: PendingReservation | null) => void;
  clearPendingReservation: () => void;

  // Promo code — validated via backend API
  applyPromoCode: (code: string, eventId: string) => Promise<{ success: boolean; error?: string }>;
  clearPromoCode: () => void;

  // Computed
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
  getEventId: () => string | null;

  // For checkout — returns items in the format the API expects
  getCheckoutItems: () => { tierId: string; quantity: number }[];

  // Reservation expiry
  isReservationExpired: () => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promo: null,
      reservationExpiry: null,
      pendingPaymentOrderId: null,
      pendingReservation: null,

      addItem: (item: CartItem) => {
        const items = get().items;
        const activeEventId = items[0]?.eventId;

        // Checkout mirrors the guest portal: one booking flow per event.
        if (activeEventId && activeEventId !== item.eventId) {
          const replacedEventTitle = items[0]?.eventTitle;
          set({
            items: [item],
            promo: null,
            reservationExpiry: Date.now() + 10 * 60 * 1000,
            pendingReservation: null,
            pendingPaymentOrderId: null,
          });
          return {
            replacedEventId: activeEventId,
            replacedEventTitle,
          };
        }

        const existingIndex = items.findIndex(
          (i) => i.eventId === item.eventId && i.tier.id === item.tier.id,
        );

        if (existingIndex >= 0) {
          const updatedItems = [...items];
          updatedItems[existingIndex].quantity += item.quantity;
          set({
            items: updatedItems,
            reservationExpiry: Date.now() + 10 * 60 * 1000,
          });
        } else {
          set({
            items: [...items, item],
            reservationExpiry: Date.now() + 10 * 60 * 1000,
          });
        }
      },

      removeItem: (eventId: string, tierId: string) => {
        const items = get().items;
        const nextItems = items.filter((i) => !(i.eventId === eventId && i.tier.id === tierId));
        set({
          items: nextItems,
          promo: nextItems.length > 0 ? get().promo : null,
          reservationExpiry: nextItems.length > 0 ? get().reservationExpiry : null,
          pendingReservation: null,
          pendingPaymentOrderId: null,
        });
      },

      updateQuantity: (eventId: string, tierId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(eventId, tierId);
          return;
        }

        const items = get().items;
        const nextItems = items.map((i) =>
          i.eventId === eventId && i.tier.id === tierId ? { ...i, quantity } : i,
        );
        set({
          items: nextItems,
          promo: nextItems.length > 0 ? get().promo : null,
          pendingReservation: null,
          pendingPaymentOrderId: null,
        });
      },

      /**
       * Validate promo code via backend API (same endpoint as website).
       * Uses POST /api/checkout/promo
       */
      applyPromoCode: async (code: string, eventId: string) => {
        const items = get().items;

        try {
          const result = await apiValidatePromo({
            eventId,
            code: code.toUpperCase(),
            items: items.map((i) => ({
              tierId: i.tier.id,
              quantity: i.quantity,
            })),
          });

          if (result.valid) {
            const subtotal = get().getSubtotal();
            const discountPercent =
              subtotal > 0 ? Math.round(((result.discountAmount || 0) / subtotal) * 100) : 0;

            set({
              promo: {
                code: code.toUpperCase(),
                discountAmount: result.discountAmount || 0,
                discountPercent,
                label: result.label,
              },
              pendingReservation: null,
              pendingPaymentOrderId: null,
            });
            return { success: true };
          }

          return { success: false, error: result.error || 'Invalid promo code' };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to validate promo code',
          };
        }
      },

      clearPromoCode: () => {
        set({
          promo: null,
          pendingReservation: null,
          pendingPaymentOrderId: null,
        });
      },

      clearCart: () => {
        set({
          items: [],
          promo: null,
          reservationExpiry: null,
          pendingPaymentOrderId: null,
          pendingReservation: null,
        });
      },

      setPendingPaymentOrderId: (orderId: string | null) => {
        set({ pendingPaymentOrderId: orderId });
      },

      setPendingReservation: (reservation: PendingReservation | null) => {
        set({
          pendingReservation: reservation,
          reservationExpiry: reservation ? new Date(reservation.expiresAt).getTime() : null,
        });
      },

      clearPendingReservation: () => {
        set({
          pendingReservation: null,
          reservationExpiry: null,
          pendingPaymentOrderId: null,
        });
      },

      getSubtotal: () => {
        const items = get().items;
        return items.reduce((sum, item) => sum + item.tier.price * item.quantity, 0);
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const promo = get().promo;
        const discount = promo?.discountAmount || 0;
        return Math.max(0, subtotal - discount);
      },

      getItemCount: () => {
        const items = get().items;
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getEventId: () => {
        const items = get().items;
        return items.length > 0 ? items[0].eventId : null;
      },

      getCheckoutItems: () => {
        return get().items.map((i) => ({
          tierId: i.tier.id,
          quantity: i.quantity,
        }));
      },

      isReservationExpired: () => {
        const expiry = get().reservationExpiry;
        if (!expiry) return false;
        return Date.now() > expiry;
      },
    }),
    {
      name: 'c1rcle-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        promo: state.promo,
        reservationExpiry: state.reservationExpiry,
        pendingPaymentOrderId: state.pendingPaymentOrderId,
        pendingReservation: state.pendingReservation,
      }),
    },
  ),
);
