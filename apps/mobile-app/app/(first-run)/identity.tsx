import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  FirstRunButton,
  FirstRunInput,
  FirstRunMessage,
  FirstRunShell,
  firstRunTokens,
} from '@/components/first-run';
import {
  calculateAge,
  formatDateOfBirth,
  parseDateOfBirth,
  resolveMinimumAccountAge,
} from '@/lib/firstRun';
import { useAuthStore } from '@/store/authStore';
import { useFirstRunStore } from '@/store/firstRunStore';
import { useProfileStore } from '@/store/profileStore';
import { trackFirstRun } from '@/lib/firstRunAnalytics';

export default function IdentityScreen() {
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const { snapshot, saveIdentity, loading, error } = useFirstRunStore();
  const minimumAccountAge = resolveMinimumAccountAge(snapshot);
  const [name, setName] = useState(
    snapshot?.displayName || profile?.displayName || user?.displayName || '',
  );
  const [dob, setDob] = useState<Date | null>(() =>
    parseDateOfBirth(snapshot?.dateOfBirth || profile?.dateOfBirth),
  );
  const [showPicker, setShowPicker] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - minimumAccountAge);
    return date;
  }, [minimumAccountAge]);
  useEffect(() => trackFirstRun('first_run_step_viewed', { stage: 'identity' }), []);

  const onDate = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) {
      setDob(selected);
      setLocalError(null);
    }
  };

  const submit = async () => {
    if (!name.trim()) return setLocalError('Tell us what we should call you.');
    if (!dob) return setLocalError('Choose your date of birth.');
    if (calculateAge(dob) < minimumAccountAge)
      return setLocalError(`You must be at least ${minimumAccountAge} to use THE C1RCLE.`);
    const ok = await saveIdentity(name.trim(), formatDateOfBirth(dob));
    if (ok) {
      trackFirstRun('first_run_step_completed', { stage: 'identity', outcome: 'success' });
      router.replace('/city' as any);
    }
  };

  return (
    <FirstRunShell
      chapter="About you"
      progress={0.35}
      title="What should we call you?"
      subtitle="This is how your name will appear across THE C1RCLE."
      action={
        <FirstRunButton
          label="Continue"
          onPress={submit}
          loading={loading}
          disabled={!name.trim() || !dob}
        />
      }
    >
      <Text style={styles.label}>Preferred name</Text>
      <FirstRunInput
        accessibilityLabel="Preferred name"
        autoComplete="name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setLocalError(null);
        }}
        placeholder="Your name"
      />
      <Text style={[styles.label, styles.dobLabel]}>When were you born?</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          dob ? `Date of birth ${dob.toLocaleDateString()}` : 'Choose date of birth'
        }
        onPress={() => setShowPicker(true)}
        style={styles.dateButton}
      >
        <Text style={[styles.dateText, !dob && styles.placeholder]}>
          {dob ? dob.toLocaleDateString() : 'Choose your date of birth'}
        </Text>
        <CalendarDays color={firstRunTokens.muted} size={20} />
      </Pressable>
      <FirstRunMessage>We use your age to show events you’re eligible to attend.</FirstRunMessage>
      {localError || error ? <FirstRunMessage error>{localError ?? error}</FirstRunMessage> : null}
      {showPicker ? (
        <View style={styles.picker}>
          <DateTimePicker
            value={dob ?? maxDate}
            mode="date"
            maximumDate={maxDate}
            onChange={onDate}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
          />
        </View>
      ) : null}
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({
  label: { color: firstRunTokens.text, fontSize: 14, fontWeight: '700', marginBottom: -4 },
  dobLabel: { marginTop: 14 },
  dateButton: {
    height: firstRunTokens.controlHeight,
    borderRadius: firstRunTokens.radius,
    borderWidth: 1,
    borderColor: '#343434',
    backgroundColor: firstRunTokens.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { color: firstRunTokens.text, fontSize: 16 },
  placeholder: { color: '#716C69' },
  picker: { borderRadius: 16, backgroundColor: firstRunTokens.surface, overflow: 'hidden' },
});
