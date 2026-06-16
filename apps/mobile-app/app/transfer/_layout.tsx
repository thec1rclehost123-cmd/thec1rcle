import { Stack } from "expo-router";

export default function TransferLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#161616" },
            }}
        >
            <Stack.Screen name="index" />
        </Stack>
    );
}
