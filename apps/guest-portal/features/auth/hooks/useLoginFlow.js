'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../components/providers/AuthProvider';
import { useToast } from '../../../components/providers/ToastProvider';
import {
  buildAuthCallbackUrl,
  buildLoginUrl,
  buildSignupUrl,
  getReturnUrl,
} from '../../../lib/auth/guestRouteAccess';
import { sendGuestOtp, verifyGuestOtp } from '../api/authApi';
import {
  baseAuthForm,
  buildCleanAuthForm,
  getCitySelectionAction,
  getCurrentProgressStep,
  getHeadingEyebrow,
  getLoginErrorMessage,
  getNextLoginAction,
  getPostLoginState,
  getPreviousLoginStep,
  resolveAuthMode,
  shouldRedirectAuthenticatedUser,
} from '../utils/loginFlowModel';
import { clearSessionPersistence, useOnboardingDraft } from './useOnboardingDraft';

export function useLoginFlow() {
  const {
    error: authError,
    loading,
    login,
    loginWithGoogle,
    register,
    updateUserProfile,
    user,
  } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { forceOnboarding, forceSignup, initialLoginMode } = useMemo(
    () => resolveAuthMode(pathname, searchParams),
    [pathname, searchParams],
  );

  const [isLoginMode, setIsLoginMode] = useState(() => initialLoginMode);
  const { form, isNewUser, isOnboarding, setForm, setIsNewUser, setIsOnboarding, setStep, step } =
    useOnboardingDraft({
      baseForm: baseAuthForm,
      forceOnboarding,
      initialLoginMode: isLoginMode,
    });

  const [status, setStatus] = useState({ message: '', type: '' });
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);
  const socialNameApplied = useRef(false);

  // Pre-populate name from Google/social displayName on onboarding entry
  useEffect(() => {
    if (socialNameApplied.current) return;
    if (!isOnboarding && !forceOnboarding) return;
    const socialName = user?.displayName;
    if (!socialName) return;
    socialNameApplied.current = true;
    setForm((prev) => (prev.name ? prev : { ...prev, name: socialName }));
  }, [isOnboarding, forceOnboarding, user?.displayName]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const redirectUrl = useMemo(() => getReturnUrl(searchParams), [searchParams]);

  useEffect(() => {
    if (!forceOnboarding) return;
    setIsLoginMode(false);
  }, [forceOnboarding]);

  useEffect(() => {
    if (forceOnboarding || !forceSignup) return;
    setIsLoginMode(false);
  }, [forceOnboarding, forceSignup]);

  const redirectingRef = useRef(false);
  useEffect(() => {
    if (redirectingRef.current) return;
    if (shouldRedirectAuthenticatedUser({ user, loading, isNewUser, isOnboarding, step })) {
      redirectingRef.current = true;
      router.replace(buildAuthCallbackUrl(redirectUrl));
    }
  }, [isNewUser, isOnboarding, loading, redirectUrl, router, step, user]);

  useEffect(() => {
    if (authError && step < 3) {
      setStatus({ message: authError, type: 'error' });
    }
  }, [authError, step]);

  const cleanForm = useMemo(() => buildCleanAuthForm(form), [form]);

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setStatus({ message: '', type: '' });
    try {
      await loginWithGoogle(buildAuthCallbackUrl(redirectUrl));
    } catch (error) {
      console.error('Google Auth error:', error);
      setStatus({ message: getLoginErrorMessage(error), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitialAuth = async () => {
    setSubmitting(true);
    try {
      const { profile: loadedProfile } = await login(cleanForm.email, form.password, true);
      const nextState = getPostLoginState(loadedProfile);
      if (nextState) {
        setIsLoginMode(nextState.isLoginMode);
        setIsNewUser(nextState.isNewUser);
        setIsOnboarding(nextState.isOnboarding);
        setStep(nextState.step);
      }
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        setIsLoginMode(false);
        setIsNewUser(true);
        setStatus({
          message: 'No account found. Enter a password to create your access.',
          type: 'info',
        });
      } else {
        setStatus({ message: getLoginErrorMessage(error), type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartRegistration = async () => {
    setSubmitting(true);
    setStatus({ message: '', type: '' });
    try {
      if (!form.password || form.password.length < 6) {
        throw new Error('Password is required. Please go back to step 1 and re-enter.');
      }
      await sendGuestOtp('phone', cleanForm.phone);
      setStep(8);
    } catch (error) {
      setStatus({ message: error.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizeRegistration = async () => {
    setSubmitting(true);
    if (!form.password || form.password.length < 8) {
      setStatus({
        message: 'Password must be at least 8 characters long. Please go back to step 1.',
        type: 'error',
      });
      setSubmitting(false);
      return;
    }

    try {
      await register(cleanForm.email, form.password, {
        age: parseInt(form.age, 10),
        city: form.city,
        displayName: form.name.trim(),
        gender: form.gender,
        onboardingComplete: true,
        phone: cleanForm.phone,
      });
      clearSessionPersistence();
      router.replace(buildAuthCallbackUrl(redirectUrl));
    } catch (error) {
      setStatus({ message: error.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteOnboarding = async (cityOverride) => {
    setSubmitting(true);
    try {
      await updateUserProfile({
        age: form.age,
        city: cityOverride ?? form.city,
        displayName: form.name || user?.displayName || 'Member',
        gender: form.gender,
        onboardingComplete: true,
        phone: cleanForm.phone,
      });
      clearSessionPersistence();
      setIsOnboarding(false);
      router.replace(buildAuthCallbackUrl(redirectUrl));
    } catch (error) {
      setStatus({ message: error.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = async () => {
    setStatus({ message: '', type: '' });

    if (step === 3) {
      const cleanPhone = (form.phone || '').replace(/\D/g, '');
      if (form.country === 'IN') {
        if (cleanPhone.length !== 10) {
          setStatus({ message: 'Phone number must contain exactly 10 digits.', type: 'error' });
          return;
        }
      } else {
        if (cleanPhone.length < 8 || cleanPhone.length > 15) {
          setStatus({ message: 'Phone number must be between 8 and 15 digits.', type: 'error' });
          return;
        }
      }
    }

    const nextAction = getNextLoginAction({ form, isLoginMode, isNewUser, step });

    if (nextAction.type === 'begin_registration') {
      setIsNewUser(true);
      setStep(nextAction.step);
      return;
    }

    if (nextAction.type === 'resolve_login') {
      await handleInitialAuth();
      return;
    }

    if (nextAction.type === 'advance') {
      setStep(nextAction.step);
      return;
    }

    if (nextAction.type === 'start_registration') {
      await handleStartRegistration();
      return;
    }

    if (nextAction.type === 'complete_onboarding') {
      await handleCompleteOnboarding(nextAction.city);
    }
  };

  const prevStep = () => {
    const previousStep = getPreviousLoginStep(step);
    if (previousStep === null) {
      router.back();
      return;
    }
    setStep(previousStep);
  };

  const handleCitySelect = (city) => {
    setForm((previous) => ({ ...previous, city }));
    const nextAction = getCitySelectionAction({ city, isNewUser, isOnboarding });
    if (nextAction.type === 'complete_onboarding') {
      setTimeout(() => {
        void handleCompleteOnboarding(city);
      }, 150);
      return;
    }
    if (nextAction.type === 'start_registration') {
      setTimeout(() => {
        void handleStartRegistration();
      }, 150);
    }
  };

  const handleVerify = async (type, code) => {
    if (type === 'final') return handleFinalizeRegistration();
    return verifyGuestOtp('phone', cleanForm.phone, code);
  };

  const handleResend = async (type) => {
    try {
      const recipient = type === 'phone' ? cleanForm.phone : cleanForm.email;
      await sendGuestOtp(type, recipient);
      toast?.({ description: 'Check your phone.', title: 'Code sent' });
    } catch (error) {
      toast?.({ description: error.message, title: 'Send failed', variant: 'destructive' });
    }
  };

  return {
    cleanForm,
    currentProgressStep: getCurrentProgressStep({ isLoginMode, step }),
    form,
    formRef,
    handleChange: (field) => (event) => {
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
    },
    handleCitySelect,
    handleGoogleLogin,
    handleResend,
    handleVerify,
    headingEyebrow: getHeadingEyebrow({ isLoginMode, step }),
    isLoginMode,
    isOnboarding,
    mounted,
    nextStep,
    prevStep,
    primaryActionLabel: 'Continue',
    setForm,
    setStep,
    status,
    step,
    submitting,
    toggleMode: () => {
      setStatus({ message: '', type: '' });
      clearSessionPersistence();
      if (isLoginMode) {
        router.push(buildSignupUrl(redirectUrl));
        return;
      }
      router.push(buildLoginUrl(redirectUrl));
    },
    totalSteps: 7,
  };
}
