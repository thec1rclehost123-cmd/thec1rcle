import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
    collection,
    doc,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { TicketTier } from "./eventsStore";

// Simple async storage for React Native
const asyncStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            const { getItemAsync } = await import("expo-secure-store");
            return await getItemAsync(name);
        } catch {
            return null;
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        try {
            const { setItemAsync } = await import("expo-secure-store");
            await setItemAsync(name, value);
        } catch { }
    },
    removeItem: async (name: string): Promise<void> => {
        try {
            const { deleteItemAsync } = await import("expo-secure-store");
            await deleteItemAsync(name);
        } catch { }
    },
};

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

interface CartState {
    items: CartItem[];
    promoCode: string | null;
    promoDiscount: number;
    reservationExpiry: number | null;

    addItem: (item: CartItem) => void;
    removeItem: (eventId: string, tierId: string) => void;
    updateQuantity: (eventId: string, tierId: string, quantity: number) => void;
    applyPromoCode: (code: string) => Promise<{ success: boolean; error?: string }>;
    clearPromoCode: () => void;
    clearCart: () => void;
    getSubtotal: () => number;
    getTotal: () => number;
    getItemCount: () => number;
    createOrder: (userId: string) => Promise<{ success: boolean; orderId?: string; error?: string }>;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            promoCode: null,
            promoDiscount: 0,
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
                        reservationExpiry: Date.now() + 10 * 60 * 1000
                    });
                } else {
                    set({
                        items: [...items, item],
                        reservationExpiry: Date.now() + 10 * 60 * 1000
                    });
                }
            },

            removeItem: (eventId: string, tierId: string) => {
                const items = get().items;
                set({
                    items: items.filter(
                        (i) => !(i.eventId === eventId && i.tier.id === tierId)
                    )
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

            applyPromoCode: async (code: string) => {
                if (code.toUpperCase() === "FIRST10") {
                    set({ promoCode: code, promoDiscount: 10 });
                    return { success: true };
                }
                return { success: false, error: "Invalid promo code" };
            },

            clearPromoCode: () => {
                set({ promoCode: null, promoDiscount: 0 });
            },

            clearCart: () => {
                set({
                    items: [],
                    promoCode: null,
                    promoDiscount: 0,
                    reservationExpiry: null
                });
            },

            getSubtotal: () => {
                const items = get().items;
                return items.reduce((sum, item) => sum + item.tier.price * item.quantity, 0);
            },

            getTotal: () => {
                const subtotal = get().getSubtotal();
                const promoDiscount = get().promoDiscount;
                const discount = (subtotal * promoDiscount) / 100;
                return Math.max(0, subtotal - discount);
            },

            getItemCount: () => {
                const items = get().items;
                return items.reduce((sum, item) => sum + item.quantity, 0);
            },

            createOrder: async (userId: string) => {
                const state = get();
                const items = state.items;
                const promoCode = state.promoCode;

                if (items.length === 0) {
                    return { success: false, error: "Cart is empty" };
                }

                try {
                    const db = getFirebaseDb();
                    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                    const orderData = {
                        id: orderId,
                        userId,
                        status: "pending_payment",
                        items: items.map(i => ({
                            eventId: i.eventId,
                            eventTitle: i.eventTitle,
                            tierId: i.tier.id,
                            tierName: i.tier.name,
                            quantity: i.quantity,
                            unitPrice: i.tier.price,
                            subtotal: i.tier.price * i.quantity,
                            entryType: i.tier.entryType,
                        })),
                        eventId: items[0].eventId,
                        eventTitle: items[0].eventTitle,
                        eventDate: items[0].eventDate,
                        venueLocation: items[0].eventVenue,
                        promoCode: promoCode || null,
                        subtotal: state.getSubtotal(),
                        discount: state.getSubtotal() - state.getTotal(),
                        totalAmount: state.getTotal(),
                        currency: "INR",
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };

                    await runTransaction(db, async (transaction) => {
                        const orderRef = doc(db, "orders", orderId);
                        transaction.set(orderRef, orderData);
                    });

                    state.clearCart();
                    return { success: true, orderId };
                } catch (error: any) {
                    console.error("Error creating order:", error);
                    return { success: false, error: error.message };
                }
            },
        }),
        {
            name: "c1rcle-cart",
            storage: createJSONStorage(() => asyncStorage),
            partialize: (state) => ({
                items: state.items,
                promoCode: state.promoCode,
                promoDiscount: state.promoDiscount,
                reservationExpiry: state.reservationExpiry,
            }),
        }
    )
);
