import { create } from "zustand";
import { User, subscribeToAuthState } from "@/lib/firebase";
import { useProfileStore } from "./profileStore";
import { useNotificationsStore } from "./notificationsStore";

interface AuthState {
    user: User | null;
    loading: boolean;
    initialized: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setInitialized: (initialized: boolean) => void;
    profileSetupJustCompleted: boolean;
    setProfileSetupJustCompleted: (val: boolean) => void;
    onboardingJustCompleted: boolean;
    setOnboardingJustCompleted: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    initialized: false,
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ loading }),
    setInitialized: (initialized) => set({ initialized, loading: false }),
    profileSetupJustCompleted: false,
    setProfileSetupJustCompleted: (val) => set({ profileSetupJustCompleted: val }),
    onboardingJustCompleted: false,
    setOnboardingJustCompleted: (val) => set({ onboardingJustCompleted: val }),
}));

// Initialize auth listener (call this once in root layout)
export function initAuthListener() {
    const { setUser, setInitialized } = useAuthStore.getState();

    const unsubscribe = subscribeToAuthState((user) => {
        setUser(user);
        setInitialized(true);

        // On sign-out: clean up all user-scoped Firestore subscriptions
        if (!user) {
            useProfileStore.getState().clearProfile();
            useNotificationsStore.getState().clearNotifications();
        }
    });

    return unsubscribe;
}
