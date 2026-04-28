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
import {
    reserveTickets,
    calculatePricing,
    initiateCheckout,
    PricingResult,
    ReservationResult,
    TicketingItem
} from "@/lib/api/ticketing";
import { handleApiError } from "@/lib/errorHandler";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";
import NetInfo from "@react-native-community/netinfo";

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
}

interface CartState {
    items: CartItem[];
    promoCode: string | null;
    promoterCode: string | null;
    reservationId: string | null;
    reservationExpiry: number | null;
    pricing: PricingResult['pricing'] | null;
    isProcessing: boolean;
    isSuccess: boolean;
    processingState: string;
    error: string | null;
    pendingOrderId: string | null;
    pendingRazorpayOrder: any | null;

    // Actions
    addItem: (item: CartItem) => void;
    removeItem: (eventId: string, tierId: string) => void;
    updateQuantity: (eventId: string, tierId: string, quantity: number) => void;
    applyPromoCode: (code: string) => Promise<{ success: boolean; error?: string }>;
    setPromoterCode: (code: string | null) => void;
    clearPromoCode: () => void;
    clearCart: () => void;

    // Server Sync
    syncPricing: () => Promise<void>;
    reserve: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
    checkout: (userDetails: { name: string; email: string; phone: string }) => Promise<{
        success: boolean;
        requiresPayment?: boolean;
        order?: any;
        razorpay?: any;
        error?: string;
    }>;

    // Selectors
    getSubtotal: () => number;
    getTotal: () => number;
    getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            promoCode: null,
            promoterCode: null,
            reservationId: null,
            reservationExpiry: null,
            pricing: null,
            isProcessing: false,
            isSuccess: false,
            processingState: "",
            error: null,
            pendingOrderId: null,
            pendingRazorpayOrder: null,

            addItem: (item: CartItem) => {
                const items = get().items;

                // On web/backend, we only support one event per cart for checkout simplicity
                // If adding a different event, we should ideally clear or warn. 
                // For now, let's keep it simple but record which event is active.
                if (items.length > 0 && items[0].eventId !== item.eventId) {
                    set({ items: [item], pricing: null, promoCode: null, reservationId: null });
                    return;
                }

                const existingIndex = items.findIndex(
                    (i) => i.eventId === item.eventId && i.tier.id === item.tier.id
                );

                if (existingIndex >= 0) {
                    const updatedItems = [...items];
                    updatedItems[existingIndex].quantity += item.quantity;
                    set({ items: updatedItems });
                } else {
                    set({ items: [...items, item] });
                }

                // Clear any existing reservation if cart changes
                set({ reservationId: null, reservationExpiry: null });

                // Trigger background pricing sync
                get().syncPricing();
            },

