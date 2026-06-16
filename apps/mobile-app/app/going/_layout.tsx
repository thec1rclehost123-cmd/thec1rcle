import { Stack } from "expo-router";
import { colors } from "@/lib/design/theme";

export default function GoingLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.base.DEFAULT },
                animation: "fade",
            }}
        />
    );
}
