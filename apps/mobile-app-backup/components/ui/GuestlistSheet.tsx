import { Modal, View, Text, Pressable, StyleSheet, ScrollView, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
const eventFont = {
    regular: "SatoshiRegular",
    medium: "SatoshiMedium",
    bold: "SatoshiBold",
    black: "SatoshiBlack",
};

interface GuestlistSheetProps {
    visible: boolean;
    onClose: () => void;
    users: any[];
}

const { width } = Dimensions.get("window");
const AVATAR_SIZE = (width - 64) / 3;

export function GuestlistSheet({ visible, onClose, users }: GuestlistSheetProps) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Guestlist</Text>
                        <Pressable onPress={onClose} hitSlop={16}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>
                    </View>
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    <ScrollView 
                        bounces={false} 
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.content}
                    >
                        {users.map((user, i) => (
                            <View key={user.userId || i} style={styles.avatarContainer}>
                                {user.photoURL ? (
                                    <Image source={{ uri: user.photoURL }} style={styles.avatar} contentFit="cover" />
                                ) : (
                                    <LinearGradient
                                        colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
                                        style={styles.avatar}
                                    >
                                        <Text style={styles.avatarFallback}>
                                            {(user.displayName?.[0] ?? "?").toUpperCase()}
                                        </Text>
                                    </LinearGradient>
                                )}
                                <View style={styles.heartIcon}>
                                    <Ionicons name="heart-outline" size={14} color="#fff" />
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#111111",
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    title: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 24,
    },
    handleContainer: {
        alignItems: "center",
        paddingVertical: 12,
    },
    handle: {
        width: 32,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    content: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 16,
        paddingBottom: 40,
        gap: 16,
    },
    avatarContainer: {
        position: "relative",
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
    },
    avatar: {
        width: "100%",
        height: "100%",
        borderRadius: AVATAR_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#222",
    },
    avatarFallback: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 32,
    },
    heartIcon: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: "#222",
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#111111",
    },
});
