import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Check, RotateCcw } from 'lucide-react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInRight, ReduceMotion } from 'react-native-reanimated';
import { FIRST_RUN_EVENTS, trackFirstRun } from '@/lib/firstRunAnalytics';

export const firstRunTokens = {
  color: {
    background: '#000000',
    surface: '#151515',
    surfaceStrong: '#1D1D1D',
    surfaceSelected: '#21120E',
    text: '#FFF8F4',
    muted: '#A8A19D',
    placeholder: '#716C69',
    accent: '#F44A22',
    error: '#FF796B',
    success: '#69D391',
    border: '#343434',
    borderSubtle: '#292929',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  edge: 24,
  radius: 16,
  controlHeight: 56,
  motion: { quick: 220, screen: 260 },
  // Backwards-compatible aliases while older auth screens are migrated.
  background: '#000000',
  surface: '#151515',
  surfaceStrong: '#1D1D1D',
  text: '#FFF8F4',
  muted: '#A8A19D',
  accent: '#F44A22',
  error: '#FF796B',
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
  analyticsStage?: string;
};

export function FirstRunShell({
  chapter,
  progress,
  title,
  subtitle,
  children,
  action,
  onBack,
  scroll = true,
  analyticsStage,
}: ShellProps) {
  useEffect(() => {
    if (analyticsStage) {
      trackFirstRun(FIRST_RUN_EVENTS.STEP_VIEWED, { stage: analyticsStage });
    }
  }, [analyticsStage]);
  const normalizedProgress = Math.max(0, Math.min(progress, 1));
  const content = (
    <Animated.View
      entering={FadeInRight.duration(firstRunTokens.motion.screen).reduceMotion(
        ReduceMotion.System,
      )}
      style={styles.content}
    >
      <Text style={styles.chapter}>{chapter}</Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${chapter} progress`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(normalizedProgress * 100) }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressValue, { width: `${normalizedProgress * 100}%` }]} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#2A0D08', '#090403', '#000000']}
        locations={[0, 0.38, 0.78]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.ambientOrb} />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous step"
            hitSlop={12}
            onPress={() => {
              if (analyticsStage) {
                trackFirstRun(FIRST_RUN_EVENTS.STEP_BACKED_OUT, { stage: analyticsStage });
              }
              if (onBack) onBack();
              else if (router.canGoBack()) router.back();
              else router.replace('/(auth)/login');
            }}
            style={styles.back}
          >
            <ChevronLeft color={firstRunTokens.color.text} size={24} />
          </Pressable>
        </View>
        {scroll ? (
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={styles.nonScroll}>{content}</View>
        )}
        {action ? (
          <Animated.View
            entering={FadeIn.duration(firstRunTokens.motion.quick).reduceMotion(
              ReduceMotion.System,
            )}
            style={styles.action}
          >
            {action}
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FirstRunInputProps = TextInputProps & {
  error?: boolean;
};

export function FirstRunInput({ error, onFocus, onBlur, ...props }: FirstRunInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      placeholderTextColor={firstRunTokens.color.placeholder}
      style={[
        styles.input,
        focused && styles.inputFocused,
        error && styles.inputError,
        props.style,
      ]}
    />
  );
}

export function FirstRunField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <FirstRunMessage tone="error">{error}</FirstRunMessage> : null}
      {!error && hint ? <FirstRunMessage>{hint}</FirstRunMessage> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary';

export function FirstRunButton({
  label,
  onPress,
  loading,
  disabled,
  secondary,
  variant = secondary ? 'secondary' : 'primary',
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  variant?: ButtonVariant;
  accessibilityHint?: string;
}) {
  const isSecondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        isSecondary && styles.buttonSecondary,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? firstRunTokens.color.text : '#FFFFFF'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isSecondary && styles.buttonTextSecondary,
            disabled && styles.buttonTextDisabled,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type MessageTone = 'muted' | 'error' | 'success';

export function FirstRunMessage({
  children,
  error,
  tone = error ? 'error' : 'muted',
}: {
  children: ReactNode;
  error?: boolean;
  tone?: MessageTone;
}) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[
        styles.message,
        tone === 'error' && styles.messageError,
        tone === 'success' && styles.messageSuccess,
      ]}
    >
      {children}
    </Text>
  );
}

export function FirstRunTextAction({
  label,
  onPress,
  disabled,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.textAction,
        disabled && styles.textActionDisabled,
      ]}
    >
      <Text style={styles.textActionLabel}>{label}</Text>
    </Pressable>
  );
}

export function FirstRunDivider({ label }: { label: string }) {
  return (
    <View
      style={styles.divider}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function FirstRunValueButton({
  label,
  value,
  placeholder,
  onPress,
  icon,
  error,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  icon?: ReactNode;
  error?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value || placeholder}`}
      onPress={onPress}
      style={[
        styles.valueButton,
        error && styles.inputError,
      ]}
    >
      <Text style={[styles.valueText, !value && styles.valuePlaceholder]}>
        {value || placeholder}
      </Text>
      {icon}
    </Pressable>
  );
}

