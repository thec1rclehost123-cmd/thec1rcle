import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Check, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  FirstRunButton,
  FirstRunField,
  FirstRunInput,
  FirstRunMessage,
  FirstRunShell,
  FirstRunValueButton,
  firstRunTokens,
} from '@/components/first-run';
import {
  calculateAge,
  DEFAULT_MIN_ACCOUNT_AGE,
  firstRunRoute,
  formatDateOfBirth,
  parseDateOfBirth,
} from '@/lib/firstRun';
import { useAuthStore } from '@/store/authStore';
import { useFirstRunStore } from '@/store/firstRunStore';
import { useProfileStore } from '@/store/profileStore';

export default function IdentityScreen() {
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const { snapshot, saveIdentity, loading, error } = useFirstRunStore();
  const minimumAccountAge = useFirstRunStore(
    (state) => state.snapshot?.minimumAccountAge ?? DEFAULT_MIN_ACCOUNT_AGE,
  );
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
    if (!ok) return;
    const nextStage = useFirstRunStore.getState().snapshot?.currentStage ?? 'city';
    router.push(firstRunRoute(nextStage) as any);
  };

  return (
    <FirstRunShell
      analyticsStage="identity"
      chapter="About you"
      progress={0.25}
      title="What should we call you?"
      subtitle="Build the identity people will recognise when the night begins."
      action={
        <FirstRunButton
          label="Continue"
          onPress={submit}
          loading={loading}
          disabled={!name.trim() || !dob}
        />
      }
    >
      <LinearGradient
        colors={['rgba(244,74,34,0.28)', 'rgba(255,122,66,0.08)', 'rgba(255,255,255,0.03)']}
        style={styles.identityPreview}
      >
        <View style={styles.previewTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.previewCopy}>
            <Text style={styles.previewEyebrow}>YOUR C1RCLE ID</Text>
            <Text style={styles.previewName} numberOfLines={1}>
              {name.trim() || 'Your name, your night'}
            </Text>
          </View>
          <View style={styles.verified}>
            <Check size={13} color="#FFFFFF" strokeWidth={3} />
          </View>
        </View>
        <View style={styles.previewFooter}>
          <Sparkles size={15} color="#FF8A66" />
          <Text style={styles.previewFooterText}>This becomes your social and ticket identity</Text>
        </View>
      </LinearGradient>
      <FirstRunField label="Preferred name">
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
      </FirstRunField>
      <FirstRunField
        label="When were you born?"
        hint="We use your age to show events you’re eligible to attend."
      >
        <FirstRunValueButton
          label="Date of birth"
          value={dob?.toLocaleDateString()}
          placeholder="Choose your date of birth"
          onPress={() => setShowPicker(true)}
          icon={<CalendarDays color={firstRunTokens.muted} size={20} />}
        />
      </FirstRunField>
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
  picker: { borderRadius: 16, backgroundColor: firstRunTokens.surface, overflow: 'hidden' },
  identityPreview: {
    minHeight: 132,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.34)',
    padding: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    marginBottom: 8,
  },
  previewTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F44A22',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  previewCopy: { flex: 1, marginLeft: 14 },
  previewEyebrow: { color: '#FF8A66', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  previewName: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 5 },
  verified: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#F44A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 },
  previewFooterText: { color: 'rgba(255,255,255,0.58)', fontSize: 12, flex: 1 },
});
