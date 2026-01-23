import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { getSavedContacts } from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

// Contact card
function ContactCard({
    contact,
    onPress,
    index
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
        ? new Date(contact.savedAt.toDate()).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
        })
        : "";

    return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <Pressable
                onPress={onPress}
                className="flex-row items-center bg-midnight-100 rounded-bubble p-4 mb-3 border border-white/10 active:bg-surface"
            >
                {/* Avatar */}
                <View className="w-12 h-12 rounded-full bg-surface items-center justify-center mr-4">
                    <Text className="text-2xl">👤</Text>
                </View>

                {/* Info */}
                <View className="flex-1">
                    <Text className="text-gold font-semibold">{contact.contactName}</Text>
                    <Text className="text-gold-stone text-sm">
                        Met at {contact.eventTitle} • {savedDate}
                    </Text>
                </View>

                <Text className="text-gold-stone">→</Text>
            </Pressable>
        </Animated.View>
    );
}

export default function SavedContactsScreen() {
    const { user } = useAuthStore();

    const [contacts, setContacts] = useState<Array<{
        contactUserId: string;
        contactName: string;
        contactAvatar?: string;
        eventTitle: string;
        savedAt: any;
    }>>([]);
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

    const handleContactPress = (contact: typeof contacts[0]) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        Alert.alert(
            contact.contactName,
            `Met at ${contact.eventTitle}`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "View Profile",
                    onPress: () => router.push({
                        pathname: "/social/profile/[id]",
                        params: { id: contact.contactUserId }
                    })
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            {/* Header */}
            <View className="flex-row items-center px-4 py-4 border-b border-white/10">
                <Pressable onPress={() => router.back()} className="mr-4">
                    <Text className="text-gold text-lg">← Back</Text>
                </Pressable>
                <View>
                    <Text className="text-gold font-satoshi-bold text-xl">Saved Contacts</Text>
                    <Text className="text-gold-stone text-sm">{contacts.length} connections</Text>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Info banner */}
                <View className="bg-surface border border-white/10 rounded-bubble p-4 mb-6">
                    <Text className="text-gold-stone text-sm">
                        💾 Contacts you've saved from event chats. These connections persist
                        even after the event chat expires.
                    </Text>
                </View>

                {/* Loading */}
                {loading && (
                    <View className="items-center py-20">
                        <ActivityIndicator size="large" color="#F44A22" />
                        <Text className="text-gold-stone mt-4">Loading contacts...</Text>
                    </View>
                )}

                {/* Empty state */}
                {!loading && contacts.length === 0 && (
                    <View className="items-center py-20">
                        <Text className="text-6xl mb-4">💾</Text>
                        <Text className="text-gold font-semibold text-lg mb-2">No Saved Contacts</Text>
                        <Text className="text-gold-stone text-center px-6">
                            When you connect with someone at an event, you can save them as a contact
                            to stay in touch after the event chat ends.
                        </Text>
                    </View>
                )}

                {/* Contacts list */}
                {!loading && contacts.map((contact, index) => (
                    <ContactCard
                        key={contact.contactUserId}
                        contact={contact}
                        onPress={() => handleContactPress(contact)}
                        index={index}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
