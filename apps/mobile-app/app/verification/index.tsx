import { router } from 'expo-router';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  ArrowLeft,
  ShieldCheck,
  Camera,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react-native';
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/lib/design/theme';
import { getFirebaseApp } from '@/lib/firebase/client';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

const STEPS = [
  {
    icon: '📋',
    title: 'Personal Info',
    desc: 'Confirm your display name and date of birth',
  },
  {
    icon: '🤳',
    title: 'Face Scan',
    desc: "Take a quick selfie to prove you're a real person",
  },
  {
    icon: '✅',
    title: 'Review',
    desc: "We'll verify your identity within a few minutes",
  },
];

function StatusBanner({ status }: { status: VerificationStatus }) {
  if (status === 'verified') {
    return (
      <View style={[styles.statusBanner, styles.statusVerified]}>
        <CheckCircle2 size={18} color="#22C55E" />
        <Text style={[styles.statusText, { color: '#22C55E' }]}>Your profile is verified</Text>
      </View>
    );
  }
  if (status === 'pending') {
    return (
      <View style={[styles.statusBanner, styles.statusPending]}>
        <Clock size={18} color="#FBBF24" />
        <Text style={[styles.statusText, { color: '#FBBF24' }]}>
          Verification under review — usually within 10 minutes
        </Text>
      </View>
    );
  }
  if (status === 'rejected') {
    return (
      <View style={[styles.statusBanner, styles.statusRejected]}>
        <AlertCircle size={18} color="#EF4444" />
        <Text style={[styles.statusText, { color: '#EF4444' }]}>
          Verification was not approved. Please try again.
        </Text>
      </View>
    );
  }
  return null;
}

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const [submitting, setSubmitting] = useState(false);

  // Derive current status from profile
  const status: VerificationStatus = profile?.isVerified
    ? 'verified'
    : ((profile as any)?.verificationStatus ?? 'unverified');

  const handleStartVerification = async () => {
    if (!user?.uid || submitting) return;
    setSubmitting(true);
    try {
      const db = getFirestore(getFirebaseApp());
      // Write a pending verification request to Firestore.
      // In production this would trigger a Cloud Function / KYC provider.
      await setDoc(
        doc(db, 'verificationRequests', user.uid),
        {
          userId: user.uid,
          displayName: profile?.displayName || user.displayName || '',
          email: profile?.email || user.email || '',
          photoURL: profile?.photoURL || user.photoURL || '',
          status: 'pending',
          submittedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Optimistically mark user's profile as pending
      await setDoc(doc(db, 'users', user.uid), { verificationStatus: 'pending' }, { merge: true });

      router.back();
    } catch (err) {
      console.error('[Verification] submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner (if not unverified) */}
        {status !== 'unverified' && <StatusBanner status={status} />}

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ShieldCheck size={44} color={colors.iris} strokeWidth={1.5} />
          </View>
          <Text style={styles.heroTitle}>
            {status === 'verified' ? "You're Verified ✓" : 'Get Verified'}
          </Text>
          <Text style={styles.heroBody}>
            {status === 'verified'
              ? 'Your verified badge is shown on your profile and dating cards, building trust with other users.'
              : "Verification confirms you're a real person. A blue checkmark appears on your profile and dating cards, giving others more confidence to connect with you."}
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.sectionLabel}>WHY VERIFY?</Text>
          {[
            { icon: '💙', text: 'Blue verified badge on your profile' },
            { icon: '🔒', text: 'More matches — people trust verified users' },
            { icon: '🛡️', text: 'Helps keep the community safe' },
            { icon: '🎟', text: 'Priority access to exclusive events' },
          ].map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* Steps */}
        {status === 'unverified' || status === 'rejected' ? (
          <>
            <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
            <View style={styles.stepsCard}>
              {STEPS.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>
                      {step.icon} {step.title}
                    </Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                  {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                </View>
              ))}
            </View>

            {/* CTA */}
            <Pressable
              style={[styles.ctaBtn, submitting && styles.ctaBtnDisabled]}
              onPress={handleStartVerification}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Camera size={18} color="#fff" />
                  <Text style={styles.ctaBtnText}>Start Verification</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.privacyNote}>
              Your face scan is processed securely and never stored or shared.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusVerified: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  statusPending: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.2)',
  },
  statusRejected: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.2)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(244,74,34,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroBody: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  benefitsCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  benefitText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    flex: 1,
  },
  stepsCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 20,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244,74,34,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  stepNumberText: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '700',
  },
  stepLine: {
    position: 'absolute',
    left: 13,
    top: 32,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(244,74,34,0.15)',
  },
  stepContent: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  stepDesc: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    lineHeight: 18,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.iris,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  privacyNote: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
