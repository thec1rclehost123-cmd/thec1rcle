import { create } from "zustand";
import { User, subscribeToAuthState } from "@/lib/firebase";
import { useProfileStore, UserProfile } from "./profileStore";

interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    initialized: boolean;
    setUser: (user: User | null) => void;
    setProfile: (profile: UserProfile | null) => void;
    setLoading: (loading: boolean) => void;
    setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
    loading: true,
    initialized: false,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (loading) => set({ loading }),
    setInitialized: (initialized) => set({ initialized, loading: false }),
}));

// Initialize auth listener (call this once in root layout)
export function initAuthListener() {
    const { setUser, setProfile, setInitialized } = useAuthStore.getState();
    const { loadProfile, clearProfile } = useProfileStore.getState();

    const unsubscribe = subscribeToAuthState(async (user) => {
        setUser(user);

        if (user) {
            // Fetch profile and sync to auth store
            try {
                await loadProfile(user.uid);
                const profile = useProfileStore.getState().profile;
                setProfile(profile);
            } catch (err) {
                console.error("[AuthStore] Profile sync failed", err);
            }
        } else {
            setProfile(null);
            clearProfile();
        }

        setInitialized(true);
    });

    return unsubscribe;
}
