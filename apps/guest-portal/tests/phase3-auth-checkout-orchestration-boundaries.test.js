import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("phase 3 checkout orchestration moves pure decisions into feature models", () => {
  const checkoutHook = read("features/checkout/hooks/useCheckoutSession.js");
  const checkoutModel = read("features/checkout/utils/checkoutSessionModel.js");

  assert.equal(checkoutHook.includes('from "../utils/checkoutSessionModel"'), true);
  assert.equal(checkoutHook.includes("buildCheckoutQuotePayload"), true);
  assert.equal(checkoutHook.includes("isReservationActive"), true);
  assert.equal(checkoutHook.includes("applyTicketQuantityDelta"), true);
  assert.equal(checkoutHook.includes("buildReserveCheckoutPayload"), true);
  assert.equal(checkoutHook.includes("buildInitiateCheckoutPayload"), true);

  assert.equal(checkoutModel.includes("isReservationActive"), true);
  assert.equal(checkoutModel.includes("shouldUseSavedReservationQuote"), true);
  assert.equal(checkoutModel.includes("buildGuestLoginRedirect"), true);
  assert.equal(checkoutModel.includes("mergeAttendeeDetails"), true);
});

test("phase 3 auth orchestration moves provider and flow decisions behind feature seams", () => {
  const loginFlow = read("features/auth/hooks/useLoginFlow.js");
  const loginFlowModel = read("features/auth/utils/loginFlowModel.js");
  const authProvider = read("components/providers/AuthProvider.jsx");
  const authApi = read("features/auth/api/authApi.js");
  const authSessionModel = read("features/auth/utils/authSessionModel.js");

  assert.equal(loginFlow.includes('from "../utils/loginFlowModel"'), true);
  assert.equal(loginFlow.includes("resolveAuthMode"), true);
  assert.equal(loginFlow.includes("buildCleanAuthForm"), true);
  assert.equal(loginFlow.includes("getNextLoginAction"), true);
  assert.equal(loginFlow.includes("getCitySelectionAction"), true);
  assert.equal(loginFlow.includes("shouldRedirectAuthenticatedUser"), true);

  assert.equal(loginFlowModel.includes("resolveAuthMode"), true);
  assert.equal(loginFlowModel.includes("getPostLoginState"), true);
  assert.equal(loginFlowModel.includes("getCurrentProgressStep"), true);

  assert.equal(authProvider.includes("loadGuestBootstrap"), true);
  assert.equal(authProvider.includes("loginGuest"), true);
  assert.equal(authProvider.includes("registerGuest"), true);
  assert.equal(authProvider.includes("logoutGuest"), true);
  assert.equal(authProvider.includes("updateGuestProfile"), true);
  assert.equal(authProvider.includes("changeGuestPassword"), true);
  assert.equal(authProvider.includes("guestApi.auth.login"), false);
  assert.equal(authProvider.includes("guestApi.auth.me"), false);

  assert.equal(authApi.includes("guestApi.auth.me"), true);
  assert.equal(authApi.includes("guestApi.auth.login"), true);
  assert.equal(authApi.includes("guestApi.auth.register"), true);
  assert.equal(authApi.includes("guestApi.profiles.personal"), true);
  assert.equal(authApi.includes("guestApi.profiles.social"), true);
  assert.equal(authApi.includes("guestApi.profiles.bio"), true);

  assert.equal(authSessionModel.includes("normalizeBootstrapPayload"), true);
  assert.equal(authSessionModel.includes("normalizeRegistrationDetails"), true);
  assert.equal(authSessionModel.includes("buildUpdatedEventList"), true);
});
