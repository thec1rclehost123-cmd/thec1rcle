import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Mail, ExternalLink, ChevronRight } from "lucide-react-native";
import { typography } from "@/lib/design/theme";

const settingsFont = {
    regular: typography.fontFamily.body,
    medium: typography.fontFamily.medium,
    bold: typography.fontFamily.heading,
    black: typography.fontFamily.brandAccent,
};

export default function HelpScreen() {
    const insets = useSafeAreaInsets();

    const faqs = [
        { q: "How do I transfer a ticket?", a: "Go to your ticket details in the 'My Tickets' tab and tap 'Transfer Tickets'. Enter your friend's phone number to send it to them instantly." },
        { q: "Can I get a refund?", a: "Ticket purchases are generally non-refundable unless an event is cancelled by the organizer. You can always transfer your ticket to someone else." },
        { q: "How does the waiting list work?", a: "If an event is sold out, you can join the waiting list. You'll be notified immediately if more tickets are released." },
        { q: "Is my personal data secure?", a: "Yes, we use industry-standard encryption to protect your data. We never sell your personal information." }
    ];

    const handleEmail = () => {
        Linking.openURL("mailto:support@thec1rcle.com");
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <Pressable onPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace("/");
                    }
                }} style={styles.backButton}>
                    <Text style={styles.backIcon}>←</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Help & Support</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            <ScrollView bounces={false} overScrollMode="never" style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Contact Options */}
                <Animated.View entering={FadeInDown.delay(100)} style={styles.contactSection}>
                    <Text style={styles.sectionTitle}>Get in Touch</Text>
                    
                    <Pressable style={styles.contactCard} onPress={handleEmail}>
                        <View style={styles.contactIconWrap}>
                            <Mail size={24} color="#fff" />
                        </View>
                        <View style={styles.contactContent}>
                            <Text style={styles.contactTitle}>Email Support</Text>
                            <Text style={styles.contactSub}>support@thec1rcle.com</Text>
                        </View>
                        <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                    </Pressable>

                    <Pressable style={styles.contactCard} onPress={() => Linking.openURL("https://thec1rcle.com/faq")}>
                        <View style={styles.contactIconWrap}>
                            <ExternalLink size={24} color="#fff" />
                        </View>
                        <View style={styles.contactContent}>
                            <Text style={styles.contactTitle}>Visit Help Center</Text>
                            <Text style={styles.contactSub}>Detailed guides and policies</Text>
                        </View>
                        <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                    </Pressable>
                </Animated.View>

                {/* FAQs */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.faqSection}>
                    <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                    
                    {faqs.map((faq, idx) => (
                        <View key={idx} style={styles.faqItem}>
                            <Text style={styles.faqQ}>{faq.q}</Text>
                            <Text style={styles.faqA}>{faq.a}</Text>
                        </View>
                    ))}
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#050506",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.03)",
    },
    headerTitle: {
        color: "#fff",
        fontSize: 18,
        fontFamily: settingsFont.bold,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        alignItems: "center",
        justifyContent: "center",
    },
    backIcon: {
        color: "#fff",
        fontSize: 20,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    sectionTitle: {
        color: "rgba(255, 255, 255, 0.55)",
        fontSize: 12,
        fontFamily: settingsFont.bold,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    contactSection: {
        marginBottom: 32,
    },
    contactCard: {
        backgroundColor: "#101114",
        borderRadius: 20,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255, 255, 255, 0.03)",
    },
    contactIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.05)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    contactContent: {
        flex: 1,
    },
    contactTitle: {
        color: "#fff",
        fontSize: 17,
        fontFamily: settingsFont.bold,
        marginBottom: 4,
    },
    contactSub: {
        color: "rgba(255, 255, 255, 0.55)",
        fontSize: 14,
        fontFamily: settingsFont.medium,
    },
    faqSection: {
        paddingBottom: 40,
    },
    faqItem: {
        backgroundColor: "#101114",
        borderRadius: 20,
        padding: 20,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255, 255, 255, 0.03)",
    },
    faqQ: {
        color: "#fff",
        fontSize: 16,
        fontFamily: settingsFont.bold,
        marginBottom: 8,
        lineHeight: 22,
    },
    faqA: {
        color: "rgba(255, 255, 255, 0.65)",
        fontSize: 15,
        fontFamily: settingsFont.regular,
        lineHeight: 22,
    }
});
