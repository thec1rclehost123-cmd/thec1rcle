import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Phone, Mail } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { markContactLinkingComplete } from '@/lib/onboardingFlow';
import { CountryCodePicker } from '@/components/ui/CountryCodePicker';
import {
  DEFAULT_PHONE_COUNTRY,
  getLocalPhoneDigits,
  getPhoneNumberInputError,
  normalizePhoneNumber,
  type PhoneCountry,
} from '@/lib/phone';

export default function AddContactScreen() {
  const { user } = useAuthStore();
  const { sendPhoneCode, linkEmail, loading, error, setError, clearError, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [email, setEmail] = useState('');
  
  const inputRef = useRef<TextInput>(null);

  // Determine what we need to ask for
  const needsPhone = useMemo(() => {
    if (!user) return false;
    const hasPhone = !!user.phoneNumber || user.providerData.some(p => p.providerId === 'phone');
    return !hasPhone;
  }, [user]);

  useEffect(() => {
    const focusTask = InteractionManager.runAfterInteractions(() => {
      inputRef.current?.focus();
    });
    return () => focusTask.cancel();
  }, []);

  const handleSkip = async () => {
    if (user?.uid) {
      await markContactLinkingComplete(user.uid);
    }
    router.replace('/profile-setup');
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    clearError();

    if (needsPhone) {
      const inputError = getPhoneNumberInputError(phone, phoneCountry);
      if (inputError) {
        setError(inputError);
        return;
      }
      const phoneNumber = normalizePhoneNumber(phone, phoneCountry);
      const result = await sendPhoneCode(phoneNumber);
      if (result.success && result.verificationId) {
        router.push({
          pathname: '/(auth)/otp',
          params: { verificationId: result.verificationId, phoneNumber, isLinking: 'true', returnTo: '/profile-setup' },
        });
        // We mark it complete optimistically so it won't show again. OTP handles the rest.
        if (user?.uid) await markContactLinkingComplete(user.uid);
      }
    } else {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) { setError('Please enter your email'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError('Please enter a valid email address'); return; }
      
      const result = await linkEmail(trimmedEmail);
      if (result.success) {
        if (user?.uid) await markContactLinkingComplete(user.uid);
        router.replace('/profile-setup');
      }
    }
  };

  const handleCountrySelect = (country: PhoneCountry) => {
    setPhoneCountry(country);
    setPhone((current) => getLocalPhoneDigits(current, country).slice(0, country.localDigits));
    setError(null);
    clearError();
  };

  const title = needsPhone ? 'Add Your Phone' : 'Add Your Email';
  const subtitle = needsPhone 
    ? 'Enter your phone number to get yourself verified and chat with friends.'
    : 'Enter your email address to receive important updates and account recovery links.';
  const canSubmit = needsPhone 
    ? phone.length > 0 && !loading
    : email.trim().length > 0 && !loading;

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable 
            onPress={async () => {
              try {
                if (signOut) {
                  await signOut();
                }
                router.replace('/(auth)/login');
              } catch (e) {
                console.warn('Logout error:', e);
                router.replace('/(auth)/login');
              }
            }}
            style={({ pressed }) => [s.headerLeft, pressed && { opacity: 0.7 }]}
          >
            <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
          
          <Pressable 
            onPress={handleSkip}
            style={({ pressed }) => [s.skipButton, pressed && { opacity: 0.6 }]}
          >
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.flex1}
        >
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.iconWrapper}>
              <View style={s.iconBg}>
                {needsPhone ? (
                  <Phone size={24} color="#FFFFFF" strokeWidth={2} />
                ) : (
                  <Mail size={24} color="#FFFFFF" strokeWidth={2} />
                )}
              </View>
            </View>
            
            <Text style={s.title}>{title}</Text>
            <Text style={s.subtitle}>{subtitle}</Text>

            {error ? (
              <Text style={s.errorText}>{error}</Text>
            ) : null}

            <View style={s.formContainer}>
              {needsPhone ? (
                <View style={[s.inputGroup, s.inputGroupActive]}>
                  <CountryCodePicker
                    selectedCountry={phoneCountry}
                    onSelect={handleCountrySelect}
                  />
                  <TextInput
                    ref={inputRef}
                    style={s.inputPhone}
                    placeholder="201-555-0123"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    keyboardType="number-pad"
                    textContentType="telephoneNumber"
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text.replace(/[^0-9]/g, ''));
                      if (error) clearError();
                    }}
                    editable={!loading}
                  />
                </View>
              ) : (
                <View style={[s.inputGroup, s.inputGroupActive]}>
                  <TextInput
                    ref={inputRef}
                    style={s.input}
                    placeholder="Enter your email"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (error) clearError();
                    }}
                    editable={!loading}
                  />
                </View>
              )}
            </View>
            
            <View style={s.spacer} />

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[s.nextButton, !canSubmit && s.nextButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.nextButtonText}>Next</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerLeft: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 24,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  inputGroupActive: {
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputPhone: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    paddingVertical: 16,
    marginLeft: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    paddingVertical: 16,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  nextButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
