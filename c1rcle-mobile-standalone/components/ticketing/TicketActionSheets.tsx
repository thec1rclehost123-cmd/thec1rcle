/**
 * THE C1RCLE — Ticket Action Sheets (Anti-Gravity Style)
 * 
 * Premium bottom sheet modals for share & transfer actions.
 */

import { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Contacts from "expo-contacts";
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
} from "react-native-reanimated";

const ACCENT_COLOR = "#F44A22";

import { OrderTicket } from "@/store/ticketsStore";

// ============================================================================
// ACTION SHEET WRAPPER
// ============================================================================

interface ActionSheetProps {
    isVisible: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
}

export function ActionSheet({ isVisible, onClose, title, description, children }: ActionSheetProps) {
    if (!isVisible) return null;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
                style={styles.modalContainer}
            >
                {/* Backdrop */}
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    </Pressable>
                </Animated.View>

                {/* Sheet */}
                <Animated.View
                    entering={SlideInDown.duration(250)}
                    exiting={SlideOutDown.duration(200)}
                    style={styles.sheet}
                >
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <View style={styles.sheetHeaderContent}>
                            <Text style={styles.sheetTitle}>{title}</Text>
                            {description && (
                                <Text style={styles.sheetDescription}>{description}</Text>
                            )}
                        </View>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
                        </Pressable>
                    </View>

                    {/* Content */}
                    <View style={styles.sheetContent}>
                        {children}
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ============================================================================
// SHARE SHEET CONTENT
// ============================================================================

interface ShareSheetContentProps {
    onShare: (channel: string, tierId?: string, expiresAt?: string) => Promise<void>;
    tickets?: OrderTicket[];
    eventTitle?: string;
}

const SHARE_OPTIONS = [
    { id: "whatsapp", icon: "logo-whatsapp", color: "#25D366", label: "WhatsApp", gradient: ["#25D366", "#128C7E"] },
    { id: "instagram", icon: "logo-instagram", color: "#E1306C", label: "Instagram", gradient: ["#833AB4", "#C13584", "#E1306C", "#FD1D1D"] },
    { id: "sms", icon: "chatbubble", color: "#34C759", label: "Message", gradient: ["#34C759", "#28A745"] },
    { id: "email", icon: "mail", color: "#5856D6", label: "Email", gradient: ["#5856D6", "#4543C4"] },
    { id: "copy", icon: "copy", color: "#8E8E93", label: "Copy Link", gradient: ["#8E8E93", "#636366"] },
];

export function ShareSheetContent({ onShare, tickets, eventTitle }: ShareSheetContentProps) {
    const [loading, setLoading] = useState<string | null>(null); // storing loading channel id
    const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
    const [expiryMode, setExpiryMode] = useState<"24h" | "48h" | "event">("event");

    // Group available tickets by tier
    const tiers = (tickets || [])
        .filter(t => !t.isClaimed && t.tierId)
        .reduce((acc, t) => {
            const existing = acc.find(tier => tier.id === t.tierId);
            if (existing) {
                existing.count++;
            } else {
                acc.push({
                    id: t.tierId || "default",
                    name: t.name,
                    gender: t.requiredGender,
                    count: 1
                });
            }
            return acc;
        }, [] as { id: string; name: string; gender?: string; count: number }[]);

    // Auto-select if only one tier exists
    useEffect(() => {
        if (tiers.length === 1 && !selectedTierId) {
            setSelectedTierId(tiers[0].id);
        }
    }, [tiers.length, selectedTierId, tiers[0]?.id]);

    const selectedTier = tiers.find(t => t.id === selectedTierId);
    const activeGenderRestriction = selectedTier?.gender;

    const handleShareOption = async (channel: string) => {
        if (tiers.length > 0 && !selectedTierId) {
            Alert.alert("Select Ticket", "Please select which ticket type you want to share.");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(channel);

        // If single tier, ensure we pass that ID
        const effectiveTierId = selectedTierId || (tiers.length === 1 ? tiers[0].id : undefined);

        // Calculate actual date for expiry
        let expireDate: string | undefined;
        if (expiryMode === "24h") expireDate = new Date(Date.now() + 24 * 3600000).toISOString();
        else if (expiryMode === "48h") expireDate = new Date(Date.now() + 48 * 3600000).toISOString();
        // "event" means default behavior (event start)

        await onShare(channel, effectiveTierId, expireDate);
        setLoading(null);
    };

    return (
        <View>
            {/* Tier Selection */}
            {tiers.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sheetSubtitle}>Select Ticket Type</Text>
                    {tiers.map((tier) => (
                        <Pressable
                            key={tier.id}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedTierId(tier.id);
                            }}
                            style={[
                                styles.tierOption,
                                selectedTierId === tier.id && styles.tierOptionSelected
                            ]}
                        >
                            <View>
                                <Text style={[styles.tierName, selectedTierId === tier.id && { color: "#fff" }]}>
                                    {tier.name}
                                </Text>
                                {tier.gender && (
                                    <Text style={[styles.tierGender, selectedTierId === tier.id && { color: "rgba(255,255,255,0.7)" }]}>
                                        {tier.gender.toUpperCase()} Only
                                    </Text>
                                )}
                            </View>
                            <View style={styles.tierCount}>
                                <Text style={[styles.tierCountText, selectedTierId === tier.id && { color: "#fff" }]}>
                                    {tier.count} left
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
            )}

            {/* Expiry Selection */}
            <View style={{ marginBottom: 24 }}>
                <Text style={styles.sheetSubtitle}>Link Expiry</Text>
                <View style={styles.tabContainer}>
                    <Pressable
                        onPress={() => setExpiryMode("24h")}
                        style={[styles.tab, expiryMode === "24h" && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, expiryMode === "24h" && styles.tabTextActive]}>24 Hours</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setExpiryMode("48h")}
                        style={[styles.tab, expiryMode === "48h" && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, expiryMode === "48h" && styles.tabTextActive]}>48 Hours</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setExpiryMode("event")}
                        style={[styles.tab, expiryMode === "event" && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, expiryMode === "event" && styles.tabTextActive]}>Event Start</Text>
                    </Pressable>
                </View>
            </View>

            {/* Gender Warning */}
            {activeGenderRestriction && (
                <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={18} color="#FFB800" />
                    <Text style={styles.warningText}>
                        This ticket is for {activeGenderRestriction.toUpperCase()} only. The recipient must match this.
                    </Text>
                </View>
            )}

            {/* Share Options Grid */}
            <Text style={styles.sheetSubtitle}>Share via</Text>
            <View style={styles.shareGrid}>
                {SHARE_OPTIONS.map((option) => (
                    <Pressable
                        key={option.id}
                        onPress={() => handleShareOption(option.id)}
                        disabled={!!loading}
                        style={({ pressed }) => [
                            styles.shareOption,
                            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                            loading === option.id && { opacity: 0.5 }
                        ]}
                    >
                        <LinearGradient
                            colors={option.gradient as [string, string, ...string[]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.iconCircle}
                        >
                            {loading === option.id ? (
                                <View style={styles.loaderCircle} />
                            ) : (
                                <Ionicons name={option.icon as any} size={28} color="#fff" />
                            )}
                        </LinearGradient>
                        <Text style={styles.shareLabel}>{option.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

// ============================================================================
// TRANSFER SHEET CONTENT
// ============================================================================

interface TransferSheetContentProps {
    onTransferEmail: (email: string) => Promise<void>;
    onGenerateLink: () => Promise<void>;
    genderRestriction?: string;
}

export function TransferSheetContent({ onTransferEmail, onGenerateLink, genderRestriction }: TransferSheetContentProps) {
    const [contact, setContact] = useState("");
    const [loading, setLoading] = useState<"email" | "link" | null>(null);
    const [mode, setMode] = useState<"email" | "link">("email");

    const handleTransferEmail = async () => {
        if (!contact.trim() || !contact.includes("@")) {
            Alert.alert("Enter Email", "Please enter a valid email address for the recipient.");
            return;
        }

        Alert.alert(
            "Confirm Transfer",
            "This will permanently transfer ownership. You will lose access to this ticket. Continue?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Transfer",
                    style: "destructive",
                    onPress: async () => {
                        setLoading("email");
                        await onTransferEmail(contact.trim());
                        setLoading(null);
                    }
                }
            ]
        );
    };

    const handleLinkTransfer = async () => {
        Alert.alert(
            "Generate Transfer Link?",
            "Sharing this link allows anyone who clicks it to claim ownership of your ticket. Use this carefully.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Generate Link",
                    onPress: async () => {
                        setLoading("link");
                        await onGenerateLink();
                        setLoading(null);
                    }
                }
            ]
        );
    };

    return (
        <View>
            {/* Gender Warning */}
            {genderRestriction && (
                <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={18} color="#FFB800" />
                    <Text style={styles.warningText}>
                        This ticket is for {genderRestriction.toUpperCase()} only.
                    </Text>
                </View>
            )}

            {/* Mode Switcher */}
            <View style={styles.tabContainer}>
                <Pressable
                    onPress={() => setMode("email")}
                    style={[styles.tab, mode === "email" && styles.tabActive]}
                >
                    <Text style={[styles.tabText, mode === "email" && styles.tabTextActive]}>Email</Text>
                </Pressable>
                <Pressable
                    onPress={() => setMode("link")}
                    style={[styles.tab, mode === "link" && styles.tabActive]}
                >
                    <Text style={[styles.tabText, mode === "link" && styles.tabTextActive]}>Share Link</Text>
                </Pressable>
            </View>

            {mode === "email" ? (
                <View>
                    <View style={styles.infoBanner}>
                        <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.infoText}>
                            The recipient will receive an official email invitation to claim the ticket.
                        </Text>
                    </View>
                    <TextInput
                        style={[styles.textInput, { marginBottom: 16 }]}
                        placeholder="Recipient's email address"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={contact}
                        onChangeText={setContact}
                    />
                    <Pressable
                        onPress={handleTransferEmail}
                        disabled={!!loading}
                        style={[styles.dangerBtn, loading === "email" && { opacity: 0.6 }]}
                    >
                        <Text style={styles.dangerBtnText}>
                            {loading === "email" ? "Sending..." : "Send via Email"}
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <View>
                    <View style={styles.infoBanner}>
                        <Ionicons name="link-outline" size={18} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.infoText}>
                            Generate a unique link you can send on WhatsApp or any other messaging app.
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleLinkTransfer}
                        disabled={!!loading}
                        style={[styles.primaryBtn, loading === "link" && { opacity: 0.6 }]}
                    >
                        <LinearGradient
                            colors={["#F44A22", "#F44B22"]}
                            style={StyleSheet.absoluteFill}
                        />
                        <Text style={styles.primaryBtnText}>
                            {loading === "link" ? "Generating..." : "Generate & Copy Link"}
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#1A1A1A",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Platform.OS === "ios" ? 40 : 24,
        maxHeight: "80%",
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 2,
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 16,
    },
    sheetHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.1)",
    },
    sheetHeaderContent: {
        flex: 1,
        marginRight: 16,
    },
    sheetTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 4,
    },
    sheetDescription: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        lineHeight: 20,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
    },
    sheetContent: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },

    // Share Grid
    shareGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 20,
        justifyContent: "flex-start",
    },
    shareOption: {
        alignItems: "center",
        width: 70,
    },
    iconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    loaderCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#fff",
        opacity: 0.8,
    },
    shareLabel: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    },


    // Transfer Sheet Input/Buttons
    textInput: {
        height: 52,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 14,
        paddingHorizontal: 16,
        color: "#fff",
        fontSize: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    dangerBtn: {
        height: 56,
        borderRadius: 16,
        backgroundColor: "rgba(255, 59, 48, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(255, 59, 48, 0.3)",
        justifyContent: "center",
        alignItems: "center",
    },
    dangerBtnText: {
        color: "#FF3B30",
        fontSize: 17,
        fontWeight: "700",
    },
    primaryBtn: {
        height: 56,
        borderRadius: 16,
        backgroundColor: ACCENT_COLOR,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    primaryBtnText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    tabText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
        fontWeight: "600",
    },
    tabTextActive: {
        color: "#fff",
    },

    // Banners
    warningBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 184, 0, 0.1)",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        gap: 10,
    },
    warningText: {
        color: "#FFB800",
        fontSize: 14,
        fontWeight: "600",
        flex: 1,
    },
    infoBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        gap: 10,
    },
    infoText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 13,
        lineHeight: 19,
        flex: 1,
    },

    // Tier Selection
    sheetSubtitle: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 12,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    tierOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    tierOptionSelected: {
        borderColor: ACCENT_COLOR,
        backgroundColor: "rgba(244, 74, 34, 0.1)",
    },
    tierName: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 16,
        fontWeight: "600",
    },
    tierGender: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        marginTop: 2,
    },
    tierCount: {
        backgroundColor: "rgba(255,255,255,0.1)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    tierCountText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: "700",
    },
});
