import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const loginPageClientPath = path.resolve(process.cwd(), "app/login/PageClient.jsx");
const profilePageClientPath = path.resolve(process.cwd(), "app/profile/PageClient.jsx");
const loginPagePath = path.resolve(process.cwd(), "app/login/page.jsx");
const signupPagePath = path.resolve(process.cwd(), "app/signup/page.jsx");
const authCallbackPath = path.resolve(process.cwd(), "app/auth/callback/PageClient.jsx");
const navControlsPath = path.resolve(process.cwd(), "components/NavControls.tsx");
const mobileBottomNavPath = path.resolve(process.cwd(), "components/MobileBottomNav.jsx");
const pageWrapperPath = path.resolve(process.cwd(), "components/PageWrapper.jsx");
const contextualFooterPath = path.resolve(process.cwd(), "components/ContextualFooter.jsx");
const checkoutContainerPath = path.resolve(process.cwd(), "components/CheckoutContainer.jsx");
const eventDetailPath = path.resolve(process.cwd(), "components/EventDetail.jsx");
const ticketPairPath = path.resolve(process.cwd(), "app/tickets/pair/[token]/PageClient.jsx");

test("login page reports form validity before advancing auth flow", () => {
  const source = readFileSync(loginPageClientPath, "utf8");

  assert.equal(source.includes("formRef.current?.reportValidity()"), true);
});

test("profile client fallback routes signed-out users into login flow", () => {
  const source = readFileSync(profilePageClientPath, "utf8");

  assert.equal(source.includes('router.replace("/login?next=/profile")'), true);
});

test("profile entry links preserve /profile as the return target", () => {
  const desktop = readFileSync(navControlsPath, "utf8");
  const mobile = readFileSync(mobileBottomNavPath, "utf8");

  assert.equal(desktop.includes(") : !isAuthPage ? ("), true);
  assert.equal(desktop.includes('href="/login?next=/profile"'), true);
  assert.equal(mobile.includes('"/login?next=/profile"'), true);
  assert.equal(desktop.includes("const isLoginPage = pathname === \"/login\";"), true);
  assert.equal(desktop.includes("const isSignupPage = pathname === \"/signup\";"), true);
  assert.equal(desktop.includes("user && !isAuthPage"), true);
  assert.equal(desktop.includes("const authToggleLabel = isSignupPage ? \"Login\" : \"Sign Up\";"), true);
});

test("auth callback redirects onboarding-required users into explicit onboarding mode", () => {
  const source = readFileSync(authCallbackPath, "utf8");

  assert.equal(source.includes("buildLoginUrl(returnUrl, { onboarding: true })"), true);
});

test("auth flows standardize callback redirects on the next query param", () => {
  const loginSource = readFileSync(loginPageClientPath, "utf8");

  assert.equal(loginSource.includes("buildAuthCallbackUrl(redirectUrl)"), true);
  assert.equal(loginSource.includes("returnUrl="), false);
});

test("login page does not server-redirect away when onboarding mode is requested", () => {
  const source = readFileSync(loginPagePath, "utf8");

  assert.equal(source.includes('searchParams?.onboarding === "1"'), true);
  assert.equal(source.includes("isOnboarding ? null : getAuthPageRedirect"), true);
});

test("signup route reuses the login funnel behind a dedicated /signup URL", () => {
  const source = readFileSync(signupPagePath, "utf8");

  assert.equal(source.includes("import PageClient from '../login/PageClient';"), true);
  assert.equal(source.includes("getAuthPageRedirect"), true);
});

test("signup route gets the same focused auth shell treatment as login", () => {
  const pageWrapper = readFileSync(pageWrapperPath, "utf8");
  const footer = readFileSync(contextualFooterPath, "utf8");
  const mobileNav = readFileSync(mobileBottomNavPath, "utf8");

  assert.equal(pageWrapper.includes('pathname === "/signup"'), true);
  assert.equal(footer.includes('pathname === "/signup"'), true);
  assert.equal(mobileNav.includes('pathname === "/signup"'), true);
});

test("login client enters onboarding mode from URL state and completes city selection correctly", () => {
  const source = readFileSync(loginPageClientPath, "utf8");

  assert.equal(source.includes('const forceSignup = pathname === "/signup"'), true);
  assert.equal(source.includes('const forceOnboarding = searchParams.get("onboarding") === "1";'), true);
  assert.equal(source.includes("setIsLoginMode(false);"), true);
  assert.equal(source.includes("setIsOnboarding(true);"), true);
  assert.equal(source.includes("px-8 pt-8 pb-10"), true);
  assert.equal(source.includes("min-h-[430px] flex flex-col"), true);
  assert.equal(source.includes("className=\"flex flex-1 flex-col space-y-8\""), true);
  assert.equal(source.includes("Choose your city to complete setup."), true);
  assert.equal(source.includes("grid grid-cols-2 gap-3 rounded-[24px]"), true);
  assert.equal(source.includes("const headingEyebrow = step >= 3 ? \"Identity\" : (isLoginMode ? \"Member Access\" : \"Create Account\");"), true);
  assert.equal(source.includes("const primaryActionLabel = step === 1 ? \"Continue\" : \"Continue\";"), true);
  assert.equal(source.includes("const currentProgressStep = isLoginMode ? 1 : Math.min(step - 1, totalSteps);"), true);
  assert.equal(source.includes("Continue with Google"), true);
  assert.equal(source.includes("{step === 1 && !isOnboarding && ("), true);
  assert.equal(source.includes("if (isOnboarding) {"), true);
  assert.equal(source.includes("handleCompleteOnboarding(city)"), true);
  assert.equal(source.includes('router.push("/")'), true);
  assert.equal(source.includes("router.push(redirectUrl)"), true);
  assert.equal(source.includes("import AccessGranted"), false);
  });

test("login client no longer stores the password in session persistence or treats invalid credentials as signup", () => {
  const source = readFileSync(loginPageClientPath, "utf8");

  assert.equal(source.includes('password: ""'), true);
  assert.equal(source.includes('return "Google sign-in is not enabled for this Firebase project."'), true);
  assert.equal(source.includes("router.push(buildSignupUrl(redirectUrl))"), true);
  assert.equal(source.includes("router.push(buildLoginUrl(redirectUrl))"), true);
  assert.equal(source.includes('if (step === 1 && form.email && form.password && !isLoginMode)'), true);
  assert.equal(source.includes('if (step === 1 && form.email && form.password && isLoginMode)'), true);
  assert.equal(source.includes('err?.code === "auth/user-not-found"'), true);
  assert.equal(source.includes('err.code === "auth/invalid-credential"'), false);
  assert.equal(source.includes("!googleProfile?.phone || !googleProfile?.gender"), false);
  assert.equal(source.includes("googleProfile?.onboardingComplete !== true"), true);
});

test("protected auth redirects use next across guest conversion surfaces", () => {
  const checkoutSource = readFileSync(checkoutContainerPath, "utf8");
  const eventSource = readFileSync(eventDetailPath, "utf8");
  const pairSource = readFileSync(ticketPairPath, "utf8");

  assert.equal(checkoutSource.includes("/login?next="), true);
  assert.equal(eventSource.includes("/login?next="), true);
  assert.equal(pairSource.includes("/login?next="), true);
});
