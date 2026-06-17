import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const loginPageClientPath = path.resolve(process.cwd(), 'app/login/PageClient.jsx');
const profilePageClientPath = path.resolve(process.cwd(), 'app/profile/PageClient.jsx');
const loginPagePath = path.resolve(process.cwd(), 'app/login/page.jsx');
const signupPagePath = path.resolve(process.cwd(), 'app/signup/page.jsx');
const legacyAuthPagePath = path.resolve(process.cwd(), 'app/auth/page.jsx');
const authCallbackPath = path.resolve(process.cwd(), 'app/auth/callback/PageClient.jsx');
const navControlsPath = path.resolve(process.cwd(), 'components/NavControls.tsx');
const mobileBottomNavPath = path.resolve(process.cwd(), 'components/MobileBottomNav.jsx');
const pageWrapperPath = path.resolve(process.cwd(), 'components/PageWrapper.jsx');
const contextualFooterPath = path.resolve(process.cwd(), 'components/ContextualFooter.jsx');
const checkoutContainerPath = path.resolve(process.cwd(), 'components/CheckoutContainer.jsx');
const eventDetailPath = path.resolve(process.cwd(), 'components/EventDetail.jsx');
const ticketPairPath = path.resolve(process.cwd(), 'app/tickets/pair/[token]/PageClient.jsx');
const globalAuthManagerPath = path.resolve(process.cwd(), 'components/GlobalAuthManager.jsx');
const hostFollowCtaPath = path.resolve(process.cwd(), 'components/profile/HostFollowCta.jsx');
const venuePageClientPath = path.resolve(process.cwd(), 'components/venue/VenuePageClient.jsx');
const legacyHostProfileClientPath = path.resolve(
  process.cwd(),
  'app/host/[slug]/HostProfileClient.jsx',
);
const legacyVenueProfileClientPath = path.resolve(
  process.cwd(),
  'app/venue/[slug]/VenueProfileClient.jsx',
);
const HOST_PROFILE_CLIENT_FALLBACK = path.resolve(
  process.cwd(),
  'components/profile/HostFollowCta.jsx',
);
const VENUE_PROFILE_CLIENT_FALLBACK = path.resolve(
  process.cwd(),
  'components/venue/VenuePageClient.jsx',
);

function safeRead(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}
const authProviderPath = path.resolve(process.cwd(), 'components/providers/AuthProvider.jsx');
const authServicePath = path.resolve(process.cwd(), 'lib/authService.js');
const passwordResetPath = path.resolve(process.cwd(), 'lib/auth/passwordReset.js');
const editProfileModalPath = path.resolve(process.cwd(), 'components/EditProfileModal.jsx');
const loginFlowPath = path.resolve(process.cwd(), 'features/auth/hooks/useLoginFlow.js');
const authApiPath = path.resolve(process.cwd(), 'features/auth/api/authApi.js');
const authSessionModelPath = path.resolve(process.cwd(), 'features/auth/utils/authSessionModel.js');
const loginFlowModelPath = path.resolve(process.cwd(), 'features/auth/utils/loginFlowModel.js');
const profileApiPath = path.resolve(process.cwd(), 'features/profile/api/profileApi.js');

test('login page reports form validity before advancing auth flow', () => {
  const source = readFileSync(loginPageClientPath, 'utf8');

  assert.equal(source.includes('formRef.current?.reportValidity()'), true);
});

test('profile client fallback routes signed-out users into login flow', () => {
  const source = readFileSync(profilePageClientPath, 'utf8');

  assert.equal(source.includes("router.replace('/login?next=/profile')"), true);
});

test('logout redirects reuse the canonical login entry after awaiting sign-out', () => {
  const profileSource = readFileSync(
    path.resolve(process.cwd(), 'app/profile/[userId]/PageClient.jsx'),
    'utf8',
  );
  const navSource = readFileSync(navControlsPath, 'utf8');

  assert.equal(profileSource.includes('await logout();'), true);
  assert.equal(profileSource.includes("router.replace(buildLoginUrl('/profile'));"), true);
  assert.equal(profileSource.includes("router.replace('/login');"), false);
  assert.equal(navSource.includes('await logout();'), true);
  assert.equal(navSource.includes("router.replace(buildLoginUrl('/profile'));"), true);
});

