import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function NotFoundScreen() {
    return (
        <SafeAreaView className="flex-1 bg-background-primary items-center justify-center px-6">
            <Stack.Screen options={{ title: "Oops!" }} />

            <Ionicons name="alert-circle-outline" size={64} color="#71717A" />

            <Text className="text-text-primary text-2xl font-bold mt-4 text-center">
                Screen Not Found
            </Text>

            <Text className="text-text-secondary text-center mt-2 mb-8">
                The page you're looking for doesn't exist.
            </Text>

            <Link href="/" className="bg-accent px-8 py-4 rounded-xl">
                <Text className="text-white font-bold text-lg">Go Home</Text>
            </Link>
        </SafeAreaView>
    );
}
