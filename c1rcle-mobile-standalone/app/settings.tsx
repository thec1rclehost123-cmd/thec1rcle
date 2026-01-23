/**
 * Settings Screen
 * Central hub for all personal, app, and safety controls
 * TODO: Migrate to useSettingsStore for backend sync
 */

import { useState, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    Switch,
    StyleSheet,
    Alert,
    Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore } from "@/store/profileStore";
import { useAuth } from "@/hooks/useAuth";
import { colors, radii } from "@/lib/design/theme";
import { trackScreen } from "@/lib/analytics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Settings storage keys
const SETTINGS_KEYS = {
    NOTIFICATIONS_TICKETS: "@settings_notif_tickets",
    NOTIFICATIONS_EVENTS: "@settings_notif_events",
    NOTIFICATIONS_CHAT: "@settings_notif_chat",
    NOTIFICATIONS_DM: "@settings_notif_dm",
    NOTIFICATIONS_PROMO: "@settings_notif_promo",
    THEME: "@settings_theme",
    REDUCE_MOTION: "@settings_reduce_motion",
    HAPTICS: "@settings_haptics",
    DM_PRIVACY: "@settings_dm_privacy",
};

// Settings MenuItem
function MenuItem({
    iconName,
    label,
    sublabel,
    onPress,
    rightElement,
    danger = false,
    delay = 0,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    label: string;
    sublabel?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
    delay?: number;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(delay).springify()}
            onPressIn={() => {
                scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
                scale.value = withSpring(1, { damping: 15, stiffness: 400 });
            }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress?.();
            }}
            style={[animatedStyle, styles.menuItem]}
        >
            <View style={styles.menuItemIcon}>
                <Ionicons
                    name={iconName}
                    size={20}
                    color={danger ? "#FF3D71" : "rgba(255,255,255,0.7)"}
                />
            </View>
            <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>
                    {label}
                </Text>
                {sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
            </View>
            {rightElement || <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />}
        </AnimatedPressable>
    );
}

