/**
 * Legal Page Component
 * Base component for all legal content pages
 */

import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { colors, radii } from "@/lib/design/theme";
import { trackScreen } from "@/lib/analytics";
import { useEffect } from "react";

// Legal page type
export type LegalPageType = "terms" | "privacy" | "refunds" | "guidelines" | "safety";

interface LegalPageProps {
    type: LegalPageType;
}

// Legal content data
const LEGAL_CONTENT: Record<LegalPageType, {
    title: string;
    lastUpdated: string;
    sections: Array<{
        heading?: string;
        content: string[];
    }>;
}> = {
    terms: {
        title: "Terms of Service",
        lastUpdated: "January 15, 2026",
        sections: [
            {
                content: [
                    "Welcome to THE C1RCLE. By using our app and services, you agree to these Terms of Service. Please read them carefully.",
                ],
            },
            {
                heading: "1. Acceptance of Terms",
                content: [
                    "By accessing or using THE C1RCLE mobile application, website, or any related services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.",
                    "If you do not agree to these terms, please do not use our services.",
                ],
            },
            {
                heading: "2. Account Registration",
                content: [
                    "To use certain features of our services, you must create an account. You agree to provide accurate, current, and complete information during registration.",
                    "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
                    "You must be at least 18 years old to create an account and purchase tickets for events that serve alcohol.",
                ],
            },
            {
                heading: "3. Ticket Purchases",
                content: [
                    "All ticket purchases are final unless otherwise stated in our Refund Policy.",
                    "Tickets are valid only for the specific event, date, and time indicated.",
                    "Reselling tickets at a price higher than the original purchase price is prohibited.",
                    "We reserve the right to cancel tickets purchased through fraudulent means.",
                ],
            },
            {
                heading: "4. User Conduct",
                content: [
                    "You agree to use our services in compliance with all applicable laws and our Community Guidelines.",
                    "You will not harass, threaten, or harm other users.",
                    "You will not share inappropriate or offensive content.",
                    "Violation of these terms may result in account suspension or termination.",
                ],
            },
            {
                heading: "5. Intellectual Property",
                content: [
                    "All content, features, and functionality of our services are owned by THE C1RCLE and are protected by copyright, trademark, and other intellectual property laws.",
                ],
            },
            {
                heading: "6. Limitation of Liability",
                content: [
                    "THE C1RCLE is not responsible for any injuries, losses, or damages that may occur at events.",
                    "We provide our services 'as is' without warranties of any kind.",
                ],
            },
            {
                heading: "7. Changes to Terms",
                content: [
                    "We may update these Terms of Service from time to time. We will notify you of significant changes via email or in-app notification.",
                ],
            },
            {
                heading: "8. Contact Us",
                content: [
                    "If you have questions about these Terms, please contact us at legal@thec1rcle.com.",
                ],
            },
        ],
    },
    privacy: {
        title: "Privacy Policy",
        lastUpdated: "January 15, 2026",
        sections: [
            {
                content: [
                    "Your privacy is important to us. This Privacy Policy explains how THE C1RCLE collects, uses, and protects your personal information.",
                ],
            },
            {
                heading: "1. Information We Collect",
                content: [
                    "Account Information: Name, email address, phone number, and profile photo.",
                    "Transaction Information: Ticket purchases, payment method details (processed securely by our payment providers).",
                    "Usage Information: How you interact with our app, including events viewed and features used.",
                    "Device Information: Device type, operating system, and app version.",
                    "Location Information: With your consent, we may collect location data for event recommendations and safety features.",
                ],
            },
            {
                heading: "2. How We Use Your Information",
                content: [
                    "To process ticket purchases and provide customer support.",
                    "To personalize your experience and recommend events.",
                    "To enable social features like event chats and connections.",
                    "To send important updates about your tickets and events.",
                    "To improve our services and develop new features.",
                    "For safety and security purposes.",
                ],
            },
            {
                heading: "3. Information Sharing",
                content: [
                    "Event Organizers: We share necessary information with event organizers to validate tickets.",
                    "Other Users: Your profile information may be visible to other attendees at events you attend.",
                    "Service Providers: We work with trusted partners who help us operate our services.",
                    "Legal Requirements: We may disclose information when required by law.",
                    "We never sell your personal information to third parties.",
                ],
            },
            {
                heading: "4. Data Security",
                content: [
                    "We implement industry-standard security measures to protect your data.",
                    "All data transmission is encrypted using SSL/TLS.",
                    "Payment information is processed by PCI-compliant payment providers.",
                ],
            },
            {
                heading: "5. Your Rights",
                content: [
                    "You can access, update, or delete your personal information in the app settings.",
                    "You can opt out of marketing communications.",
                    "You can request a copy of your data or its deletion by contacting privacy@thec1rcle.com.",
                ],
            },
            {
                heading: "6. Cookies and Analytics",
                content: [
                    "We use analytics tools to understand how users interact with our app.",
                    "This helps us improve user experience and fix issues.",
                ],
            },
            {
                heading: "7. Children's Privacy",
                content: [
                    "Our services are not intended for children under 13.",
                    "We do not knowingly collect information from children under 13.",
                ],
            },
            {
                heading: "8. Contact Us",
                content: [
                    "For privacy-related questions, contact us at privacy@thec1rcle.com.",
                ],
            },
        ],
    },
    refunds: {
        title: "Refund & Cancellation Policy",
        lastUpdated: "January 15, 2026",
        sections: [
            {
                content: [
                    "We understand plans can change. Here's our policy on refunds and cancellations.",
                ],
            },
            {
                heading: "1. General Policy",
                content: [
                    "Ticket purchases are generally non-refundable. We recommend purchasing tickets only when you are certain you can attend.",
                    "Each event may have its own refund policy set by the organizer. Check the event details before purchasing.",
                ],
            },
            {
                heading: "2. Event Cancellation by Organizer",
                content: [
                    "If an event is cancelled by the organizer, you will receive a full refund to your original payment method.",
                    "Refunds for cancelled events are typically processed within 5-7 business days.",
                ],
            },
            {
                heading: "3. Event Rescheduling",
                content: [
                    "If an event is rescheduled, your ticket will remain valid for the new date.",
                    "If you cannot attend the new date, contact us within 7 days of the announcement for refund options.",
                ],
            },
            {
                heading: "4. Ticket Transfers",
                content: [
                    "Instead of requesting a refund, you can transfer your ticket to another person through our app.",
                    "Ticket transfers are free of charge.",
                    "The transferred ticket remains valid and cannot be refunded by the new holder.",
                ],
            },
            {
                heading: "5. Exceptional Circumstances",
                content: [
                    "We may consider refund requests for exceptional circumstances such as medical emergencies or bereavement.",
                    "Supporting documentation may be required.",
                    "These requests are evaluated on a case-by-case basis.",
                ],
            },
            {
                heading: "6. How to Request a Refund",
                content: [
                    "Contact our support team at support@thec1rcle.com with your order details.",
                    "Include the reason for your refund request.",
                    "We aim to respond within 48 hours.",
                ],
            },
            {
                heading: "7. Processing Time",
                content: [
                    "Approved refunds are processed within 5-7 business days.",
                    "The time for the refund to appear in your account depends on your payment provider.",
                ],
            },
        ],
    },
    guidelines: {
        title: "Community Guidelines",
        lastUpdated: "January 15, 2026",
        sections: [
            {
                content: [
                    "THE C1RCLE is built on respect, safety, and good vibes. Follow these guidelines to ensure everyone has a great experience.",
                ],
            },
            {
                heading: "🤝 Be Respectful",
                content: [
                    "Treat all users with respect and kindness.",
                    "No harassment, bullying, or intimidation.",
                    "Respect personal boundaries and consent.",
                    "Be inclusive and welcoming to everyone.",
                ],
            },
            {
                heading: "🔒 Protect Privacy",
                content: [
                    "Don't share other people's personal information without consent.",
                    "Don't screenshot or share private conversations without permission.",
                    "Respect when someone doesn't want to share their contact details.",
                ],
            },
            {
                heading: "🚫 No Harmful Content",
                content: [
                    "No hate speech, discrimination, or offensive content.",
                    "No sexually explicit or inappropriate content.",
                    "No violence or threats of violence.",
                    "No spam, scams, or misleading information.",
                ],
            },
            {
                heading: "🎟️ Ticket Rules",
                content: [
                    "Only purchase tickets through official channels.",
                    "Don't resell tickets above face value.",
                    "Don't share or duplicate your ticket QR code.",
                ],
            },
            {
                heading: "📸 Event Photos & Content",
                content: [
                    "Share only photos you've taken yourself.",
                    "Get consent before posting photos of others.",
                    "Don't post inappropriate or offensive images.",
                ],
            },
            {
                heading: "🚨 Reporting Violations",
                content: [
                    "If you see content or behavior that violates these guidelines, report it.",
                    "Long-press on messages to report them.",
                    "Contact safety@thec1rcle.com for urgent concerns.",
                ],
            },
            {
                heading: "⚠️ Consequences",
                content: [
                    "Violations may result in content removal, account suspension, or permanent ban.",
                    "Severe violations may be reported to law enforcement.",
                    "We take all reports seriously and investigate thoroughly.",
                ],
            },
        ],
    },
    safety: {
        title: "Safety Policy",
        lastUpdated: "January 15, 2026",
        sections: [
            {
                content: [
                    "Your safety is our top priority. We've built multiple safety features into THE C1RCLE to help you enjoy events worry-free.",
                ],
            },
            {
                heading: "🆘 Emergency Features",
                content: [
                    "SOS Button: Quick access to emergency contacts and venue security.",
                    "Location Sharing: Share your real-time location with trusted friends.",
                    "Party Buddy: Connect with friends to check in on each other.",
                    "Emergency Contacts: Save and quickly reach your emergency contacts.",
                ],
            },
            {
                heading: "🛡️ Safety at Events",
                content: [
                    "All events on our platform are vetted for basic safety standards.",
                    "Venue information includes safety features and exit locations.",
                    "Report any safety concerns to venue staff or through the app.",
                ],
            },
            {
                heading: "👤 Account Safety",
                content: [
                    "Secure login with email verification.",
                    "Control who can message you in privacy settings.",
                    "Block and report users who make you uncomfortable.",
                    "Two-factor authentication available for added security.",
                ],
            },
            {
                heading: "🚫 Zero Tolerance Policy",
                content: [
                    "We have a zero-tolerance policy for harassment, assault, or any threatening behavior.",
                    "Users who violate this policy will be permanently banned.",
                    "We cooperate with law enforcement when necessary.",
                ],
            },
            {
                heading: "📞 Getting Help",
                content: [
                    "In an emergency, always call local emergency services first.",
                    "For urgent safety concerns, contact: safety@thec1rcle.com",
                    "For general support: support@thec1rcle.com",
                ],
            },
            {
                heading: "🤝 Community Responsibility",
                content: [
                    "Look out for each other at events.",
                    "If you see something concerning, say something.",
                    "Help create a safe and welcoming environment for everyone.",
                ],
            },
        ],
    },
};

