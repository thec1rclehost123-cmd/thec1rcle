import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@/lib/design/theme";

/**
 * Compatibility route for legacy/universal links:
 * `/going/[orderId]` → redirects to the dedicated ticket detail screen.
 */
export default function GoingRedirect() {
    const { orderId } = useLocalSearchParams<{ orderId?: string }>();

    useEffect(() => {
        if (!orderId) return;
        router.replace({
            pathname: "/ticket/[id]",
            params: { id: orderId },
        } as any);
    }, [orderId]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.base.DEFAULT, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.iris} />
        </View>
    );
}
