import { create } from "zustand";
import { ScannerEventData } from "@/lib/scanner/types";

interface ScannerState {
    eventData: ScannerEventData | null;
    isAuthenticated: boolean;
    setEventData: (data: ScannerEventData | null) => void;
    clearEvent: () => void;
}

export const useScannerStore = create<ScannerState>((set) => ({
    eventData: null,
    isAuthenticated: false,
    setEventData: (data) =>
        set({ eventData: data, isAuthenticated: !!data?.valid }),
    clearEvent: () =>
        set({ eventData: null, isAuthenticated: false }),
}));
