/**
 * Settings Screen
 * Central hub for all personal, app, and safety controls
 */

import { useEffect } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { colors, radii } from "@/lib/design/theme";
import { trackScreen } from "@/lib/analytics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Settings MenuItem
function MenuItem({
    icon,
    label,
    sublabel,
    onPress,
    rightElement,
    danger = false,
    delay = 0,
}: {
    icon: string;
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
                <Text style={styles.menuItemIconText}>{icon}</Text>
            </View>
            <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>
                    {label}
                </Text>
                {sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
            </View>
            {rightElement || <Text style={styles.menuItemArrow}>›</Text>}
        </AnimatedPressable>
    );
}

// Toggle item
function ToggleItem({
    icon,
    label,
    sublabel,
    value,
    onValueChange,
    delay = 0,
}: {
    icon: string;
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
                <Text style={styles.menuItemIconText}>{icon}</Text>
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
    const { signOut } = useAuth();
    const insets = useSafeAreaInsets();
    const {
        notifications,
        privacy,
        appearance,
        syncing,
        lastSyncedAt,
        setNotificationSetting,
        setPrivacySetting,
        setAppearanceSetting,
    } = useSettings();

    useEffect(() => {
        trackScreen("Settings");
    }, []);

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
                        setPrivacySetting("dmPrivacy", "event");
                    },
                },
                {
                    text: "Only saved contacts",
                    onPress: () => {
                        setPrivacySetting("dmPrivacy", "contacts");
                    },
                },
                {
                    text: "No one",
                    onPress: () => {
                        setPrivacySetting("dmPrivacy", "none");
                    },
                },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const getDMPrivacyLabel = () => {
        switch (privacy.dmPrivacy) {
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
                    <Text style={styles.backIcon}>←</Text>
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <Text style={styles.headerSubtitle}>
                        {syncing
                            ? "Syncing preferences..."
                            : lastSyncedAt
                                ? `Synced ${lastSyncedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                                : "Preferences sync across your account"}
                    </Text>
                </View>
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
                        icon="👤"
                        label="Edit Profile"
                        sublabel="Photo, name, bio, city"
                        onPress={() => router.push("/profile/edit")}
                        delay={150}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="🔑"
                        label="Change Password"
                        onPress={() => Alert.alert("Coming Soon", "Password change will be available soon")}
                        delay={200}
                    />
                </View>

                {/* App Navigation */}
                <SectionHeader title="App Navigation" delay={225} />
                <View style={styles.section}>
                    <MenuItem
                        icon="✨"
                        label="Explore Events"
                        sublabel="Trending, soonest, and new drops"
                        onPress={() => router.push("/(tabs)/explore")}
                        delay={250}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="🎟️"
                        label="My Tickets"
                        sublabel="Upcoming passes and past bookings"
                        onPress={() => router.push("/(tabs)/tickets")}
                        delay={275}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="📍"
                        label="Browse Map"
                        sublabel="Open events by location"
                        onPress={() => router.push("/map")}
                        delay={300}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="🏟️"
                        label="Venue Guide"
                        sublabel="Jump into venue pages and neighborhoods"
                        onPress={() => router.push("/(tabs)/venues" as any)}
                        delay={325}
                    />
                </View>

                {/* Notifications Section */}
                <SectionHeader title="Notifications" delay={350} />
                <View style={styles.section}>
                    <ToggleItem
                        icon="🎟️"
                        label="Ticket Updates"
                        sublabel="Purchase confirmations, transfers"
                        value={notifications.tickets}
                        onValueChange={(val) => setNotificationSetting("tickets", val)}
                        delay={400}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        icon="⏰"
                        label="Event Reminders"
                        sublabel="Starting soon, changes"
                        value={notifications.events}
                        onValueChange={(val) => setNotificationSetting("events", val)}
                        delay={450}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        icon="💬"
                        label="Chat Activity"
                        sublabel="Messages in event chats"
                        value={notifications.chat}
                        onValueChange={(val) => setNotificationSetting("chat", val)}
                        delay={500}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        icon="📨"
                        label="DM Requests"
                        sublabel="New message requests"
                        value={notifications.dm}
                        onValueChange={(val) => setNotificationSetting("dm", val)}
                        delay={550}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        icon="📢"
                        label="Recommendations"
                        sublabel="Events you might like"
                        value={notifications.promo}
                        onValueChange={(val) => setNotificationSetting("promo", val)}
                        delay={600}
                    />
                </View>

                {/* Privacy & Safety Section */}
                <SectionHeader title="Privacy & Safety" delay={650} />
                <View style={styles.section}>
                    <MenuItem
                        icon="🚫"
                        label="Blocked Users"
                        sublabel="Manage blocked accounts"
                        onPress={() => Alert.alert("Coming Soon", "Blocked users will be available soon")}
                        delay={700}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="✉️"
                        label="Who Can DM Me"
                        sublabel={getDMPrivacyLabel()}
                        onPress={handleDMPrivacy}
                        delay={750}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="📍"
                        label="Location Sharing"
                        sublabel="Manage Party Buddy settings"
                        onPress={() => router.push("/safety")}
                        delay={800}
                    />
                </View>

                {/* Appearance Section */}
                <SectionHeader title="Appearance" delay={850} />
                <View style={styles.section}>
                    <MenuItem
                        icon="🌙"
                        label="Theme"
                        sublabel={appearance.theme === "dark" ? "Dark" : appearance.theme === "light" ? "Light" : "System"}
                        onPress={() => Alert.alert(
                            "Theme",
                            "Choose how THE C1RCLE should look.",
                            [
                                { text: "System", onPress: () => setAppearanceSetting("theme", "system") },
                                { text: "Dark", onPress: () => setAppearanceSetting("theme", "dark") },
                                { text: "Light", onPress: () => setAppearanceSetting("theme", "light") },
                                { text: "Cancel", style: "cancel" },
                            ]
                        )}
                        delay={900}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        icon="✨"
                        label="Reduce Motion"
                        sublabel="Minimize animations"
                        value={appearance.reduceMotion}
                        onValueChange={(val) => setAppearanceSetting("reduceMotion", val)}
                        delay={950}
                    />
                    <View style={styles.divider} />
                    <ToggleItem
                        icon="📳"
                        label="Haptic Feedback"
                        sublabel="Vibrations on actions"
                        value={appearance.haptics}
                        onValueChange={(val) => setAppearanceSetting("haptics", val)}
                        delay={1000}
                    />
                </View>

                {/* Legal & About Section */}
                <SectionHeader title="Legal & About" delay={1050} />
                <View style={styles.section}>
                    <MenuItem
                        icon="📜"
                        label="Terms of Service"
                        onPress={() => router.push("/legal/terms")}
                        delay={1100}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="🔐"
                        label="Privacy Policy"
                        onPress={() => router.push("/legal/privacy")}
                        delay={1150}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="💰"
                        label="Refund Policy"
                        onPress={() => router.push("/legal/refunds")}
                        delay={1200}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="👥"
                        label="Community Guidelines"
                        onPress={() => router.push("/legal/guidelines")}
                        delay={1250}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="🛡️"
                        label="Safety Policy"
                        onPress={() => router.push("/legal/safety")}
                        delay={1300}
                    />
                </View>

                {/* Support Section */}
                <SectionHeader title="Support" delay={1350} />
                <View style={styles.section}>
                    <MenuItem
                        icon="❓"
                        label="Help & FAQ"
                        onPress={() => openLink("https://thec1rcle.com/help")}
                        delay={1400}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="💬"
                        label="Contact Support"
                        sublabel="support@thec1rcle.com"
                        onPress={() => openLink("mailto:support@thec1rcle.com")}
                        delay={1450}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="🐛"
                        label="Report a Bug"
                        onPress={() => Alert.alert("Report Bug", "Send details to bugs@thec1rcle.com and we'll fix it!")}
                        delay={1500}
                    />
                </View>

                {/* Sign Out */}
                <View style={[styles.section, { marginTop: 24 }]}>
                    <MenuItem
                        icon="🚪"
                        label="Sign Out"
                        danger
                        onPress={handleLogout}
                        delay={1550}
                    />
                </View>

                {/* App Version */}
                <Animated.View entering={FadeIn.delay(1600)} style={styles.versionInfo}>
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
    headerCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
    },
    headerSubtitle: {
        color: colors.goldMetallic,
        fontSize: 11,
        marginTop: 2,
        textAlign: "center",
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
