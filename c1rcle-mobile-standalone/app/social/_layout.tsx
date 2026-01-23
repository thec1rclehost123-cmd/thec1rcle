import { Stack } from "expo-router";

export default function SocialLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#0A0A0A" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen
                name="group/[eventId]"
                options={{
                    // Hide tab bar when in chat
                    presentation: "card",
                }}
            />
            <Stack.Screen
                name="dm/[id]"
                options={{
                    presentation: "card",
                }}
            />
            <Stack.Screen name="attendees" />
            <Stack.Screen name="report" options={{ presentation: "modal" }} />
            <Stack.Screen name="profile/[id]" />
            <Stack.Screen name="requests" />
            <Stack.Screen name="contacts" />
            <Stack.Screen name="gallery/[eventId]" />
        </Stack>
    );
}
