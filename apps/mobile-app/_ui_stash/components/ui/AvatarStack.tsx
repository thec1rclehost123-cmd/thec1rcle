import { ReactNode } from "react";
import { View, StyleSheet, Text } from "react-native";
import { colors, radii } from "@/lib/design/theme";
import { Avatar } from "./Primitives";

interface AvatarStackProps {
    users: { id: string; name: string; imageUrl?: string }[];
    max?: number;
    size?: number;
}

export function AvatarStack({ users, max = 3, size = 32 }: AvatarStackProps) {
    const displayUsers = users.slice(0, max);
    const remainingCount = Math.max(0, users.length - max);
    const overlap = size * 0.35;

    return (
        <View style={styles.container}>
            {displayUsers.map((user, index) => (
                <View
                    key={user.id}
                    style={[
                        styles.avatarWrapper,
                        {
                            marginLeft: index === 0 ? 0 : -overlap,
                            zIndex: displayUsers.length - index,
                        },
                    ]}
                >
                    <Avatar size={size} name={user.name} imageUrl={user.imageUrl} />
                </View>
            ))}
            
            {remainingCount > 0 && (
                <View
                    style={[
                        styles.remainingCircle,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            marginLeft: -overlap,
                            zIndex: 0,
                        },
                    ]}
                >
                    <Text style={[styles.remainingText, { fontSize: size * 0.35 }]}>
                        +{remainingCount}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarWrapper: {
        borderRadius: radii.pill,
        borderWidth: 2,
        borderColor: colors.base.DEFAULT,
        overflow: "hidden",
    },
    remainingCircle: {
        backgroundColor: colors.base[100],
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: colors.base.DEFAULT,
    },
    remainingText: {
        color: colors.goldMetallic,
        fontWeight: "600",
    },
});
