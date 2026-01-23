import { create } from "zustand";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

// Order/Ticket type matching Firestore schema
export interface Order {
    id: string;
    userId: string;
    eventId: string;
    eventTitle?: string;
    eventDate?: string;
    venueLocation?: string;
    status: "pending_payment" | "confirmed" | "checked_in" | "cancelled" | "refunded";
    tickets: OrderTicket[];
    totalAmount: number;
    createdAt: string;
    qrData?: string;
}

export interface OrderTicket {
    tierId: string;
    tierName: string;
    quantity: number;
    price: number;
    entryType?: string;
}

interface TicketsState {
    orders: Order[];
    loading: boolean;
    error: string | null;

    fetchUserOrders: (userId: string) => Promise<void>;
    getOrderById: (orderId: string) => Promise<Order | null>;
}

export const useTicketsStore = create<TicketsState>((set) => ({
    orders: [],
    loading: false,
    error: null,

    fetchUserOrders: async (userId: string) => {
        set({ loading: true, error: null });

        try {
            const db = getFirebaseDb();
            const ordersRef = collection(db, "orders");

            // Query for user's confirmed orders
            const q = query(
                ordersRef,
                where("userId", "==", userId),
                where("status", "in", ["confirmed", "checked_in"]),
                orderBy("createdAt", "desc")
            );

            const snapshot = await getDocs(q);
            const orders: Order[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Order[];

            set({ orders, loading: false });
        } catch (error: any) {
            console.error("Error fetching orders:", error);
            set({ error: error.message, loading: false });
        }
    },

    getOrderById: async (orderId: string): Promise<Order | null> => {
        try {
            const db = getFirebaseDb();
            const orderRef = doc(db, "orders", orderId);
            const orderDoc = await getDoc(orderRef);

            if (orderDoc.exists()) {
                return { id: orderDoc.id, ...orderDoc.data() } as Order;
            }
            return null;
        } catch (error: any) {
            console.error("Error fetching order:", error);
            return null;
        }
    },
}));