// Toggle item
function ToggleItem({
    iconName,
    label,
    sublabel,
    value,
    onValueChange,
    delay = 0,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    label: string;
    sublabel?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    delay?: number;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            style={styles.menuItem}
        >
            <View style={styles.menuItemIcon}>
                <Ionicons name={iconName} size={20} color="rgba(255,255,255,0.7)" />
            </View>
            <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>{label}</Text>
                {sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={(val) => {
                    Haptics.selectionAsync();
                    onValueChange(val);
                }}
                trackColor={{ false: colors.base[200], true: colors.iris }}
                thumbColor="#fff"
            />
        </Animated.View>
    );
}

// Section header
function SectionHeader({ title, delay = 0 }: { title: string; delay?: number }) {
    return (
        <Animated.Text
            entering={FadeIn.delay(delay)}
            style={styles.sectionHeader}
        >
            {title}
        </Animated.Text>
    );
}

export default function SettingsScreen() {
    const { user } = useAuthStore();
    const { signOut } = useAuth();
    const insets = useSafeAreaInsets();

    // Notification settings
    const [notifTickets, setNotifTickets] = useState(true);
    const [notifEvents, setNotifEvents] = useState(true);
    const [notifChat, setNotifChat] = useState(true);
    const [notifDM, setNotifDM] = useState(true);
    const [notifPromo, setNotifPromo] = useState(false);

    // Appearance settings
    const [theme, setTheme] = useState<"system" | "light" | "dark">("dark");
    const [reduceMotion, setReduceMotion] = useState(false);
    const [hapticsEnabled, setHapticsEnabled] = useState(true);

    // Privacy settings
    const [dmPrivacy, setDmPrivacy] = useState<"anyone" | "event" | "contacts" | "none">("event");
    const [showUpcoming, setShowUpcoming] = useState(true);
    const [showAttended, setShowAttended] = useState(true);
    const [showStats, setShowStats] = useState(true);
    const [isPrivate, setIsPrivate] = useState(false);

    // Social handles
    const [igHandle, setIgHandle] = useState("");
    const [snapHandle, setSnapHandle] = useState("");

    useEffect(() => {
        trackScreen("Settings");
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const storedNotifTickets = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIFICATIONS_TICKETS);
            const storedNotifEvents = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIFICATIONS_EVENTS);
            const storedNotifChat = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIFICATIONS_CHAT);
            const storedNotifDM = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIFICATIONS_DM);
            const storedNotifPromo = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIFICATIONS_PROMO);
            const storedTheme = await AsyncStorage.getItem(SETTINGS_KEYS.THEME);
            const storedReduceMotion = await AsyncStorage.getItem(SETTINGS_KEYS.REDUCE_MOTION);
            const storedHaptics = await AsyncStorage.getItem(SETTINGS_KEYS.HAPTICS);
            const storedDmPrivacy = await AsyncStorage.getItem(SETTINGS_KEYS.DM_PRIVACY);

            if (storedNotifTickets !== null) setNotifTickets(storedNotifTickets === "true");
            if (storedNotifEvents !== null) setNotifEvents(storedNotifEvents === "true");
            if (storedNotifChat !== null) setNotifChat(storedNotifChat === "true");
            if (storedNotifDM !== null) setNotifDM(storedNotifDM === "true");
            if (storedNotifPromo !== null) setNotifPromo(storedNotifPromo === "true");
            if (storedTheme) setTheme(storedTheme as any);
            if (storedReduceMotion !== null) setReduceMotion(storedReduceMotion === "true");
            if (storedHaptics !== null) setHapticsEnabled(storedHaptics === "true");
            if (storedDmPrivacy) setDmPrivacy(storedDmPrivacy as any);

            // Sync with profile store
            const { profile } = useProfileStore.getState();
            if (profile) {
                setIgHandle(profile.instagram || "");
                setSnapHandle(profile.snapchat || "");
                if (profile.privacy) {
                    setShowUpcoming(profile.privacy.showUpcomingEvents);
                    setShowAttended(profile.privacy.showAttendedEvents);
                    setShowStats(profile.privacy.showStats);
                    setIsPrivate(profile.privacy.isPrivateProfile);
                }
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    };

    const saveSetting = async (key: string, value: string) => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (error) {
            console.error("Failed to save setting:", error);
        }
    };

    const updateProfileSetting = async (updates: any) => {
        const { profile, updateProfile } = useProfileStore.getState();
        if (profile) {
            await updateProfile(profile.uid, updates);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        await signOut();
                        router.replace("/(auth)/login");
                    },
                },
            ]
        );
    };

    const handleDMPrivacy = () => {
        Alert.alert(
            "Who can DM you?",
            "Control who can send you direct messages",
            [
                {
                    text: "Anyone in same event",
                    onPress: () => {
                        setDmPrivacy("event");
                        saveSetting(SETTINGS_KEYS.DM_PRIVACY, "event");
                    },
                },
                {
                    text: "Only saved contacts",
                    onPress: () => {
                        setDmPrivacy("contacts");
                        saveSetting(SETTINGS_KEYS.DM_PRIVACY, "contacts");
                    },
                },
                {
                    text: "No one",
                    onPress: () => {
                        setDmPrivacy("none");
                        saveSetting(SETTINGS_KEYS.DM_PRIVACY, "none");
                    },
                },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const getDMPrivacyLabel = () => {
        switch (dmPrivacy) {
            case "event": return "Same event attendees";
            case "contacts": return "Saved contacts only";
            case "none": return "No one";
            default: return "Anyone";
        }
    };

    const openLink = (url: string) => {
        Linking.openURL(url);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Account Section */}
                <SectionHeader title="Account" delay={100} />
                <View style={styles.section}>
                    <MenuItem
                        iconName="person-outline"
                        label="Edit Profile"
                        sublabel="Photo, name, bio, city"
                        onPress={() => router.push("/profile/edit")}
                        delay={150}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="key-outline"
                        label="Change Password"
                        onPress={() => Alert.alert("Coming Soon", "Password change will be available soon")}
                        delay={200}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="people-outline"
                        label="Add Friends"
                        sublabel="Sync contacts, find friends"
                        onPress={() => router.push("/social/contacts")}
                        delay={250}
                    />
                </View>

                {/* Social Connections */}
                <SectionHeader title="Social Connections" delay={220} />
                <View style={styles.section}>
                    <MenuItem
                        iconName="camera-outline"
                        label="Instagram"
                        sublabel={igHandle ? `@${igHandle}` : "Connect your Instagram"}
                        onPress={() => {
                            Alert.prompt(
                                "Instagram Handle",
                                "Enter your Instagram username (without @)",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Save",
                                        onPress: (val?: string) => {
                                            if (val !== undefined) {
                                                setIgHandle(val);
                                                updateProfileSetting({ instagram: val });
                                            }
                                        }
                                    }
                                ],
                                "plain-text",
                                igHandle
                            );
                        }}
                        delay={230}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="eye-off-outline"
                        label="Snapchat"
                        sublabel={snapHandle ? snapHandle : "Connect your Snapchat"}
                        onPress={() => {
                            Alert.prompt(
                                "Snapchat Username",
                                "Enter your Snapchat username",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Save",
                                        onPress: (val?: string) => {
                                            if (val !== undefined) {
                                                setSnapHandle(val);
                                                updateProfileSetting({ snapchat: val });
                                            }
                                        }
                                    }
                                ],
                                "plain-text",
                                snapHandle
                            );
                        }}
                        delay={240}
                    />
                </View>

                {/* Notifications Section */}
                <SectionHeader title="Notifications" delay={250} />
                <View style={styles.section}>
                    <ToggleItem
                        iconName="ticket-outline"
                        label="Ticket Updates"
                        sublabel="Purchase confirmations, transfers"
                        value={notifTickets}
                        onValueChange={(val) => {
                            setNotifTickets(val);
                            saveSetting(SETTINGS_KEYS.NOTIFICATIONS_TICKETS, val.toString());
                        }}
                        delay={300}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="time-outline"
                        label="Event Reminders"
                        sublabel="Starting soon, changes"
                        value={notifEvents}
                        onValueChange={(val) => {
                            setNotifEvents(val);
                            saveSetting(SETTINGS_KEYS.NOTIFICATIONS_EVENTS, val.toString());
                        }}
                        delay={350}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="chatbubbles-outline"
                        label="Chat Activity"
                        sublabel="Messages in event chats"
                        value={notifChat}
                        onValueChange={(val) => {
                            setNotifChat(val);
                            saveSetting(SETTINGS_KEYS.NOTIFICATIONS_CHAT, val.toString());
                        }}
                        delay={400}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="mail-outline"
                        label="DM Requests"
                        sublabel="New message requests"
                        value={notifDM}
                        onValueChange={(val) => {
                            setNotifDM(val);
                            saveSetting(SETTINGS_KEYS.NOTIFICATIONS_DM, val.toString());
                        }}
                        delay={450}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="notifications-outline"
                        label="Recommendations"
                        sublabel="Events you might like"
                        value={notifPromo}
                        onValueChange={(val) => {
                            setNotifPromo(val);
                            saveSetting(SETTINGS_KEYS.NOTIFICATIONS_PROMO, val.toString());
                        }}
                        delay={500}
                    />
                </View>

                {/* Privacy & Safety Section */}
                <SectionHeader title="Privacy & Safety" delay={550} />
                <View style={styles.section}>
                    <MenuItem
                        iconName="remove-circle-outline"
                        label="Blocked Users"
                        sublabel="Manage blocked accounts"
                        onPress={() => Alert.alert("Coming Soon", "Blocked users will be available soon")}
                        delay={600}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="mail-outline"
                        label="Who Can DM Me"
                        sublabel={getDMPrivacyLabel()}
                        onPress={handleDMPrivacy}
                        delay={650}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="location-outline"
                        label="Location Sharing"
                        sublabel="Manage Party Buddy settings"
                        onPress={() => router.push("/safety")}
                        delay={700}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="lock-closed-outline"
                        label="Private Profile"
                        sublabel="Only friends can see your details"
                        value={isPrivate}
                        onValueChange={(val) => {
                            setIsPrivate(val);
                            updateProfileSetting({ privacy: { ...useProfileStore.getState().profile?.privacy, isPrivateProfile: val } });
                        }}
                        delay={720}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="calendar-outline"
                        label="Show Upcoming Events"
                        value={showUpcoming}
                        onValueChange={(val) => {
                            setShowUpcoming(val);
                            updateProfileSetting({ privacy: { ...useProfileStore.getState().profile?.privacy, showUpcomingEvents: val } });
                        }}
                        delay={740}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="checkmark-circle-outline"
                        label="Show Attended Events"
                        value={showAttended}
                        onValueChange={(val) => {
                            setShowAttended(val);
                            updateProfileSetting({ privacy: { ...useProfileStore.getState().profile?.privacy, showAttendedEvents: val } });
                        }}
                        delay={760}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="analytics-outline"
                        label="Show Profile Stats"
                        value={showStats}
                        onValueChange={(val) => {
                            setShowStats(val);
                            updateProfileSetting({ privacy: { ...useProfileStore.getState().profile?.privacy, showStats: val } });
                        }}
                        delay={780}
                    />
                </View>

                {/* Appearance Section */}
                <SectionHeader title="Appearance" delay={750} />
                <View style={styles.section}>
                    <MenuItem
                        iconName="moon-outline"
                        label="Theme"
                        sublabel="Dark (default)"
                        onPress={() => Alert.alert("Theme", "Dark theme is the default. Light theme coming soon!")}
                        delay={800}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="sparkles-outline"
                        label="Reduce Motion"
                        sublabel="Minimize animations"
                        value={reduceMotion}
                        onValueChange={(val) => {
                            setReduceMotion(val);
                            saveSetting(SETTINGS_KEYS.REDUCE_MOTION, val.toString());
                        }}
                        delay={850}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        iconName="pulse"
                        label="Haptic Feedback"
                        sublabel="Vibrations on actions"
                        value={hapticsEnabled}
                        onValueChange={(val) => {
                            setHapticsEnabled(val);
                            saveSetting(SETTINGS_KEYS.HAPTICS, val.toString());
                        }}
                        delay={900}
                    />
                </View>

                {/* Legal & About Section */}
                <SectionHeader title="Legal & About" delay={950} />
                <View style={styles.section}>
                    <MenuItem
                        iconName="document-text-outline"
                        label="Terms of Service"
                        onPress={() => router.push("/legal/terms")}
                        delay={1000}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="shield-checkmark-outline"
                        label="Privacy Policy"
                        onPress={() => router.push("/legal/privacy")}
                        delay={1050}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="card-outline"
                        label="Refund Policy"
                        onPress={() => router.push("/legal/refunds")}
                        delay={1100}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="people-outline"
                        label="Community Guidelines"
                        onPress={() => router.push("/legal/guidelines")}
                        delay={1150}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="shield-outline"
                        label="Safety Policy"
                        onPress={() => router.push("/legal/safety")}
                        delay={1200}
                    />
                </View>

                {/* Support Section */}
                <SectionHeader title="Support" delay={1250} />
                <View style={styles.section}>
                    <MenuItem
                        iconName="help-circle-outline"
                        label="Help & FAQ"
                        onPress={() => openLink("https://thec1rcle.com/help")}
                        delay={1300}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="chatbubble-outline"
                        label="Contact Support"
                        sublabel="support@thec1rcle.com"
                        onPress={() => openLink("mailto:support@thec1rcle.com")}
                        delay={1350}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        iconName="bug-outline"
                        label="Report a Bug"
                        onPress={() => Alert.alert("Report Bug", "Send details to bugs@thec1rcle.com and we'll fix it!")}
                        delay={1400}
                    />
                </View>

                {/* Sign Out */}
                <View style={[styles.section, { marginTop: 24 }]}>
                    <MenuItem
                        iconName="log-out-outline"
                        label="Sign Out"
                        danger
                        onPress={handleLogout}
                        delay={1450}
                    />
                </View>

                {/* App Version */}
                <Animated.View entering={FadeIn.delay(1500)} style={styles.versionInfo}>
                    <LinearGradient
                        colors={["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"]}
                        style={styles.versionLogo}
                    >
                        <Text style={styles.versionLogoText}>C1</Text>
                    </LinearGradient>
                    <Text style={styles.versionText}>THE C1RCLE</Text>
                    <Text style={styles.versionNumber}>v1.0.0 (build 1)</Text>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.base[50],
        alignItems: "center",
        justifyContent: "center",
    },
    backIcon: {
        color: colors.gold,
        fontSize: 20,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginTop: 24,
        marginBottom: 12,
    },
    section: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
        overflow: "hidden",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    menuItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    menuItemIconText: {
        fontSize: 18,
    },
    menuItemContent: {
        flex: 1,
    },
    menuItemLabel: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "500",
    },
    menuItemLabelDanger: {
        color: colors.error,
    },
    menuItemSublabel: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginTop: 2,
    },
    menuItemArrow: {
        color: colors.goldMetallic,
        fontSize: 22,
        fontWeight: "300",
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        marginLeft: 70,
    },
    versionInfo: {
        alignItems: "center",
        paddingVertical: 32,
    },
    versionLogo: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    versionLogoText: {
        color: colors.iris,
        fontSize: 18,
        fontWeight: "800",
    },
    versionText: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 4,
    },
    versionNumber: {
        color: colors.goldMetallic,
        fontSize: 12,
        opacity: 0.7,
    },
});
