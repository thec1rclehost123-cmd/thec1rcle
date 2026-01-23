import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    Alert,
    ActivityIndicator,
    Switch,
    StyleSheet,
    Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { useTicketsStore } from "@/store/ticketsStore";
import { registerPushToken } from "@/lib/notifications";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Premium Menu Item
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

    const handlePressIn = () => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify().damping(15)}
            style={animatedStyle}
        >
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={styles.menuItem}
            >
                <View style={styles.menuItemIcon}>
                    <Text style={styles.menuItemIconText}>{icon}</Text>
                </View>
                <View style={styles.menuItemContent}>
                    <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>
                        {label}
                    </Text>
                    {sublabel && (
                        <Text style={styles.menuItemSublabel}>{sublabel}</Text>
                    )}
                </View>
                {rightElement || (
                    <Text style={styles.menuItemArrow}>›</Text>
                )}
            </Pressable>
        </Animated.View>
    );
}

// Stats Card
function StatsCard({
    value,
    label,
    accent = false,
    delay = 0,
}: {
    value: number;
    label: string;
    accent?: boolean;
    delay?: number;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            style={styles.statCard}
        >
            <Text style={[styles.statValue, accent && styles.statValueAccent]}>
                {value}
            </Text>
            <Text style={styles.statLabel}>{label}</Text>
        </Animated.View>
    );
}

// Section Header
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