test('profile entry links preserve /profile as the return target', () => {
  const desktop = readFileSync(navControlsPath, 'utf8');
  const mobile = readFileSync(mobileBottomNavPath, 'utf8');

  assert.equal(desktop.includes(') : !isAuthPage && !loading ? ('), true);
  assert.equal(desktop.includes('href="/login?next=/profile"'), true);
  assert.equal(mobile.includes("'/login?next=/profile'"), true);
  assert.equal(desktop.includes("const isLoginPage = pathname === '/login';"), true);
  assert.equal(desktop.includes("const isSignupPage = pathname === '/signup';"), true);
  assert.equal(desktop.includes('user && !isAuthPage'), true);
  assert.equal(
    desktop.includes("const authToggleLabel = isSignupPage ? 'Login' : 'Sign Up';"),
    true,
  );
});

test('auth callback redirects onboarding-required users into explicit onboarding mode', () => {
  const source = readFileSync(authCallbackPath, 'utf8');

  assert.equal(source.includes('buildLoginUrl(returnUrl, { onboarding: true })'), true);
  assert.equal(source.includes("getReturnUrl(searchParams, '/profile')"), true);
  assert.equal(source.includes("syncStatus === 'transient_error'"), true);
  assert.equal(source.includes("syncStatus === 'signed_out'"), true);
  assert.equal(source.includes('Retrying your secure session'), true);
});

test('auth flows standardize callback redirects on the next query param', () => {
  const loginSource = readFileSync(loginFlowPath, 'utf8');

  assert.equal(loginSource.includes('buildAuthCallbackUrl(redirectUrl)'), true);
  assert.equal(
    loginSource.includes('await loginWithGoogle(buildAuthCallbackUrl(redirectUrl));'),
    true,
  );
  assert.equal(loginSource.includes('returnUrl='), false);
  assert.equal(loginSource.includes("from '../utils/loginFlowModel'"), true);
  assert.equal(loginSource.includes('resolveAuthMode'), true);
  assert.equal(loginSource.includes('getNextLoginAction'), true);
  assert.equal(loginSource.includes('getCitySelectionAction'), true);
});

test('login page does not server-redirect away when onboarding mode is requested', () => {
  const source = readFileSync(loginPagePath, 'utf8');

  assert.equal(source.includes('getGuestBootstrapFromSession'), false);
  assert.equal(source.includes('redirect('), false);
});

test('signup route reuses the login funnel behind a dedicated /signup URL', () => {
  const source = readFileSync(signupPagePath, 'utf8');

  assert.equal(source.includes("import PageClient from '../login/PageClient';"), true);
  assert.equal(source.includes('getAuthPageRedirect'), false);
});

test('legacy /auth route immediately folds into the canonical /login surface', () => {
  const source = readFileSync(legacyAuthPagePath, 'utf8');

  assert.equal(source.includes("import { redirect } from 'next/navigation';"), true);
  assert.equal(source.includes("'/login'"), true);
  assert.equal(source.includes('redirect(buildLoginRedirect(searchParams));'), true);
});

test('signup route gets the same focused auth shell treatment as login', () => {
  const pageWrapper = readFileSync(pageWrapperPath, 'utf8');
  const footer = readFileSync(contextualFooterPath, 'utf8');
  const mobileNav = readFileSync(mobileBottomNavPath, 'utf8');

  assert.equal(pageWrapper.includes("pathname === '/signup'"), true);
  assert.equal(footer.includes("pathname === '/signup'"), true);
  assert.equal(mobileNav.includes("pathname === '/signup'"), true);
});

test('login client enters onboarding mode from URL state and completes city selection correctly', () => {
  const source = readFileSync(loginFlowPath, 'utf8');
  const pageClientSource = readFileSync(loginPageClientPath, 'utf8');
  const modelSource = readFileSync(loginFlowModelPath, 'utf8');

  assert.equal(modelSource.includes("pathname === '/signup'"), true);
  assert.equal(modelSource.includes("searchParams.get('onboarding') === '1'"), true);
  assert.equal(source.includes('setIsLoginMode(false);'), true);
  assert.equal(source.includes('setIsOnboarding(nextState.isOnboarding);'), true);
  assert.equal(pageClientSource.includes('Continue with Google'), true);
  assert.equal(source.includes('const handleCompleteOnboarding = async (cityOverride) =>'), true);
  assert.equal(source.includes('handleCompleteOnboarding(city);'), true);
  assert.equal(source.includes('router.replace(buildAuthCallbackUrl(redirectUrl))'), true);
  assert.equal(pageClientSource.includes('import AccessGranted'), false);
});

