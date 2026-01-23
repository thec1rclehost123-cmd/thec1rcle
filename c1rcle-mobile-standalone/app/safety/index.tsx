import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import {
    triggerSOS,
    startLocationSharing,
    stopLocationSharing,
    getEmergencyContacts,
    saveEmergencyContacts,
    requestSafeRide,
    EmergencyContact,
} from "@/lib/safety";
import { useTicketsStore } from "@/store/ticketsStore";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/design/theme";

// Emergency contact form
function EmergencyContactForm({
    contacts,
    onSave
}: {
    contacts: EmergencyContact[];
    onSave: (contacts: EmergencyContact[]) => void;
}) {
    const [editedContacts, setEditedContacts] = useState(contacts);
    const [saving, setSaving] = useState(false);

    const addContact = () => {
        if (editedContacts.length >= 3) {
            Alert.alert("Limit Reached", "You can add up to 3 emergency contacts");
            return;
        }
        setEditedContacts([
            ...editedContacts,
            { id: `contact_${Date.now()}`, name: "", phone: "", relationship: "" }
        ]);
    };

    const updateContact = (index: number, field: keyof EmergencyContact, value: string) => {
        const updated = [...editedContacts];
        updated[index] = { ...updated[index], [field]: value };
        setEditedContacts(updated);
    };

    const removeContact = (index: number) => {
        setEditedContacts(editedContacts.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave(editedContacts.filter(c => c.name && c.phone));
        setSaving(false);
    };

    return (
        <View className="mb-6">
            {editedContacts.map((contact, index) => (
                <View key={contact.id} className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mb-3">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-gold font-semibold">Contact {index + 1}</Text>
                        <Pressable onPress={() => removeContact(index)}>
                            <Text className="text-red-400">Remove</Text>
                        </Pressable>
                    </View>

                    <TextInput
                        placeholder="Name"
                        placeholderTextColor="#666"
                        value={contact.name}
                        onChangeText={(v) => updateContact(index, "name", v)}
                        className="bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold mb-2"
                    />

                    <TextInput
                        placeholder="Phone Number"
                        placeholderTextColor="#666"
                        keyboardType="phone-pad"
                        value={contact.phone}
                        onChangeText={(v) => updateContact(index, "phone", v)}
                        className="bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold mb-2"
                    />

                    <TextInput
                        placeholder="Relationship (e.g., Mom, Friend)"
                        placeholderTextColor="#666"
                        value={contact.relationship}
                        onChangeText={(v) => updateContact(index, "relationship", v)}
                        className="bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold"
                    />
                </View>
            ))}

            <Pressable
                onPress={addContact}
                className="border border-dashed border-white/30 rounded-bubble py-4 items-center mb-4"
            >
                <Text className="text-gold-stone">+ Add Emergency Contact</Text>
            </Pressable>

            <Pressable
                onPress={handleSave}
                disabled={saving}
                className={`py-4 rounded-pill items-center ${saving ? "bg-iris/50" : "bg-iris"}`}
            >
                {saving ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text className="text-white font-semibold">Save Contacts</Text>
                )}
            </Pressable>
        </View>
    );
}

