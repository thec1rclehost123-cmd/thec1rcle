import { Stack } from "expo-router";

export default function CheckoutLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#161616" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="index" />
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