test('login client no longer stores the password in session persistence or treats invalid credentials as signup', () => {
  const source = readFileSync(loginFlowPath, 'utf8');
  const modelSource = readFileSync(loginFlowModelPath, 'utf8');

  assert.equal(modelSource.includes("password: ''"), true);
  assert.equal(
    modelSource.includes("return 'Google sign-in is not enabled for this Firebase project.';"),
    true,
  );
  assert.equal(source.includes('router.push(buildSignupUrl(redirectUrl))'), true);
  assert.equal(source.includes('router.push(buildLoginUrl(redirectUrl))'), true);
  assert.equal(
    modelSource.includes('if (step === 1 && form.email && form.password && !isLoginMode)'),
    true,
  );
  assert.equal(
    modelSource.includes('if (step === 1 && form.email && form.password && isLoginMode)'),
    true,
  );
  assert.equal(source.includes("error?.code === 'auth/user-not-found'"), true);
  assert.equal(modelSource.includes('auth/invalid-credential'), true);
  assert.equal(source.includes('!googleProfile?.phone || !googleProfile?.gender'), false);
  assert.equal(source.includes('googleProfile?.onboardingComplete !== true'), false);
});

test('protected auth redirects use next across guest conversion surfaces', () => {
  const checkoutSource = readFileSync(
    path.resolve(process.cwd(), 'features/checkout/hooks/useCheckoutSession.js'),
    'utf8',
  );
  const checkoutModelSource = readFileSync(
    path.resolve(process.cwd(), 'features/checkout/utils/checkoutSessionModel.js'),
    'utf8',
  );
  const eventSource = readFileSync(
    path.resolve(process.cwd(), 'features/events/hooks/useEventTicketSelection.js'),
    'utf8',
  );
  const pairSource = readFileSync(ticketPairPath, 'utf8');

  assert.equal(checkoutSource.includes('buildGuestLoginRedirect'), true);
  assert.equal(checkoutModelSource.includes('/login?next='), true);
  assert.equal(eventSource.includes('/login?next='), true);
  assert.equal(pairSource.includes('/login?next='), true);
});

test('auth intent replay uses real RSVP and follow gateway mutations', () => {
  const manager = readFileSync(globalAuthManagerPath, 'utf8');
  const hostFollow = readFileSync(hostFollowCtaPath, 'utf8');
  const venueFollow = readFileSync(venuePageClientPath, 'utf8');
  const legacyHostFollow =
    safeRead(legacyHostProfileClientPath) || safeRead(HOST_PROFILE_CLIENT_FALLBACK);
  const legacyVenueFollow =
    safeRead(legacyVenueProfileClientPath) || safeRead(VENUE_PROFILE_CLIENT_FALLBACK);

  assert.equal(
    manager.includes('setEventRsvp'),
    true,
    'GlobalAuthManager must replay RSVP through the event feature seam',
  );
  assert.equal(
    manager.includes('followHost'),
    true,
    'GlobalAuthManager must replay host follow through the social feature seam',
  );
  assert.equal(
    manager.includes('followVenue'),
    true,
    'GlobalAuthManager must replay venue follow through the social feature seam',
  );
  assert.equal(
    manager.includes("intent.type === 'RESERVE_VENUE'"),
    true,
    'GlobalAuthManager must replay venue reservation intents',
  );
  assert.equal(
    manager.includes('OPEN_VENUE_RESERVATION'),
    true,
    'GlobalAuthManager must reopen the venue reservation flow after auth',
  );
  assert.equal(
    manager.includes('updateEventList('),
    false,
    'GlobalAuthManager must not replay RSVP by mutating profile arrays',
  );

  assert.equal(
    hostFollow.includes("saveIntent('FOLLOW_HOST'"),
    true,
    'Host follow CTA should persist host follow intents',
  );
  assert.equal(
    hostFollow.includes('getHostFollowStatus'),
    true,
    'Host follow CTA should use the social feature follow-status seam',
  );
  assert.equal(
    hostFollow.includes('user.uid'),
    false,
    'Host follow CTA should not send client user ids to follow-status',
  );

  assert.equal(
    venueFollow.includes("saveIntent('FOLLOW_VENUE'"),
    true,
    'Venue page should persist venue follow intents',
  );
  assert.equal(
    venueFollow.includes("saveIntent('RESERVE_VENUE'"),
    true,
    'Venue page should persist venue reservation intents',
  );
  assert.equal(
    venueFollow.includes('OPEN_VENUE_RESERVATION'),
    true,
    'Venue page should be able to reopen its reservation modal from auth replay',
  );
  assert.equal(
    venueFollow.includes('getVenueFollowStatus'),
    true,
    'Venue page should use the social feature venue follow seam',
  );

  assert.equal(
    legacyHostFollow.includes('getHostFollowStatus'),
    true,
    'Legacy host profile should use the host follow-status seam',
  );
  assert.equal(
    legacyHostFollow.includes('followHost'),
    true,
    'Legacy host profile should persist host follow actions',
  );
  assert.equal(
    legacyHostFollow.includes('unfollowHost'),
    true,
    'Legacy host profile should persist host unfollow actions',
  );
  assert.equal(
    legacyHostFollow.includes("saveIntent('FOLLOW_HOST'"),
    true,
    'Legacy host profile should persist follow intents for auth replay',
  );

  assert.equal(
    legacyVenueFollow.includes('getVenueFollowStatus'),
    true,
    'Legacy venue profile should use the venue follow-status seam',
  );
  assert.equal(
    legacyVenueFollow.includes('followVenue'),
    true,
    'Legacy venue profile should persist venue follow actions',
  );
  assert.equal(
    legacyVenueFollow.includes('unfollowVenue'),
    true,
    'Legacy venue profile should persist venue unfollow actions',
  );
  assert.equal(
    legacyVenueFollow.includes("saveIntent('FOLLOW_VENUE'"),
    true,
    'Legacy venue profile should persist follow intents for auth replay',
  );
});

