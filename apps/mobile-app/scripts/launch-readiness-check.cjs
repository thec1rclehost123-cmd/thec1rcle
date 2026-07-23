const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractNamedBlock(source, name, startAt = 0) {
  const marker = source.indexOf(`${name} {`, startAt);
  if (marker === -1) return '';
  const open = source.indexOf('{', marker);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return '';
}

function containsPlaceholder(value) {
  return /(rzp_test_|your[_-]|placeholder|replace[_-]?me|xxxx|example\.com|localhost|127\.0\.0\.1)/i.test(String(value));
}

function ok(label) {
  console.log(`OK  ${label}`);
}

function warn(label) {
  console.log(`WARN ${label}`);
}

function fail(label) {
  console.log(`FAIL ${label}`);
  process.exitCode = 1;
}

const appJson = readJson('app.json');
const easJson = readJson('eas.json');
const packageJson = readJson('package.json');

const projectId = appJson.expo?.extra?.eas?.projectId;
if (projectId) {
  ok(`EAS project ID configured: ${projectId}`);
} else {
  fail('EAS project ID missing at expo.extra.eas.projectId');
}

for (const profile of ['preview', 'production']) {
  const env = easJson.build?.[profile]?.env || {};
  if (env.EXPO_PUBLIC_DEMO_MODE === 'false') {
    ok(`${profile} build disables demo mode`);
  } else {
    fail(`${profile} build must set EXPO_PUBLIC_DEMO_MODE=false`);
  }
}

const productionProfile = easJson.build?.production || {};
if (
  productionProfile.environment === 'production' &&
  productionProfile.distribution === 'store' &&
  productionProfile.developmentClient === false &&
  productionProfile.android?.buildType === 'app-bundle' &&
  productionProfile.ios?.simulator === false
) {
  ok('production EAS profile is store-only, non-dev-client, AAB/device configured');
} else {
  fail('production EAS profile must be store-only, non-dev-client, Android app-bundle, and physical-iOS configured');
}

const allowedInlineProductionEnv = new Set(['EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_DEMO_MODE']);
const inlineProductionEnv = productionProfile.env || {};
const unexpectedInlineKeys = Object.keys(inlineProductionEnv).filter((key) => !allowedInlineProductionEnv.has(key));
const unsafeInlineValues = Object.entries(inlineProductionEnv).filter(([, value]) => containsPlaceholder(value));
if (unexpectedInlineKeys.length === 0 && unsafeInlineValues.length === 0) {
  ok('production provider/client values are delegated to the EAS production environment, not embedded in eas.json');
} else {
  fail(`production eas.json embeds release values or placeholders: ${[...unexpectedInlineKeys, ...unsafeInlineValues.map(([key]) => key)].join(', ')}`);
}

if (packageJson.scripts?.['eas-build-post-install'] === 'node scripts/eas-build-production-guard.cjs') {
  ok('EAS production build environment guard is wired');
} else {
  fail('EAS production build must run scripts/eas-build-production-guard.cjs after install');
}

if (packageJson.dependencies?.['expo-application']) {
  ok('native application identity dependency is declared');
} else {
  fail('expo-application must be a direct mobile dependency');
}

const sentrySpecifier = String(packageJson.dependencies?.['@sentry/react-native'] || '');
const sentryVersion = sentrySpecifier.match(/(\d+)\.(\d+)/);
if (
  sentryVersion &&
  (Number(sentryVersion[1]) > 8 || (Number(sentryVersion[1]) === 8 && Number(sentryVersion[2]) >= 8))
) {
  ok('Sentry React Native version includes Expo 55 Metro compatibility fixes');
} else {
  fail(`Sentry React Native ${sentrySpecifier || 'missing'} is below the Expo 55 release-bundling compatibility floor (8.8.x)`);
}

const settingsSource = fs.readFileSync(path.join(root, 'app/settings.tsx'), 'utf8');
const buildIdentitySource = fs.readFileSync(path.join(root, 'lib/buildIdentity.ts'), 'utf8');
if (
  settingsSource.includes('getBuildIdentity') &&
  !settingsSource.includes('value="2117"') &&
  buildIdentitySource.includes('Application.nativeApplicationVersion') &&
  buildIdentitySource.includes('Application.nativeBuildVersion') &&
  buildIdentitySource.includes("appEnvironment === 'production'")
) {
  ok('Settings uses native build identity and flags production mismatches');
} else {
  fail('Settings build identity must come from the native binary with production mismatch checks');
}

