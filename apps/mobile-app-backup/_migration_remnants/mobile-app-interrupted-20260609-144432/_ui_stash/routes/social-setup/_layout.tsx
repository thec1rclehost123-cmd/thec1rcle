import { Stack } from "expo-router";

export default function SocialSetupLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#161616" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="photos" />
            <Stack.Screen name="preferences" />
            <Stack.Screen name="review" />
        </Stack>
    );
}