test('auth and profile surfaces use typed guest API helpers', () => {
  const authProvider = readFileSync(authProviderPath, 'utf8');
  const authApi = readFileSync(authApiPath, 'utf8');
  const authService = readFileSync(authServicePath, 'utf8');
  const authSessionModel = readFileSync(authSessionModelPath, 'utf8');
  const passwordReset = readFileSync(passwordResetPath, 'utf8');
  const editProfile = readFileSync(editProfileModalPath, 'utf8');
  const profileApi = readFileSync(profileApiPath, 'utf8');

  assert.equal(authProvider.includes('loadGuestBootstrap'), true);
  assert.equal(authProvider.includes('syncStatus'), true);
  assert.equal(authProvider.includes("setSyncStatus('transient_error')"), true);
  assert.equal(authProvider.includes("setSyncStatus('signed_out')"), true);
  assert.equal(authProvider.includes('loginGuest'), true);
  assert.equal(authProvider.includes('registerGuest'), true);
  assert.equal(authProvider.includes('logoutGuest'), true);
  assert.equal(authProvider.includes('updateGuestProfile'), true);
  assert.equal(authProvider.includes('changeGuestPassword'), true);
  assert.equal(
    authProvider.includes('gatewayJson('),
    false,
    'AuthProvider should stay on the typed guest API seam',
  );
  assert.equal(authApi.includes('guestApi.auth.me'), true);
  assert.equal(authApi.includes('guestApi.auth.login'), true);
  assert.equal(authApi.includes('guestApi.auth.register'), true);
  assert.equal(authApi.includes('guestApi.auth.logout'), true);
  assert.equal(authApi.includes("guestBffJson('/profile/update'"), true);
  assert.equal(authApi.includes("isGuestBffEnabled('profile')"), true);
  assert.equal(authApi.includes('guestApi.profiles.personal'), true);
  assert.equal(authApi.includes('guestApi.profiles.social'), true);
  assert.equal(authApi.includes('guestApi.profiles.bio'), true);
  assert.equal(authApi.includes('guestApi.auth.changePassword'), true);
  assert.equal(authSessionModel.includes('normalizeBootstrapPayload'), true);
  assert.equal(authSessionModel.includes('normalizeRegistrationDetails'), true);

  assert.equal(authService.includes('guestApi.auth.sendOtp'), true);
  assert.equal(authService.includes('guestApi.auth.verifyOtp'), true);
  assert.equal(
    authService.includes('gatewayJson('),
    false,
    'authService should stay on the typed guest API seam',
  );

  assert.equal(passwordReset.includes('guestApi.auth.passwordReset'), true);
  assert.equal(
    passwordReset.includes('gatewayJson('),
    false,
    'password reset should stay on the typed guest API seam',
  );

  assert.equal(
    editProfile.includes('useEditProfileFlow'),
    true,
    'edit profile modal should delegate profile orchestration to its feature hook',
  );
  assert.equal(profileApi.includes('guestApi.profiles.avatar'), true);
  assert.equal(
    editProfile.includes('gatewayJson('),
    false,
    'avatar uploads should stay on the typed guest API seam',
  );
});
