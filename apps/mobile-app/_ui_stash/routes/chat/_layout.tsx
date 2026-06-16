import { Stack } from "expo-router";

export default function ChatLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#161616" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
