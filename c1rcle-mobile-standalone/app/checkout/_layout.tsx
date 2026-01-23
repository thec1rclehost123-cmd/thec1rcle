import { Stack } from "expo-router";

export default function CheckoutLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#0A0A0A" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="[eventId]" />
            <Stack.Screen
                name="success"
                options={{
                    gestureEnabled: false,
                    animation: "fade",
                }}
            />
        </Stack>
    );
}
