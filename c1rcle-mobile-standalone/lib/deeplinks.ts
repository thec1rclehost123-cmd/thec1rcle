// Deep linking configuration and helpers
import * as Linking from "expo-linking";
import { Share, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";

// App scheme for deep links
const APP_SCHEME = "c1rcle";
const WEB_DOMAIN = "thec1rcle.com";

// Deep link types
export type DeepLinkType = "event" | "transfer" | "profile" | "invite" | "ticket" | "chat" | "safety" | "claim" | "going";

// Build deep link URL
export function buildDeepLink(type: DeepLinkType, params: Record<string, string>): string {
    const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

    // Universal link for web (works on both platforms)
    return `https://${WEB_DOMAIN}/app/${type}?${queryString}`;
}

// Build app-specific deep link
export function buildAppLink(type: DeepLinkType, params: Record<string, string>): string {
    const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

    return `${APP_SCHEME}://${type}?${queryString}`;
}

// Share event link
export async function shareEventLink(
    eventId: string,
    eventTitle: string,
    customMessage?: string
): Promise<boolean> {
    try {
        const link = buildDeepLink("event", { id: eventId });
        const message = customMessage || `🎉 Check out ${eventTitle} on THE C1RCLE!\n\n${link}`;

        const result = await Share.share({
            message,
            url: Platform.OS === "ios" ? link : undefined, // iOS shows URL separately
            title: eventTitle,
        });

        return result.action === Share.sharedAction;
    } catch (error) {
        console.error("Error sharing event:", error);
        return false;
    }
}

// Share ticket transfer code
export async function shareTransferCode(
    code: string,
    eventTitle: string
): Promise<boolean> {
    try {
        const message = `🎟️ I'm sending you a ticket to ${eventTitle}!\n\nOpen THE C1RCLE app and enter this code:\n\n${code}\n\nCode expires in 24 hours.`;

        const result = await Share.share({
            message,
            title: "Ticket Transfer",
        });

        return result.action === Share.sharedAction;
    } catch (error) {
        console.error("Error sharing transfer code:", error);
        return false;
    }
}

// Share invite link
export async function shareInviteLink(
    referralCode?: string
): Promise<boolean> {
    try {
        const params: Record<string, string> = {};
        if (referralCode) {
            params.ref = referralCode;
        }

        const link = buildDeepLink("invite", params);
        const message = `Join me on THE C1RCLE - the best way to discover events and parties! 🎉\n\n${link}`;

        const result = await Share.share({
            message,
            title: "Join THE C1RCLE",
        });

        return result.action === Share.sharedAction;
    } catch (error) {
        console.error("Error sharing invite:", error);
        return false;
    }
}

// Copy link to clipboard
export async function copyToClipboard(text: string): Promise<void> {
    await Clipboard.setStringAsync(text);
}

// Parse deep link URL
export function parseDeepLink(url: string): {
    type: DeepLinkType | null;
    params: Record<string, string>;
} {
    try {
        const parsed = Linking.parse(url);

        // Extract type and potential ID from path
        // Pattern: scheme://type/id or scheme://type?id=xxx
        const pathParts = (parsed.path || "").split("/").filter(Boolean);
        const type = pathParts[0] as DeepLinkType | undefined;

        // Extract query params and path params
        const params: Record<string, string> = {};

        // If we have an ID in the path (e.g. event/123), add it to params
        if (pathParts.length > 1) {
            params.id = pathParts[1];
            // Also store as type-specific ID for convenience
            if (type === "event") params.eventId = pathParts[1];
            if (type === "ticket") params.orderId = pathParts[1];
            if (type === "chat") params.eventId = pathParts[1]; // chat uses eventId
            if (type === "claim") params.token = pathParts[1];
        }

        if (parsed.queryParams) {
            Object.entries(parsed.queryParams).forEach(([key, value]) => {
                if (typeof value === "string") {
                    params[key] = value;
                }
            });
        }

        return {
            type: type || null,
            params,
        };
    } catch (error) {
        console.error("Error parsing deep link:", error);
        return { type: null, params: {} };
    }
}

// Handle incoming deep link
export function handleDeepLink(
    url: string,
    navigation: {
        navigate: (screen: string, params?: any) => void;
    }
): void {
    const { type, params } = parseDeepLink(url);

    switch (type) {
        case "event":
            if (params.id) {
                navigation.navigate("event/[id]", { id: params.id });
            }
            break;
        case "ticket":
            if (params.orderId || params.id) {
                navigation.navigate("ticket/[id]", { id: params.orderId || params.id });
            }
            break;
        case "transfer":
            if (params.code) {
                navigation.navigate("transfer", { code: params.code });
            }
            break;
        case "claim":
            // Handle claim links for shared tickets
            if (params.token || params.id) {
                navigation.navigate("claim/[token]", { token: params.token || params.id });
            }
            break;
        case "profile":
            if (params.userId) {
                navigation.navigate("profile", { userId: params.userId });
            }
            break;
        case "chat":
            if (params.eventId || params.id) {
                navigation.navigate("social/group/[eventId]", { eventId: params.eventId || params.id });
            }
            break;
        case "safety":
            navigation.navigate("safety");
            break;
        case "invite":
            // Handle invite with referral tracking
            if (params.ref) {
                // Store referral code for signup flow
                console.log("Referral code:", params.ref);
            }
            break;
        default:
            console.log("Unknown deep link type:", type);
    }
}

// Subscribe to incoming links
export function subscribeToDeepLinks(
    handler: (url: string) => void
): () => void {
    // Handle initial URL (app opened via link)
    Linking.getInitialURL().then((url) => {
        if (url) handler(url);
    });

    // Handle links while app is running
    const subscription = Linking.addEventListener("url", ({ url }) => {
        handler(url);
    });

    return () => subscription.remove();
}
