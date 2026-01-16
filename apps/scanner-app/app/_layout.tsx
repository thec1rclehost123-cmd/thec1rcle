import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { EventProvider } from "@/store/eventContext";
import "../global.css";

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <EventProvider>
                <View className="flex-1 bg-background-primary">
                    <StatusBar style="light" backgroundColor="#0A0A0B" />
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: "#0A0A0B" },
                            animation: "fade",
                        }}
                    >
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(event)" />
                    </Stack>
                </View>
            </EventProvider>
        </SafeAreaProvider>
    );
}
