import { countries } from '../../../lib/data/countries';

export const baseAuthForm = {
  age: '',
  city: '',
  country: 'IN',
  email: '',
  gender: '',
  name: '',
  password: '',
  phone: '',
};

export function getLoginErrorMessage(error) {
  switch (error?.code) {
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google sign-in.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account found for this email.';
    case 'auth/too-many-requests':
      return 'Too many login attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return error?.message || 'Unable to sign in right now.';
  }
}

export function resolveAuthMode(pathname, searchParams) {
  const forceOnboarding = searchParams.get('onboarding') === '1';
  const forceSignup =
    pathname === '/signup' ||
    searchParams.get('mode') === 'signup' ||
    searchParams.get('mode') === 'register';

  return {
    forceOnboarding,
    forceSignup,
    initialLoginMode: !forceOnboarding && !forceSignup,
  };
}

export function buildCleanAuthForm(form) {
  const dialCode = countries.find((country) => country.code === form.country)?.dialCode || '';

  return {
    ...form,
    email: form.email.toLowerCase().trim(),
    phone: `${dialCode}${form.phone.trim().replace(/^0+/, '')}`,
  };
}

export function shouldRedirectAuthenticatedUser({ isNewUser, isOnboarding, loading, step, user }) {
  return Boolean(user && !loading && !isNewUser && !isOnboarding && step < 7);
}

export function getPostLoginState(profile) {
  if (profile?.onboardingComplete === true) return null;
  return {
    isLoginMode: false,
    isNewUser: false,
    isOnboarding: true,
    step: 3,
  };
}

export function getNextLoginAction({ form, isLoginMode, isNewUser, step }) {
  if (step === 1 && form.email && form.password && !isLoginMode) {
    return { type: 'begin_registration', step: 3 };
  }

  if (step === 1 && form.email && form.password && isLoginMode) {
    return { type: 'resolve_login' };
  }

  if (isLoginMode) {
    return { type: 'idle' };
  }

  if (step === 3 && form.phone) {
    return { type: 'advance', step: 4 };
  }
  if (step === 4 && form.name) {
    return { type: 'advance', step: 5 };
  }
  if (step === 5 && form.age) {
    return { type: 'advance', step: 6 };
  }
  if (step === 6 && form.gender) {
    return { type: 'advance', step: 7 };
  }
  if (step === 7 && form.city) {
    return {
      type: isNewUser ? 'start_registration' : 'complete_onboarding',
      city: form.city,
    };
  }

  return { type: 'idle' };
}

export function getPreviousLoginStep(step) {
  if (step === 1) return null;
  return step === 3 ? 1 : step - 1;
}

export function getCitySelectionAction({ city, isNewUser, isOnboarding }) {
  if (isOnboarding) {
    return { type: 'complete_onboarding', city };
  }
  if (isNewUser) {
    return { type: 'start_registration', city };
  }
  return { type: 'idle', city };
}

export function getHeadingEyebrow({ isLoginMode, step }) {
  if (step >= 3) return 'Personal Details';
  return isLoginMode ? 'Sign In' : 'Sign Up';
}

export function getCurrentProgressStep({ isLoginMode, step }) {
  return isLoginMode ? 1 : Math.min(step - 1, 7);
}