export default function ProfileScreen() {
    const { user } = useAuthStore();
    const { signOut, loading: authLoading } = useAuth();
    const { orders, fetchUserOrders } = useTicketsStore();
    const insets = useSafeAreaInsets();

    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [loadingNotifs, setLoadingNotifs] = useState(false);

    // Avatar animation
    const avatarScale = useSharedValue(1);
    const avatarGlow = useSharedValue(0);

    useEffect(() => {
        if (user?.uid) {
            fetchUserOrders(user.uid);
        }

        // Subtle pulse animation for avatar
        avatarGlow.value = withRepeat(
            withTiming(1, { duration: 2000 }),
            -1,
            true
        );
    }, [user?.uid]);

    const avatarAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: avatarScale.value }],
    }));

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
                    }
                }
            ]
        );
    };

    const toggleNotifications = async () => {
        if (!user?.uid) return;

        setLoadingNotifs(true);
        const success = await registerPushToken(user.uid);
        setNotificationsEnabled(success);
        setLoadingNotifs(false);

        if (!success) {
            Alert.alert(
                "Notifications Disabled",
                "Enable notifications in your device settings to receive event reminders"
            );
        }
    };

    // Stats
    const upcomingEvents = orders.filter(o =>
        o.eventDate && new Date(o.eventDate) > new Date()
    ).length;
    const totalEvents = orders.length;

    // Get initials
    const initials = user?.displayName
        ? user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : "?";

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Background gradient */}
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.15)", "transparent"]}
                style={styles.backgroundGradient}
            />

            {/* Top Actions */}
            <Animated.View
                entering={FadeIn}
                style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 8,
                    gap: 8,
                }}
            >
                <NotificationBell variant="solid" />
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push("/settings");
                    }}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.base[50],
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text style={{ fontSize: 20 }}>⚙️</Text>
                </Pressable>
            </Animated.View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* Profile Header */}
                <Animated.View
                    entering={FadeInDown.delay(100).springify()}
                    style={styles.profileHeader}
                >
                    {/* Avatar */}
                    <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.avatarGradient}
                        >
                            <View style={styles.avatarInner}>
                                <Text style={styles.avatarText}>{initials}</Text>
                            </View>
                        </LinearGradient>

                        {/* Edit badge */}
                        <Pressable style={styles.avatarEditBadge}>
                            <Text style={styles.avatarEditIcon}>✏️</Text>
                        </Pressable>
                    </Animated.View>

                    {/* User Info */}
                    <Text style={styles.userName}>
                        {user?.displayName || "Party Enthusiast"}
                    </Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>

                    {/* Member badge */}
                    <View style={styles.memberBadge}>
                        <LinearGradient
                            colors={["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"]}
                            style={styles.memberBadgeGradient}
                        >
                            <Text style={styles.memberBadgeText}>✨ C1RCLE MEMBER</Text>
                        </LinearGradient>
                    </View>
                </Animated.View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <StatsCard value={upcomingEvents} label="Upcoming" accent delay={200} />
                    <View style={styles.statsDivider} />
                    <StatsCard value={totalEvents} label="Total Events" delay={250} />
                    <View style={styles.statsDivider} />
                    <StatsCard value={0} label="Friends" delay={300} />
                </View>

                {/* Menu Sections */}
                <View style={styles.menuContainer}>
                    {/* Safety Section */}
                    <SectionHeader title="Safety" delay={350} />
                    <View style={styles.menuSection}>
                        <MenuItem
                            icon="🆘"
                            label="Safety Features"
                            sublabel="SOS, location sharing, emergency contacts"
                            onPress={() => router.push("/safety")}
                            delay={400}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="🔒"
                            label="Privacy Settings"
                            sublabel="Control who can see your profile"
                            onPress={() => Alert.alert("Coming Soon", "Privacy settings will be available soon")}
                            delay={450}
                        />
                    </View>

                    {/* Tickets Section */}
                    <SectionHeader title="Tickets" delay={500} />
                    <View style={styles.menuSection}>
                        <MenuItem
                            icon="🎟️"
                            label="My Tickets"
                            sublabel={`${upcomingEvents} upcoming event${upcomingEvents !== 1 ? 's' : ''}`}
                            onPress={() => router.push("/(tabs)/tickets")}
                            delay={550}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="↗️"
                            label="Transfer Ticket"
                            sublabel="Send a ticket to a friend"
                            onPress={() => router.push("/transfer")}
                            delay={600}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="📜"
                            label="Order History"
                            sublabel="View all past purchases"
                            onPress={() => router.push("/(tabs)/tickets")}
                            delay={650}
                        />
                    </View>

                    {/* Settings Section */}
                    <SectionHeader title="Settings" delay={700} />
                    <View style={styles.menuSection}>
                        <MenuItem
                            icon="🔔"
                            label="Notifications"
                            sublabel="Event reminders and updates"
                            delay={750}
                            rightElement={
                                loadingNotifs ? (
                                    <ActivityIndicator size="small" color={colors.iris} />
                                ) : (
                                    <Switch
                                        value={notificationsEnabled}
                                        onValueChange={toggleNotifications}
                                        trackColor={{ false: colors.base[200], true: colors.iris }}
                                        thumbColor="#fff"
                                    />
                                )
                            }
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="💳"
                            label="Payment Methods"
                            sublabel="Manage your cards"
                            onPress={() => Alert.alert("Coming Soon", "Payment methods will be available soon")}
                            delay={800}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="✉️"
                            label="Email Preferences"
                            sublabel="Manage email notifications"
                            onPress={() => Alert.alert("Coming Soon", "Email preferences will be available soon")}
                            delay={850}
                        />
                    </View>

                    {/* Support Section */}
                    <SectionHeader title="Support" delay={900} />
                    <View style={styles.menuSection}>
                        <MenuItem
                            icon="❓"
                            label="Help & FAQ"
                            onPress={() => Alert.alert("Help", "Contact us at support@thec1rcle.com")}
                            delay={950}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="💬"
                            label="Contact Support"
                            onPress={() => Alert.alert("Support", "Email: support@thec1rcle.com\nWhatsApp: +91 98765 43210")}
                            delay={1000}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="📝"
                            label="Terms of Service"
                            onPress={() => Alert.alert("Terms", "View our terms at thec1rcle.com/terms")}
                            delay={1050}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="🔐"
                            label="Privacy Policy"
                            onPress={() => Alert.alert("Privacy", "View our privacy policy at thec1rcle.com/privacy")}
                            delay={1100}
                        />
                    </View>

                    {/* Account Section */}
                    <SectionHeader title="Account" delay={1150} />
                    <View style={styles.menuSection}>
                        <MenuItem
                            icon="🚪"
                            label="Sign Out"
                            danger
                            onPress={handleLogout}
                            delay={1200}
                            rightElement={
                                authLoading ? (
                                    <ActivityIndicator size="small" color={colors.error} />
                                ) : (
                                    <Text style={[styles.menuItemArrow, styles.menuItemArrowDanger]}>›</Text>
                                )
                            }
                        />
                    </View>

                    {/* App Version */}
                    <Animated.View
                        entering={FadeIn.delay(1250)}
                        style={styles.footer}
                    >
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.footerLogo}
                        >
                            <Text style={styles.footerLogoText}>C1</Text>
                        </LinearGradient>
                        <Text style={styles.footerText}>
                            THE C1RCLE v1.0.0
                        </Text>
                        <Text style={styles.footerSubtext}>
                            Made with ♡ in India
                        </Text>
                    </Animated.View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    backgroundGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 300,
    },
    scrollView: {
        flex: 1,
    },

    // Profile Header
    profileHeader: {
        alignItems: "center",
        paddingTop: 24,
        paddingBottom: 24,
        paddingHorizontal: 20,
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatarGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
    },
    avatarInner: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
        borderRadius: 47,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: colors.iris,
        fontSize: 36,
        fontWeight: "800",
    },
    avatarEditBadge: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.base[50],
        borderWidth: 3,
        borderColor: colors.base.DEFAULT,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarEditIcon: {
        fontSize: 14,
    },
    userName: {
        color: colors.gold,
        fontSize: 26,
        fontWeight: "800",
        marginBottom: 4,
    },
    userEmail: {
        color: colors.goldMetallic,
        fontSize: 15,
        marginBottom: 16,
    },
    memberBadge: {},
    memberBadgeGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
    memberBadgeText: {
        color: colors.iris,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1,
    },

    // Stats
    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        marginHorizontal: 20,
        borderRadius: radii.xl,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    statCard: {
        flex: 1,
        alignItems: "center",
    },
    statValue: {
        color: colors.gold,
        fontSize: 28,
        fontWeight: "800",
        marginBottom: 4,
    },
    statValueAccent: {
        color: colors.iris,
    },
    statLabel: {
        color: colors.goldMetallic,
        fontSize: 12,
    },
    statsDivider: {
        width: 1,
        height: 40,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
    },

    // Menu
    menuContainer: {
        paddingHorizontal: 20,
    },
    sectionHeader: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 12,
        marginTop: 8,
    },
    menuSection: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        marginBottom: 20,
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
        fontSize: 24,
        fontWeight: "300",
    },
    menuItemArrowDanger: {
        color: colors.error,
    },
    menuDivider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        marginLeft: 70,
    },

    // Footer
    footer: {
        alignItems: "center",
        paddingTop: 24,
        paddingBottom: 16,
    },
    footerLogo: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    footerLogoText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },
    footerText: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginBottom: 4,
    },
    footerSubtext: {
        color: colors.goldMetallic,
        fontSize: 12,
        opacity: 0.6,
    },
});
