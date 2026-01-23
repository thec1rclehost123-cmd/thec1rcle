// Saved Contacts Screen - Redesigned
import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Alert,
    StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { getSavedContacts } from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/design/theme";

// Contact card
function ContactCard({
    contact,
    onPress,
    index,
}: {
    contact: {
        contactUserId: string;
        contactName: string;
        contactAvatar?: string;
        eventTitle: string;
        savedAt: any;
    };
    onPress: () => void;
    index: number;
}) {
    const savedDate = contact.savedAt?.toDate?.()
        ? new Date(contact.savedAt.toDate()).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        })
        : "";

    const initials = contact.contactName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <Pressable
                onPress={onPress}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                }}
            >
                {/* Avatar */}
                {contact.contactAvatar ? (
                    <Image
                        source={{ uri: contact.contactAvatar }}
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            marginRight: 14,
                        }}
                        contentFit="cover"
                    />
                ) : (
                    <View
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: "rgba(139, 92, 246, 0.2)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <Text style={{ color: "#8B5CF6", fontSize: 14, fontWeight: "600" }}>{initials}</Text>
                    </View>
                )}

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>{contact.contactName}</Text>
                    <Text style={{ color: colors.goldMetallic, fontSize: 13, marginTop: 2 }}>
                        Met at {contact.eventTitle} • {savedDate}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.goldMetallic} />
            </Pressable>
        </Animated.View>
    );
}

export default function SavedContactsScreen() {
    const { user } = useAuthStore();
    const insets = useSafeAreaInsets();

    const [contacts, setContacts] = useState<
        Array<{
            contactUserId: string;
            contactName: string;
            contactAvatar?: string;
            eventTitle: string;
            savedAt: any;
        }>
    >([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadContacts();
    }, [user?.uid]);

    const loadContacts = async () => {
        if (!user?.uid) return;

        setLoading(true);
        const savedContacts = await getSavedContacts(user.uid);
        setContacts(savedContacts);
        setLoading(false);
    };

    const handleContactPress = (contact: (typeof contacts)[0]) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        Alert.alert(contact.contactName, `Met at ${contact.eventTitle}`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "View Profile",
                onPress: () =>
                    router.push({
                        pathname: "/social/profile/[id]",
                        params: { id: contact.contactUserId },
                    }),
            },
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <SafeAreaView edges={["top"]}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(255,255,255,0.06)",
                    }}
                >
                    <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>Saved Contacts</Text>
                        <Text style={{ color: colors.goldMetallic, fontSize: 13, marginTop: 2 }}>
                            {contacts.length} connection{contacts.length !== 1 ? "s" : ""}
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Info banner */}
                <View
                    style={{
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.06)",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 20,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                        <Ionicons name="bookmark-outline" size={18} color={colors.goldMetallic} style={{ marginRight: 10, marginTop: 1 }} />
                        <Text style={{ color: colors.goldMetallic, fontSize: 14, lineHeight: 20, flex: 1 }}>
                            Contacts you've saved from event chats. These connections persist even after the event chat
                            expires.
                        </Text>
                    </View>
                </View>

                {/* Loading */}
                {loading && (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={{ color: colors.goldMetallic, marginTop: 16 }}>Loading contacts...</Text>
                    </View>
                )}

                {/* Empty state */}
                {!loading && contacts.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <Ionicons name="person-add-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 18, marginBottom: 8 }}>
                            No Saved Contacts
                        </Text>
                        <Text style={{ color: colors.goldMetallic, textAlign: "center", paddingHorizontal: 24 }}>
                            When you connect with someone at an event, you can save them as a contact to stay in touch
                            after the event chat ends.
                        </Text>
                    </View>
                )}

                {/* Contacts list */}
                {!loading &&
                    contacts.map((contact, index) => (
                        <ContactCard
                            key={contact.contactUserId}
                            contact={contact}
                            onPress={() => handleContactPress(contact)}
                            index={index}
                        />
                    ))}
            </ScrollView>
        </View>
    );
}
