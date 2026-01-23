import { create } from "zustand";
import { User, subscribeToAuthState } from "@/lib/firebase";

interface AuthState {
    user: User | null;
    loading: boolean;
    initialized: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    initialized: false,
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ loading }),
    setInitialized: (initialized) => set({ initialized, loading: false }),
}));

// Initialize auth listener (call this once in root layout)
export function initAuthListener() {
    const { setUser, setInitialized } = useAuthStore.getState();

    const unsubscribe = subscribeToAuthState((user) => {
        setUser(user);
        setInitialized(true);
    });

    return unsubscribe;
}
