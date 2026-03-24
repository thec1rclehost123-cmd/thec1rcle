import { create } from "zustand";
import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export interface Venue {
    id: string;
    name?: string;
    displayName?: string;
    slug?: string;
    area?: string;
    neighborhood?: string;
    city?: string;
    address?: string;
    image?: string;
    coverURL?: string;
    coverImage?: string;
    photoURL?: string;
    tags?: string[];
    vibes?: string[];
    genres?: string[];
    tablesAvailable?: boolean;
    isVerified?: boolean;
    venueType?: string;
    description?: string;
    whatsapp?: string;
    phone?: string;
}

interface VenuesState {
    venues: Venue[];
    loading: boolean;
    error: string | null;
    fetchVenues: (filters?: { area?: string; search?: string; tablesOnly?: boolean }) => Promise<void>;
}

export const useVenuesStore = create<VenuesState>((set) => ({
    venues: [],
    loading: false,
    error: null,

    fetchVenues: async (filters = {}) => {
        set({ loading: true, error: null });
        try {
            const db = getFirebaseDb();
            let qRef: any = query(collection(db, "venues"));
            if (filters.tablesOnly) {
                qRef = query(qRef, where("tablesAvailable", "==", true));
            }

            const snapshot = await getDocs(qRef);
            let venues: Venue[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Venue[];

            if (filters.area) {
                const clean = filters.area.toLowerCase().trim();
                venues = venues.filter((v) => {
                    const a = (v.area || "").toLowerCase();
                    const n = (v.neighborhood || "").toLowerCase();
                    const addr = (v.address || "").toLowerCase();
                    const c = (v.city || "").toLowerCase();
                    return a.includes(clean) || n.includes(clean) || addr.includes(clean) || c.includes(clean);
                });
            }

            if (filters.search) {
                const s = filters.search.toLowerCase().trim();
                venues = venues.filter((v) => {
                    const name = (v.displayName || v.name || "").toLowerCase();
                    const a = (v.area || "").toLowerCase();
                    const n = (v.neighborhood || "").toLowerCase();
                    return name.includes(s) || a.includes(s) || n.includes(s);
                });
            }

            set({ venues, loading: false });
        } catch (e: any) {
            set({ error: e?.message || "Failed to fetch venues", loading: false });
        }
    },
}));