export function ChoiceTile({
  title,
  description,
  selected,
  onPress,
  disabled,
  selectionMode = 'multiple',
  leading,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  selectionMode?: 'single' | 'multiple';
  leading?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={selectionMode === 'single' ? 'radio' : 'checkbox'}
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={
        selectionMode === 'single'
          ? { selected, disabled: Boolean(disabled) }
          : { checked: selected, disabled: Boolean(disabled) }
      }
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.choiceSelected,
        disabled && styles.choiceDisabled,
      ]}
    >
      {leading ? <View style={styles.choiceLeading}>{leading}</View> : null}
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
      </View>
      <View style={[styles.check, selected && styles.checkSelected]}>
        {selected ? <Check color="#FFFFFF" size={16} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export const FirstRunOtpInput = forwardRef<
  TextInput,
  {
    value: string;
    onChange: (value: string) => void;
    error?: boolean;
    success?: boolean;
    editable?: boolean;
    autoFocus?: boolean;
  }
>(function FirstRunOtpInput(
  { value, onChange, error, success, editable = true, autoFocus = true },
  forwardedRef,
) {
  const input = useRef<TextInput>(null);
  useImperativeHandle(forwardedRef, () => input.current as TextInput);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          success ? 'Verification code accepted' : 'Enter 6-digit verification code'
        }
        accessibilityState={{ disabled: !editable }}
        disabled={!editable}
        onPress={() => input.current?.focus()}
        style={[styles.codeBox, error && styles.codeError, success && styles.codeSuccess]}
      >
        {success ? (
          <Check color={firstRunTokens.color.success} size={36} strokeWidth={3} />
        ) : (
          Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={[styles.digit, value.length === index && styles.digitActive]}>
              <Text style={styles.digitText}>{value[index] ?? ''}</Text>
            </View>
          ))
        )}
      </Pressable>
      <TextInput
        ref={input}
        accessibilityLabel="6-digit verification code"
        autoFocus={autoFocus}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        keyboardType="number-pad"
        value={value}
        editable={editable}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, 6))}
        maxLength={6}
        caretHidden
        style={styles.hiddenInput}
      />
    </View>
  );
});

