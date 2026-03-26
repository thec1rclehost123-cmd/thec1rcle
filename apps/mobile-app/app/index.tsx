import { Redirect, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/lib/design/theme";
import { hasCompletedOnboarding } from "./onboarding";
import { hasCompletedProfileSetup } from "./profile-setup";

/**
 * Index Route - Entry Point
 * 
 * This is the initial route when the app launches.
 * It checks auth state and redirects accordingly:
 * - If not initialized: Show loading
 * - If authenticated: Go to main tabs
 * - If not authenticated: Go to login
 */
export default function Index() {
    const { initialized, user } = useAuthStore();
    const [checksReady, setChecksReady] = useState(false);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

    useEffect(() => {
        let mounted = true;
        setChecksReady(false);

        const runChecks = async () => {
            const [onboardingComplete, profileSetupComplete] = await Promise.all([
                hasCompletedOnboarding(),
                user ? hasCompletedProfileSetup() : Promise.resolve(false),
            ]);

            if (!mounted) return;

            setNeedsOnboarding(!onboardingComplete);
            setNeedsProfileSetup(!!user && !profileSetupComplete);
            setChecksReady(true);
        };

        void runChecks();

        return () => {
            mounted = false;
        };
    }, [user?.uid]);

    // Still initializing - show loading state
    if (!initialized || !checksReady) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: colors.base.DEFAULT,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    if (!user) {
        return <Redirect href={needsOnboarding ? "/onboarding" : "/(auth)/login"} />;
    }

    if (needsProfileSetup) {
        return <Redirect href={"/profile-setup" as Href} />;
    }

    // Redirect based on auth state
    if (user) {
        return <Redirect href="/(tabs)/explore" />;
    }
    return null;
}
