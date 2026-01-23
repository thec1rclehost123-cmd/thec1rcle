import { Stack } from "expo-router";

export default function SocialLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#161616" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="group/[eventId]" />
            <Stack.Screen name="dm/[id]" />
            <Stack.Screen name="attendees" />
            <Stack.Screen name="report" options={{ presentation: "modal" }} />
            <Stack.Screen name="profile/[id]" />
            <Stack.Screen name="requests" />
            <Stack.Screen name="contacts" />
            <Stack.Screen name="gallery/[eventId]" />
        </Stack>
    );
}
