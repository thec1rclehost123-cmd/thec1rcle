"use client";

import { getApiErrorMessage, guestApi } from "../../../lib/api/client";
import { authService } from "../../../lib/authService";

const PROFILE_MUTATION_GROUPS = [
  {
    fields: ["displayName", "age", "gender", "city", "phone", "phoneNumber", "onboardingComplete"],
    request: (body) => guestApi.profiles.personal(body),
  },
  {
    fields: ["instagram", "handle", "username"],
    request: (body) => guestApi.profiles.social(body),
  },
  {
    fields: ["bio"],
    request: (body) => guestApi.profiles.bio(body),
  },
  {
    fields: ["photoURL", "avatar"],
    request: (body) => guestApi.profiles.avatarUpdate(body),
  },
];

async function request(requestFn, fallbackMessage) {
  const { response, data } = await requestFn();
  if (!response.ok) {
    const nextError = new Error(getApiErrorMessage(data, fallbackMessage));
    nextError.code = data?.error?.code;
    throw nextError;
  }
  return data;
}

export async function checkGuestEmail(email) {
  return request(() => guestApi.auth.check({ email }), "Unable to verify email");
}

export async function loadGuestBootstrap() {
  const { response, data } = await guestApi.auth.me();
  if (response.status === 401) return null;
  if (!response.ok) {
    const nextError = new Error(getApiErrorMessage(data, "Unable to load your session."));
    nextError.status = response.status;
    nextError.code = data?.error?.code || data?.error?.message || "AUTH_BOOTSTRAP_FAILED";
    throw nextError;
  }
  return data;
}

export function loginGuest({ email, password, rememberMe = true }) {
  return request(
    () => guestApi.auth.login({ email, password, rememberMe }),
    "Unable to sign in right now.",
  );
}

export function registerGuest({ email, password, details }) {
  const displayName = details.displayName || details.name;
  return request(
    () => guestApi.auth.register({
      email,
      password,
      displayName,
      gender: details.gender,
      age: details.age !== undefined ? parseInt(details.age, 10) || details.age : undefined,
      phone: details.phone,
      city: details.city,
      instagram: details.instagram,
      onboardingComplete: details.onboardingComplete === true,
    }),
    "Unable to create your account.",
  );
}

export function logoutGuest() {
  return request(() => guestApi.auth.logout(), "Unable to sign out right now.");
}

function pickProfileUpdates(source, fields) {
  const next = {};
  for (const field of fields) {
    if (source?.[field] !== undefined) {
      next[field] = source[field];
    }
  }
  return next;
}

export async function updateGuestProfile(updates) {
  const remaining = new Set(Object.keys(updates || {}).filter((key) => updates[key] !== undefined));
  const requests = [];

  for (const group of PROFILE_MUTATION_GROUPS) {
    const payload = pickProfileUpdates(updates, group.fields);
    const fields = Object.keys(payload);
    if (fields.length === 0) continue;
    fields.forEach((field) => remaining.delete(field));
    requests.push(() => request(() => group.request(payload), "Unable to update profile."));
  }

  if (remaining.size > 0) {
    throw new Error(`Unsupported profile fields: ${Array.from(remaining).join(", ")}`);
  }

  if (requests.length === 0) {
    return { success: true };
  }

  const results = await Promise.all(requests.map((run) => run()));
  return results.at(-1) || { success: true };
}

export function changeGuestPassword({ currentPassword, newPassword }) {
  return request(
    () => guestApi.auth.changePassword({ currentPassword, newPassword }),
    "Unable to change password.",
  );
}

export function buildGoogleAuthStartUrl(next) {
  return `/api/v1/auth/google/start?next=${encodeURIComponent(next)}`;
}

export function sendGuestOtp(type, recipient) {
  return authService.sendOtp(type, recipient);
}

export function verifyGuestOtp(type, recipient, code) {
  return authService.verifyOtp(type, recipient, code);
}
