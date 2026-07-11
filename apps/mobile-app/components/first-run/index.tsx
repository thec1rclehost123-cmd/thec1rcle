import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInRight, ReduceMotion } from 'react-native-reanimated';

export const firstRunTokens = {
  background: '#000000',
  surface: '#151515',
  surfaceStrong: '#1D1D1D',
  text: '#FFF8F4',
  muted: '#A8A19D',
  accent: '#F44A22',
  error: '#FF796B',
  edge: 24,
  radius: 16,
  controlHeight: 56,
} as const;

type ShellProps = {
  chapter: 'Account' | 'About you' | 'Your nights';
  progress: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  scroll?: boolean;
};

export function FirstRunShell({ chapter, progress, title, subtitle, children, action, onBack, scroll = true }: ShellProps) {
  const content = (
    <Animated.View entering={FadeInRight.duration(260).reduceMotion(ReduceMotion.System)} style={styles.content}>
      <Text style={styles.chapter}>{chapter}</Text>
      <View style={styles.progressTrack} accessibilityLabel={`${chapter} progress`} accessibilityValue={{ min: 0, max: 1, now: progress }}>
        <View style={[styles.progressValue, { width: `${Math.max(0, Math.min(progress, 1)) * 100}%` }]} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onBack ?? (() => router.back())} style={styles.back}>
            <ChevronLeft color={firstRunTokens.text} size={24} />
          </Pressable>
        </View>
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
        {action ? <Animated.View entering={FadeIn.duration(220)} style={styles.action}>{action}</Animated.View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FirstRunInput({ error, ...props }: TextInputProps & { error?: boolean }) {
  return <TextInput {...props} placeholderTextColor="#716C69" style={[styles.input, error && styles.inputError, props.style]} />;
}

export function FirstRunButton({ label, onPress, loading, disabled, secondary, accessibilityHint }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean; accessibilityHint?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (disabled || loading) && styles.buttonDisabled, pressed && styles.buttonPressed]}>
      {loading ? <ActivityIndicator color={secondary ? firstRunTokens.text : '#FFFFFF'} /> : <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>}
    </Pressable>
  );
}

export function FirstRunMessage({ children, error }: { children: ReactNode; error?: boolean }) {
  return <Text accessibilityLiveRegion="polite" style={[styles.message, error && styles.messageError]}>{children}</Text>;
}

export function ChoiceTile({ title, description, selected, onPress }: { title: string; description?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.buttonPressed]}>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
      </View>
      <View style={[styles.check, selected && styles.checkSelected]}>{selected ? <Check color="#FFFFFF" size={16} strokeWidth={3} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: firstRunTokens.background },
  header: { height: 52, justifyContent: 'center', paddingHorizontal: firstRunTokens.edge },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  scroll: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: firstRunTokens.edge, paddingBottom: 24 },
  chapter: { color: firstRunTokens.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 4 },
  progressTrack: { height: 2, backgroundColor: '#292929', borderRadius: 2, marginTop: 12, marginBottom: 28, overflow: 'hidden' },
  progressValue: { height: 2, backgroundColor: firstRunTokens.accent },
  title: { color: firstRunTokens.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: firstRunTokens.muted, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 350 },
  body: { marginTop: 32, gap: 12 },
  action: { paddingHorizontal: firstRunTokens.edge, paddingTop: 12, paddingBottom: 8, backgroundColor: firstRunTokens.background },
  input: { height: firstRunTokens.controlHeight, borderRadius: firstRunTokens.radius, backgroundColor: firstRunTokens.surface, borderWidth: 1, borderColor: '#343434', color: firstRunTokens.text, fontSize: 16, paddingHorizontal: 16 },
  inputError: { borderColor: firstRunTokens.error },
  button: { height: firstRunTokens.controlHeight, borderRadius: firstRunTokens.radius, backgroundColor: firstRunTokens.accent, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { backgroundColor: firstRunTokens.surface, borderWidth: 1, borderColor: '#343434' },
  buttonDisabled: { opacity: 0.42 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  buttonTextSecondary: { color: firstRunTokens.text },
  message: { color: firstRunTokens.muted, fontSize: 14, lineHeight: 20 },
  messageError: { color: firstRunTokens.error },
  choice: { minHeight: 72, padding: 16, borderRadius: firstRunTokens.radius, backgroundColor: firstRunTokens.surface, borderWidth: 1, borderColor: '#292929', flexDirection: 'row', alignItems: 'center', gap: 12 },
  choiceSelected: { borderColor: firstRunTokens.accent, backgroundColor: '#21120E' },
  choiceCopy: { flex: 1 },
  choiceTitle: { color: firstRunTokens.text, fontSize: 16, fontWeight: '700' },
  choiceDescription: { color: firstRunTokens.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#4A4A4A', alignItems: 'center', justifyContent: 'center' },
  checkSelected: { borderColor: firstRunTokens.accent, backgroundColor: firstRunTokens.accent },
});
