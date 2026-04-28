import { create } from "zustand";
import { getDoc, doc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export interface DiscoverySectionConfig {
    id: string;
    title: string;
    icon: string;
    type: "horizontal" | "grid";
    filterType: "heat_score" | "social_proof" | "category" | "all" | "tonight" | "trending";
    filterValue?: any;
    limit: number;
    enabled: boolean;
    order: number;
}

interface DiscoveryState {
    config: DiscoverySectionConfig[];
    loading: boolean;
    error: string | null;
    fetchConfig: () => Promise<void>;
}

// Fallback configuration (identical to current hardcoded logic)
const DEFAULT_CONFIG: DiscoverySectionConfig[] = [
    {
        id: "for-you",
        title: "For You",
        icon: "sparkles",
        type: "horizontal",
        filterType: "trending",
        limit: 8,
        enabled: true,
        order: 1
    },
    {
        id: "similar",
        title: "Similar to you",
        icon: "people",
        type: "horizontal",
        filterType: "social_proof",
        limit: 8,
        enabled: true,
        order: 2
    },
    {
        id: "parties",
        title: "Parties & Clubs",
        icon: "wine",
        type: "horizontal",
        filterType: "category",
        filterValue: ["party", "club", "night"],
        limit: 8,
        enabled: true,
        order: 3
    },
    {
        id: "all",
        title: "All Events",
        icon: "planet",
        type: "horizontal",
        filterType: "all",
        limit: 50,
        enabled: true,
        order: 4
    }
];

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
    config: DEFAULT_CONFIG,
    loading: false,
    error: null,

    fetchConfig: async () => {
        set({ loading: true });
        try {
            const db = getFirebaseDb();
            const configDoc = await getDoc(doc(db, "app_config", "explore_layout"));

            if (configDoc.exists()) {
                const data = configDoc.data();
                if (data.sections && Array.isArray(data.sections)) {
                    const sections = (data.sections as DiscoverySectionConfig[])
                        .filter(s => s.enabled)
                        .sort((a, b) => (a.order || 0) - (b.order || 0));
                    set({ config: sections, loading: false });
                } else {
                    set({ config: DEFAULT_CONFIG, loading: false });
                }
            } else {
                // Config doc doesn't exist yet, use fallback
                set({ config: DEFAULT_CONFIG, loading: false });
            }
        } catch (error: any) {
            console.warn("[DiscoveryStore] Failed to fetch layout config:", error);
            set({ error: error.message, loading: false, config: DEFAULT_CONFIG });
        }
    }
}));