export function FirstRunStatus({
  title,
  message,
  loading,
  onRetry,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {loading ? (
        <ActivityIndicator color={firstRunTokens.color.accent} />
      ) : onRetry ? (
        <RotateCcw color={firstRunTokens.color.error} size={22} />
      ) : null}
      <Text style={styles.statusTitle}>{title}</Text>
      {message ? <FirstRunMessage>{message}</FirstRunMessage> : null}
      {onRetry ? <FirstRunButton label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: firstRunTokens.color.background },
  ambientOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -130,
    top: 90,
    backgroundColor: 'rgba(244,74,34,0.1)',
  },
  header: { height: 52, justifyContent: 'center', paddingHorizontal: firstRunTokens.edge },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  scrollView: { flex: 1 },
  scroll: { flexGrow: 1 },
  nonScroll: { flex: 1 },
  content: { flex: 1, paddingHorizontal: firstRunTokens.edge, paddingBottom: firstRunTokens.edge },
  chapter: {
    color: firstRunTokens.color.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  progressTrack: {
    height: 2,
    backgroundColor: firstRunTokens.color.borderSubtle,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 28,
    overflow: 'hidden',
  },
  progressValue: { height: 2, backgroundColor: firstRunTokens.color.accent },
  title: {
    color: firstRunTokens.color.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: firstRunTokens.color.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 350,
  },
  body: { marginTop: 32, gap: 12 },
  action: {
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
    paddingHorizontal: firstRunTokens.edge,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(10,10,10,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: firstRunTokens.color.borderSubtle,
  },
  field: { gap: 8 },
  label: { color: firstRunTokens.color.text, fontSize: 14, fontWeight: '700' },
  input: {
    height: firstRunTokens.controlHeight,
    borderRadius: firstRunTokens.radius,
    backgroundColor: firstRunTokens.color.surface,
    borderWidth: 1,
    borderColor: firstRunTokens.color.border,
    color: firstRunTokens.color.text,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  inputFocused: { borderColor: firstRunTokens.color.accent, borderWidth: 2 },
  inputError: { borderColor: firstRunTokens.color.error },
  button: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: firstRunTokens.controlHeight,
    borderRadius: firstRunTokens.radius,
    backgroundColor: firstRunTokens.color.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: firstRunTokens.color.surface,
    borderWidth: 1,
    borderColor: firstRunTokens.color.border,
  },
  buttonDisabled: {
    backgroundColor: firstRunTokens.color.surfaceStrong,
    borderWidth: 1,
    borderColor: firstRunTokens.color.border,
  },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  buttonTextSecondary: { color: firstRunTokens.color.text },
  buttonTextDisabled: { color: firstRunTokens.color.muted },
  message: { color: firstRunTokens.color.muted, fontSize: 14, lineHeight: 20 },
  messageError: { color: firstRunTokens.color.error },
  messageSuccess: { color: firstRunTokens.color.success },
  textAction: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  textActionDisabled: { opacity: 0.42 },
  textActionLabel: {
    color: firstRunTokens.color.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: firstRunTokens.color.borderSubtle },
  dividerLabel: { color: firstRunTokens.color.muted, fontSize: 12 },
  valueButton: {
    minHeight: firstRunTokens.controlHeight,
    borderRadius: firstRunTokens.radius,
    borderWidth: 1,
    borderColor: firstRunTokens.color.border,
    backgroundColor: firstRunTokens.color.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  valueText: { flex: 1, color: firstRunTokens.color.text, fontSize: 16 },
  valuePlaceholder: { color: firstRunTokens.color.placeholder },
  choice: {
    minHeight: 72,
    padding: 16,
    borderRadius: firstRunTokens.radius,
    backgroundColor: firstRunTokens.color.surface,
    borderWidth: 1,
    borderColor: firstRunTokens.color.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceSelected: {
    borderColor: firstRunTokens.color.accent,
    backgroundColor: firstRunTokens.color.surfaceSelected,
  },
  choiceDisabled: { opacity: 0.42 },
  choiceLeading: { width: 24, alignItems: 'center' },
  choiceCopy: { flex: 1 },
  choiceTitle: { color: firstRunTokens.color.text, fontSize: 16, fontWeight: '700' },
  choiceDescription: {
    color: firstRunTokens.color.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    borderColor: firstRunTokens.color.accent,
    backgroundColor: firstRunTokens.color.accent,
  },
  codeBox: {
    minHeight: 76,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: firstRunTokens.radius,
    backgroundColor: firstRunTokens.color.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  codeError: { borderColor: firstRunTokens.color.error },
  codeSuccess: { borderColor: firstRunTokens.color.success },
  digit: {
    width: 38,
    height: 48,
    borderBottomWidth: 2,
    borderBottomColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitActive: { borderBottomColor: firstRunTokens.color.accent },
  digitText: { color: firstRunTokens.color.text, fontSize: 26, fontWeight: '800' },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    color: 'transparent',
    backgroundColor: 'transparent',
    opacity: 0.02,
  },
  status: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  statusTitle: {
    color: firstRunTokens.color.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
});