export function LegalPage({ type }: LegalPageProps) {
    const insets = useSafeAreaInsets();
    const content = LEGAL_CONTENT[type];

    useEffect(() => {
        trackScreen(`Legal_${type}`);
    }, [type]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backIcon}>←</Text>
                </Pressable>
                <Text style={styles.headerTitle}>{content.title}</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Last updated */}
                <Animated.View entering={FadeInDown.delay(100)} style={styles.lastUpdated}>
                    <Text style={styles.lastUpdatedText}>
                        Last updated: {content.lastUpdated}
                    </Text>
                </Animated.View>

                {/* Content sections */}
                {content.sections.map((section, index) => (
                    <Animated.View
                        key={index}
                        entering={FadeInDown.delay(150 + index * 50)}
                        style={styles.section}
                    >
                        {section.heading && (
                            <Text style={styles.sectionHeading}>{section.heading}</Text>
                        )}
                        {section.content.map((paragraph, pIndex) => (
                            <Text key={pIndex} style={styles.paragraph}>
                                {paragraph}
                            </Text>
                        ))}
                    </Animated.View>
                ))}

                {/* Footer */}
                <Animated.View entering={FadeInDown.delay(500)} style={styles.footer}>
                    <Text style={styles.footerText}>
                        Questions? Contact us at legal@thec1rcle.com
                    </Text>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.base[50],
        alignItems: "center",
        justifyContent: "center",
    },
    backIcon: {
        color: colors.gold,
        fontSize: 20,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },
    lastUpdated: {
        marginTop: 20,
        marginBottom: 24,
    },
    lastUpdatedText: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeading: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
    },
    paragraph: {
        color: colors.goldDark,
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 12,
    },
    footer: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.06)",
    },
    footerText: {
        color: colors.goldMetallic,
        fontSize: 13,
        textAlign: "center",
    },
});

export default LegalPage;
