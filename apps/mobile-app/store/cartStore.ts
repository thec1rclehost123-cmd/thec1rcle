/**
 * THE C1RCLE - Cart Store
 * Client-side cart state only. Order creation and payment happens via
 * the guest-portal backend APIs (see lib/api.ts and lib/payments.ts).
 *
 * Cart persistence uses AsyncStorage (not SecureStore) to avoid the
 * 2KB size limit that caused silent data loss on iOS.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TicketTier } from "./eventsStore";
import { validatePromoCode as apiValidatePromo } from "@/lib/api";

export interface CartItem {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventVenue: string;
    eventCoverImage?: string;
    tier: TicketTier;
    quantity: number;
    promoterCode?: string;
    discount?: number;
}

interface PromoState {
    code: string;
    discountAmount: number;    // absolute ₹ amount (from server)
    discountPercent: number;   // percentage (for display)
    label?: string;
}

interface CartState {
    items: CartItem[];
    promo: PromoState | null;
    reservationExpiry: number | null;

    // Cart actions
    addItem: (item: CartItem) => void;
    removeItem: (eventId: string, tierId: string) => void;
    updateQuantity: (eventId: string, tierId: string, quantity: number) => void;
    clearCart: () => void;

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
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            promo: null,
            reservationExpiry: null,

            addItem: (item: CartItem) => {
                const items = get().items;
                const existingIndex = items.findIndex(
                    (i) => i.eventId === item.eventId && i.tier.id === item.tier.id
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
                set({
                    items: items.filter(
                        (i) => !(i.eventId === eventId && i.tier.id === tierId)
                    ),
                });
            },

            updateQuantity: (eventId: string, tierId: string, quantity: number) => {
                if (quantity <= 0) {
                    get().removeItem(eventId, tierId);
                    return;
                }

                const items = get().items;
                set({
                    items: items.map((i) =>
                        i.eventId === eventId && i.tier.id === tierId
                            ? { ...i, quantity }
                            : i
                    ),
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
                            price: i.tier.price,
                            subtotal: i.tier.price * i.quantity,
                        })),
                    });

                    if (result.valid) {
                        const subtotal = get().getSubtotal();
                        const discountPercent = subtotal > 0
                            ? Math.round(((result.discountAmount || 0) / subtotal) * 100)
                            : 0;

                        set({
                            promo: {
                                code: code.toUpperCase(),
                                discountAmount: result.discountAmount || 0,
                                discountPercent,
                                label: result.label,
                            },
                        });
                        return { success: true };
                    }

                    return { success: false, error: result.error || "Invalid promo code" };
                } catch (error: any) {
                    return {
                        success: false,
                        error: error.message || "Failed to validate promo code",
                    };
                }
            },

            clearPromoCode: () => {
                set({ promo: null });
            },

            clearCart: () => {
                set({
                    items: [],
                    promo: null,
                    reservationExpiry: null,
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
        }),
        {
            name: "c1rcle-cart",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                items: state.items,
                promo: state.promo,
                reservationExpiry: state.reservationExpiry,
            }),
        }
    )
);
