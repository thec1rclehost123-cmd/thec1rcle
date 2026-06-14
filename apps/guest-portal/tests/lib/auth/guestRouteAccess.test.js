import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAuthCallbackUrl,
  buildLoginUrl,
  buildSignupUrl,
  getAuthPageRedirect,
  getProfileEntryRedirect,
  getReturnUrl,
  shouldRouteCallbackToOnboarding,
} from "../../../lib/auth/guestRouteAccess.js";

test("getReturnUrl preserves the supported auth redirect params", () => {
  assert.equal(getReturnUrl({ next: "/profile" }), "/profile");
  assert.equal(getReturnUrl({ returnUrl: "/tickets" }), "/tickets");
  assert.equal(getReturnUrl({ redirect: "/checkout/event_1" }), "/checkout/event_1");
  assert.equal(getReturnUrl({ next: "https://evil.example" }), "/profile");
  assert.equal(getReturnUrl({}), "/profile");
});

test("getAuthPageRedirect redirects completed authenticated guests away from auth pages", () => {
  const redirect = getAuthPageRedirect({
    routeAccess: { shouldRedirectFromAuthPages: true },
  }, "/profile");

  assert.equal(redirect, "/auth/callback?next=%2Fprofile");
});

test("getAuthPageRedirect keeps incomplete guests on the auth/onboarding surface", () => {
  const redirect = getAuthPageRedirect({
    routeAccess: { shouldRedirectFromAuthPages: false },
  }, "/profile");

  assert.equal(redirect, null);
});

test("getProfileEntryRedirect sends signed-out users to login and signed-in users to their profile", () => {
  assert.equal(getProfileEntryRedirect(null), "/login?next=%2Fprofile");
  assert.equal(getProfileEntryRedirect({ identity: { uid: "user_1" } }), "/profile/user_1");
});

test("auth URL builders standardize on the next query param", () => {
  assert.equal(buildAuthCallbackUrl("/tickets"), "/auth/callback?next=%2Ftickets");
  assert.equal(buildLoginUrl("/profile", { onboarding: true }), "/login?next=%2Fprofile&onboarding=1");
  assert.equal(buildSignupUrl("/profile"), "/signup?next=%2Fprofile");
});

test("shouldRouteCallbackToOnboarding uses canonical bootstrap first with profile compatibility fallback", () => {
  assert.equal(
    shouldRouteCallbackToOnboarding({
      bootstrap: { routeAccess: { requiresOnboarding: true } },
      profile: { onboardingComplete: true },
    }),
    true,
  );

  assert.equal(
    shouldRouteCallbackToOnboarding({
      bootstrap: null,
      profile: { onboardingComplete: false },
    }),
    true,
  );

  assert.equal(
    shouldRouteCallbackToOnboarding({
      bootstrap: { routeAccess: { requiresOnboarding: false } },
      profile: { onboardingComplete: true },
    }),
    false,
  );
});
