'use client';

import { useEffect, useState } from 'react';

const SESSION_KEYS = {
  step: 'c1_auth_step',
  form: 'c1_auth_form',
  isNewUser: 'c1_auth_isNewUser',
  isOnboarding: 'c1_auth_isOnboarding',
};

function readSession(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value !== null ? value : fallback;
  } catch {
    return fallback;
  }
}

export function clearSessionPersistence() {
  Object.values(SESSION_KEYS).forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  });
}

export function getPersistedForm(form) {
  return {
    ...form,
    password: '',
  };
}

export function useOnboardingDraft({ baseForm, forceOnboarding, initialLoginMode }) {
  const [form, setForm] = useState(() => {
    const saved = readSession(SESSION_KEYS.form, null);
    if (!saved) return baseForm;
    try {
      return { ...baseForm, ...JSON.parse(saved), password: '' };
    } catch {
      return baseForm;
    }
  });
  const [step, setStep] = useState(() => {
    const savedStep = Number.parseInt(readSession(SESSION_KEYS.step, '1'), 10);
    if (forceOnboarding) {
      return Number.isNaN(savedStep) || savedStep < 3 ? 3 : savedStep;
    }
    return Number.isNaN(savedStep) ? 1 : savedStep;
  });
  const [isNewUser, setIsNewUser] = useState(
    () => readSession(SESSION_KEYS.isNewUser, 'false') === 'true',
  );
  const [isOnboarding, setIsOnboarding] = useState(
    () => forceOnboarding || readSession(SESSION_KEYS.isOnboarding, 'false') === 'true',
  );

  useEffect(() => {
    if (!forceOnboarding) return;
    setIsNewUser(false);
    setIsOnboarding(true);
    setStep((current) => (current < 3 ? 3 : current));
  }, [forceOnboarding, initialLoginMode]);

  useEffect(() => {
    if (step <= 2 || (!isNewUser && !isOnboarding)) return;
    try {
      window.localStorage.setItem(SESSION_KEYS.step, String(step));
      window.localStorage.setItem(SESSION_KEYS.isNewUser, String(isNewUser));
      window.localStorage.setItem(SESSION_KEYS.isOnboarding, String(isOnboarding));
      window.localStorage.setItem(SESSION_KEYS.form, JSON.stringify(getPersistedForm(form)));
    } catch {}
  }, [form, isNewUser, isOnboarding, step]);

  return {
    form,
    isNewUser,
    isOnboarding,
    setForm,
    setIsNewUser,
    setIsOnboarding,
    setStep,
    step,
  };
}