export default function SafetyScreen() {
    const { user } = useAuthStore();
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [locationSharing, setLocationSharing] = useState(false);
    const [locationSessionId, setLocationSessionId] = useState<string | null>(null);

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        if (!user?.uid) return;
        setLoading(true);
        const userContacts = await getEmergencyContacts(user.uid);
        setContacts(userContacts);
        setLoading(false);
    };

    const handleSaveContacts = async (newContacts: EmergencyContact[]) => {
        if (!user?.uid) return;
        const result = await saveEmergencyContacts(user.uid, newContacts);
        if (result.success) {
            setContacts(newContacts);
            Alert.alert("Saved", "Emergency contacts updated");
        } else {
            Alert.alert("Error", result.error || "Failed to save contacts");
        }
    };

    const handleSOS = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        Alert.alert(
            "Trigger SOS Alert?",
            "This will send your location and an emergency message to your contacts.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Send SOS",
                    style: "destructive",
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        const currentEventId = useTicketsStore.getState().getCurrentEventId();
                        const result = await triggerSOS(user?.uid || "", currentEventId || undefined);
                        if (!result.success) {
                            Alert.alert("Error", result.error || "Failed to send SOS");
                        }
                    }
                }
            ]
        );
    };

    const toggleLocationSharing = async () => {
        if (!user?.uid) return;

        if (locationSharing && locationSessionId) {
            // Stop sharing
            await stopLocationSharing(locationSessionId);
            setLocationSharing(false);
            setLocationSessionId(null);
        } else {
            // Start sharing
            const result = await startLocationSharing(user.uid);
            if (result.success) {
                setLocationSharing(true);
                setLocationSessionId(result.sessionId || null);
            } else {
                Alert.alert("Error", result.error || "Failed to start location sharing");
            }
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            {/* Header */}
            <View className="flex-row items-center px-4 py-4 border-b border-white/10">
                <Pressable onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color={colors.gold} />
                </Pressable>
                <Text className="text-gold font-satoshi-bold text-xl">Safety Features</Text>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* SOS Button */}
                <Pressable
                    onPress={handleSOS}
                    className="bg-red-600 rounded-bubble p-6 mb-6 items-center"
                >
                    <Ionicons name="alert-circle" size={48} color="white" style={{ marginBottom: 8 }} />
                    <Text className="text-white font-satoshi-bold text-xl">Emergency SOS</Text>
                    <Text className="text-white/80 text-sm text-center mt-1">
                        Alert your emergency contacts with your location
                    </Text>
                </Pressable>

                {/* Location Sharing */}
                <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mb-6">
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                            <Ionicons name="location" size={24} color={colors.gold} style={{ marginRight: 12 }} />
                            <View>
                                <Text className="text-gold font-semibold">Location Sharing</Text>
                                <Text className="text-gold-stone text-sm">
                                    {locationSharing ? "Sharing for 4 hours" : "Share with friends"}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={locationSharing}
                            onValueChange={toggleLocationSharing}
                            trackColor={{ false: "#333", true: "#F44A22" }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* Safe Ride Home */}
                <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mb-6">
                    <View className="flex-row items-center mb-3">
                        <Ionicons name="car" size={20} color={colors.gold} style={{ marginRight: 8 }} />
                        <Text className="text-gold font-semibold">Get Home Safely</Text>
                    </View>
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={() => requestSafeRide("uber")}
                            className="flex-1 bg-black border border-white/20 py-4 rounded-bubble items-center"
                        >
                            <Text className="text-white font-semibold">Uber</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => requestSafeRide("ola")}
                            className="flex-1 bg-[#45a049] py-4 rounded-bubble items-center"
                        >
                            <Text className="text-white font-semibold">Ola</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => requestSafeRide("rapido")}
                            className="flex-1 bg-[#F4C430] py-4 rounded-bubble items-center"
                        >
                            <Text className="text-black font-semibold">Rapido</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Emergency Contacts */}
                <View className="flex-row items-center mb-4">
                    <Ionicons name="people" size={20} color={colors.gold} style={{ marginRight: 8 }} />
                    <Text className="text-gold font-satoshi-bold text-lg">
                        Emergency Contacts
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#F44A22" />
                ) : (
                    <EmergencyContactForm contacts={contacts} onSave={handleSaveContacts} />
                )}

                {/* Safety Tips */}
                <View className="bg-surface rounded-bubble border border-white/10 p-4">
                    <View className="flex-row items-center mb-3">
                        <Ionicons name="bulb-outline" size={20} color={colors.gold} style={{ marginRight: 8 }} />
                        <Text className="text-gold font-semibold">Safety Tips</Text>
                    </View>
                    <Text className="text-gold-stone text-sm mb-2">
                        • Share your live location with a trusted friend
                    </Text>
                    <Text className="text-gold-stone text-sm mb-2">
                        • Set up a Party Buddy to check in regularly
                    </Text>
                    <Text className="text-gold-stone text-sm mb-2">
                        • Save at least one emergency contact
                    </Text>
                    <Text className="text-gold-stone text-sm">
                        • Book your ride home through the app
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