            removeItem: (eventId: string, tierId: string) => {
                const items = get().items;
                const newItems = items.filter(
                    (i) => !(i.eventId === eventId && i.tier.id === tierId)
                );
                set({
                    items: newItems,
                    reservationId: null,
                    reservationExpiry: null
                });

                if (newItems.length > 0) {
                    get().syncPricing();
                } else {
                    set({ pricing: null });
                }
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
                    reservationId: null, // Cart changed, need new reservation
                    reservationExpiry: null
                });

                get().syncPricing();
            },

            applyPromoCode: async (code: string) => {
                const items = get().items;
                if (items.length === 0) return { success: false, error: "Cart is empty" };

                set({ isProcessing: true, error: null });
                try {
                    const result = await calculatePricing(items[0].eventId,
                        items.map(i => ({ tierId: i.tier.id, quantity: i.quantity })),
                        { promoCode: code, promoterCode: get().promoterCode || undefined }
                    );

                    if (result.success && result.pricing) {
                        if (result.pricing.promoError) {
                            set({ isProcessing: false, error: result.pricing.promoError });
                            return { success: false, error: result.pricing.promoError };
                        }

                        set({
                            promoCode: code,
                            pricing: result.pricing,
                            isProcessing: false,
                            error: null
                        });
                        return { success: true };
                    } else {
                        const errorMsg = result.error || "Invalid promo code";
                        set({ isProcessing: false, error: errorMsg });
                        return { success: false, error: errorMsg };
                    }
                } catch (error: any) {
                    handleApiError(error, "applyPromoCode");
                    set({ isProcessing: false });
                    return { success: false, error: error.message };
                }
            },

            setPromoterCode: (code: string | null) => {
                set({ promoterCode: code });
                get().syncPricing();
            },

            clearPromoCode: () => {
                set({ promoCode: null, error: null });
                get().syncPricing();
            },

            clearCart: () => {
                set({
                    items: [],
                    promoCode: null,
                    promoterCode: null,
                    reservationId: null,
                    reservationExpiry: null,
                    pricing: null,
                    error: null,
                    isProcessing: false,
                    processingState: "",
                    pendingOrderId: null,
                    pendingRazorpayOrder: null,
                });
            },

            syncPricing: async () => {
                const items = get().items;
                if (items.length === 0) return;

                try {
                    const result = await calculatePricing(items[0].eventId,
                        items.map(i => ({ tierId: i.tier.id, quantity: i.quantity })),
                        {
                            promoCode: get().promoCode || undefined,
                            promoterCode: get().promoterCode || undefined,
                            reservationId: get().reservationId || undefined
                        }
                    );

                    if (result.success) {
                        set({ pricing: result.pricing });
                    }
                } catch (error) {
                    handleApiError(error, "syncPricing", { silent: true });
                }
            },

            reserve: async (deviceId: string) => {
                const items = get().items;
                if (items.length === 0) return { success: false, error: "Cart is empty" };

                set({ isProcessing: true, processingState: "reserving", error: null });
                try {
                    const result = await reserveTickets(
                        items[0].eventId,
                        items.map(i => ({ tierId: i.tier.id, quantity: i.quantity })),
                        deviceId
                    );

                    if (result.success && result.reservationId) {
                        set({
                            reservationId: result.reservationId,
                            reservationExpiry: Date.now() + (result.expiresInSeconds || 600) * 1000,
                            isProcessing: false,
                            processingState: ""
                        });
                        return { success: true };
                    } else {
                        set({ isProcessing: false, processingState: "", error: result.error });
                        return { success: false, error: result.error };
                    }
                } catch (error: any) {
                    handleApiError(error, "reserve");
                    set({ isProcessing: false, processingState: "", error: error.message });
                    return { success: false, error: error.message };
                }
            },

            checkout: async (userDetails: { name: string; email: string; phone: string }) => {
                const network = await NetInfo.fetch();
                if (!network.isConnected) {
                    return { success: false, error: "Network connection required for secure checkout." };
                }

                const state = get();
                if (!state.reservationId) {
                    return { success: false, error: "No active reservation. Try again." };
                }

                // Check for local expiration
                if (state.reservationExpiry && Date.now() > state.reservationExpiry) {
                    set({ reservationId: null, reservationExpiry: null, error: "Reservation expired." });
                    return { success: false, error: "Your selection has expired. Please try again." };
                }

                set({ isProcessing: true, processingState: "initiating", error: null });
                try {
                    const result = await initiateCheckout(
                        state.reservationId,
                        {
                            userName: userDetails.name,
                            userEmail: userDetails.email,
                            userPhone: userDetails.phone
                        },
                        {
                            promoCode: state.promoCode || undefined,
                            promoterCode: state.promoterCode || undefined
                        }
                    );

                    if (result.success) {
                        if (!result.requiresPayment) {
                            // Free order success
                            set({ isSuccess: true, processingState: "issuing", isProcessing: false });
                            trackEvent(ANALYTICS_EVENTS.TICKET_PURCHASED, {
                                amount: 0,
                                eventId: state.items[0]?.eventId
                            });
                            return result;
                        }

                        // Paid order success - returns Razorpay info
                        set({
                            isProcessing: false,
                            processingState: "",
                            pendingOrderId: result.order.id,
                            pendingRazorpayOrder: result.razorpay
                        });
                        return result;
                    } else {
                        set({ isProcessing: false, processingState: "", error: result.error });
                        return { success: false, error: result.error };
                    }
                } catch (error: any) {
                    handleApiError(error, "checkout");
                    set({ isProcessing: false, processingState: "", error: error.message });
                    return { success: false, error: error.message };
                }
            },

            getSubtotal: () => {
                if (get().pricing) return get().pricing!.subtotal;
                const items = get().items;
                return items.reduce((sum, item) => sum + item.tier.price * item.quantity, 0);
            },

            getTotal: () => {
                if (get().pricing) return get().pricing!.grandTotal;
                return get().getSubtotal();
            },

            getItemCount: () => {
                const items = get().items;
                return items.reduce((sum, item) => sum + item.quantity, 0);
            },
        }),
        {
            name: "c1rcle-cart",
            storage: createJSONStorage(() => asyncStorage),
            partialize: (state) => ({
                items: state.items,
                promoCode: state.promoCode,
                promoterCode: state.promoterCode,
                reservationId: state.reservationId,
                reservationExpiry: state.reservationExpiry,
                pendingOrderId: state.pendingOrderId,
                pendingRazorpayOrder: state.pendingRazorpayOrder,
            }),
        }
    )
);