if (appJson.expo?.android?.package === 'com.c1rcle.app' && appJson.expo?.ios?.bundleIdentifier === 'com.c1rcle.app') {
  ok('Android application ID and iOS bundle ID are explicitly com.c1rcle.app');
} else {
  fail('release application identity must be com.c1rcle.app on Android and iOS');
}

const releasePluginPath = './plugins/withReleaseHardening.cjs';
const releasePluginSource = readText('plugins/withReleaseHardening.cjs');
if (appJson.expo?.plugins?.includes(releasePluginPath)) {
  ok('tracked Expo release-hardening config plugin is registered');
} else {
  fail(`app.json must register ${releasePluginPath}`);
}

if (
  releasePluginSource.includes('hardenAndroidBuildGradle') &&
  releasePluginSource.includes('signingConfigs\\.debug') &&
  releasePluginSource.includes("tasks.register('verifyReleaseReadiness')") &&
  releasePluginSource.includes("tasks.register('printReleaseReadiness')") &&
  releasePluginSource.includes('C1RCLE_RELEASE_STORE_FILE')
) {
  ok('generated Android release refuses debug signing and exposes credential-safe release gates');
} else {
  fail('tracked config plugin must remove debug release signing and install Android release gates');
}

if (
  releasePluginSource.includes('EX_DEV_CLIENT_NETWORK_INSPECTOR') &&
  releasePluginSource.includes('expo.devlauncher.configureInRelease') &&
  releasePluginSource.includes('expo.devmenu.configureInRelease') &&
  releasePluginSource.includes('expo.useLegacyPackaging') &&
  releasePluginSource.includes('android.permission.SYSTEM_ALERT_WINDOW')
) {
  ok('generated Android release disables dev tools/overlay permission and legacy native packaging');
} else {
  fail('tracked config plugin must harden Android dev-tool and native-packaging settings');
}

if (
  releasePluginSource.includes("mod.modResults['aps-environment'] = 'production'") &&
  releasePluginSource.includes('stripIosDevMetadata') &&
  releasePluginSource.includes("EAS_BUILD_PROFILE === 'production'")
) {
  ok('generated iOS production build uses production APNs source and strips Dev Launcher metadata');
} else {
  fail('tracked config plugin must distinguish iOS production APNs/dev-client metadata from development');
}

const notificationSource = fs.readFileSync(path.join(root, 'lib/notifications.ts'), 'utf8');
if (
  notificationSource.includes('Constants.expoConfig?.extra?.eas?.projectId') &&
  notificationSource.includes('/api/v1/users/me/device-token')
) {
  ok('push token generation uses EAS project ID and device-token route');
} else {
  fail('push token generation must use EAS project ID and /api/v1/users/me/device-token');
}

const paymentsSource = fs.readFileSync(path.join(root, 'lib/payments.ts'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'lib/api.ts'), 'utf8');
for (const needle of ['reserveTickets', 'initiateCheckout', 'verifyPayment']) {
  if (paymentsSource.includes(needle) && apiSource.includes(needle)) {
    ok(`checkout client references ${needle}`);
  } else {
    fail(`checkout client missing ${needle}`);
  }
}
if (apiSource.includes('calculatePricing')) {
  ok('checkout API exposes calculatePricing');
} else {
  fail('checkout API missing calculatePricing');
}

warn('external proof required: EAS credentials show valid iOS APNs key/cert for com.c1rcle.app');
warn('external proof required: EAS credentials show valid Android FCM credential for com.c1rcle.app');
warn('external proof required: physical iOS push receipt and delivered notification captured');
warn('external proof required: physical Android push receipt and delivered notification captured');
warn('external proof required: signed Android AAB proves non-debug upload signing, target API 36, and 16 KB compatibility');
warn('external proof required: Play App Signing certificate and Play Console pre-launch checks pass');
warn('external proof required: full Xcode archive proves Apple Distribution signing and production aps-environment');
warn('external proof required: App Store Connect/TestFlight accepts the iOS archive');
warn('external proof required: physical iOS and Android Razorpay checkout each issue exactly one wallet ticket');
