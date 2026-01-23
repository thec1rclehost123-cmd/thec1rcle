// Apple Wallet / Google Wallet pass generation
import { Linking, Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export interface PassData {
    orderId: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    venueAddress?: string;
    ticketType: string;
    ticketCount: number;
    qrCodeData: string;
    organizerName?: string;
    coverImageUrl?: string;
}

// Generate Apple Wallet pass (.pkpass)
// Note: In production, this should be generated server-side with proper signing
export async function generateAppleWalletPass(passData: PassData): Promise<string | null> {
    if (Platform.OS !== "ios") {
        return null;
    }

    // In production, call your backend API to generate a signed .pkpass file
    // The backend needs Apple Wallet certificates to sign passes
    const apiUrl = `https://api.thec1rcle.com/passes/apple?orderId=${passData.orderId}`;

    // For now, show info about wallet integration
    Alert.alert(
        "Apple Wallet",
        "Apple Wallet passes require server-side generation with Apple certificates. This feature will be available soon!",
        [
            { text: "OK" },
            {
                text: "View Ticket Instead",
                onPress: () => {
                    // Navigate to ticket detail
                }
            }
        ]
    );

    return null;
}

// Generate Google Wallet pass
export async function generateGoogleWalletPass(passData: PassData): Promise<string | null> {
    if (Platform.OS !== "android") {
        return null;
    }

    // In production, call your backend API to generate a Google Wallet JWT
    // The backend signs the pass data with your Google Wallet credentials

    Alert.alert(
        "Google Wallet",
        "Google Wallet passes require server-side generation. This feature will be available soon!",
        [
            { text: "OK" },
            {
                text: "View Ticket Instead",
                onPress: () => {
                    // Navigate to ticket detail
                }
            }
        ]
    );

    return null;
}

// Add to wallet (platform-agnostic)
export async function addToWallet(passData: PassData): Promise<boolean> {
    try {
        if (Platform.OS === "ios") {
            const passUrl = await generateAppleWalletPass(passData);
            if (passUrl) {
                await Linking.openURL(passUrl);
                return true;
            }
        } else if (Platform.OS === "android") {
            const passUrl = await generateGoogleWalletPass(passData);
            if (passUrl) {
                await Linking.openURL(passUrl);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error("Error adding to wallet:", error);
        return false;
    }
}

// Check if wallet is available
export async function isWalletAvailable(): Promise<boolean> {
    if (Platform.OS === "ios") {
        // Check if Wallet app can be opened
        return await Linking.canOpenURL("wallet://");
    } else if (Platform.OS === "android") {
        // Check if Google Wallet is installed
        return await Linking.canOpenURL("https://pay.google.com/");
    }
    return false;
}

// Generate pass preview data for display
export function generatePassPreview(passData: PassData): {
    headerFields: Array<{ label: string; value: string }>;
    primaryFields: Array<{ label: string; value: string }>;
    secondaryFields: Array<{ label: string; value: string }>;
    auxiliaryFields: Array<{ label: string; value: string }>;
} {
    const eventDate = new Date(passData.eventDate);

    return {
        headerFields: [
            { label: "EVENT", value: passData.eventTitle },
        ],
        primaryFields: [
            {
                label: "DATE",
                value: eventDate.toLocaleDateString("en-IN", {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                })
            },
            { label: "TIME", value: passData.eventTime },
        ],
        secondaryFields: [
            { label: "VENUE", value: passData.venue },
            { label: "TICKET", value: passData.ticketType },
        ],
        auxiliaryFields: [
            { label: "QTY", value: passData.ticketCount.toString() },
            { label: "ORDER", value: passData.orderId.substring(0, 8).toUpperCase() },
        ],
    };
}

// Create a shareable ticket image (fallback for wallet)
export async function createTicketImage(passData: PassData): Promise<string | null> {
    // This would generate an image that can be saved/shared
    // Implementation would use canvas or a server-side image generation service

    return null;
}

// Save ticket to device (as PDF or image)
export async function saveTicket(
    passData: PassData,
    format: "pdf" | "image" = "pdf"
): Promise<boolean> {
    try {
        // In production, fetch the ticket PDF/image from your server
        const ticketUrl = `https://api.thec1rcle.com/tickets/${passData.orderId}/download?format=${format}`;

        Alert.alert(
            "Download Ticket",
            "Ticket download feature coming soon! Use the QR code in the app for now.",
            [{ text: "OK" }]
        );

        return false;
    } catch (error) {
        console.error("Error saving ticket:", error);
        return false;
    }
}

// Share ticket
export async function shareTicket(passData: PassData): Promise<boolean> {
    try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            Alert.alert("Error", "Sharing is not available on this device");
            return false;
        }

        // In production, generate and share the ticket file
        Alert.alert(
            "Share Ticket",
            "Ticket sharing feature coming soon!",
            [{ text: "OK" }]
        );

        return false;
    } catch (error) {
        console.error("Error sharing ticket:", error);
        return false;
    }
}
