import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * THE C1RCLE - API Configuration
 * 
 * By default, the app uses the production API at thec1rcle.com.
 * For local development testing, set EXPO_PUBLIC_GUEST_PORTAL_API_URL 
 * to your local server (e.g., http://192.168.x.x:3000/api)
 */

// Production API URL
const PRODUCTION_API_URL = "https://thec1rcle.com/api";

// Helper to determine local API URL for development
const getLocalUrl = () => {
    if (process.env.EXPO_PUBLIC_GUEST_PORTAL_API_URL) return process.env.EXPO_PUBLIC_GUEST_PORTAL_API_URL;

    // Use detected machine IP for reliability
    const MACHINE_IP = "172.16.71.170";
    const PORT = "3000";

    // If running in a simulator, localhost is more reliable than LAN IP (due to firewall/router isolation)
    if (!Constants.isDevice) {
        return Platform.OS === "android"
            ? `http://10.0.2.2:${PORT}/api`
            : `http://localhost:${PORT}/api`;
        //   ^ iOS Simulator maps localhost to the host machine perfectly
    }

    // Derive from Expo Go host URI if valid (for physical devices)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const ip = hostUri.split(":")[0];
        return `http://${ip}:${PORT}/api`;
    }

    // Fallback
    return `http://${MACHINE_IP}:${PORT}/api`;
};

// Use dynamic local URL in dev, production otherwise
export const GUEST_PORTAL_API_BASE = __DEV__ ? getLocalUrl() : PRODUCTION_API_URL;

// Helper to get headers with Auth token
export async function getAuthHeaders() {
    try {
        const { getAuth } = await import("firebase/auth");
        const { getApp } = await import("firebase/app");
        const app = getApp();
        const auth = getAuth(app);
        const user = auth.currentUser;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (user) {
            const token = await user.getIdToken();
            headers["Authorization"] = `Bearer ${token}`;
        }

        return headers;
    } catch (error) {
        console.error("Error getting auth headers:", error);
        return {
            "Content-Type": "application/json",
        };
    }
}

