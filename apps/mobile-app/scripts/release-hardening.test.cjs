const assert = require('node:assert/strict');
const test = require('node:test');

const releasePlugin = require('../plugins/withReleaseHardening.cjs');
const { validateProductionEnvironment } = require('./eas-build-production-guard.cjs');

test('Android release hardening removes only release debug signing', () => {
  const source = `android {
  buildTypes {
    debug { signingConfig signingConfigs.debug }
    release {
      signingConfig signingConfigs.debug
      minifyEnabled true
    }
  }
}`;

  const result = releasePlugin.hardenAndroidBuildGradle(source);
  assert.match(result, /debug \{ signingConfig signingConfigs\.debug \}/);
  assert.doesNotMatch(result, /release \{[^}]*signingConfig signingConfigs\.debug/);
  assert.match(result, /apply from: '\.\/release-hardening\.gradle'/);
});

test('production Android manifest strips dev overlay permission and Expo scheme', () => {
  const manifest = {
    'uses-permission': [
      { $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW' } },
      { $: { 'android:name': 'android.permission.INTERNET' } },
    ],
    application: [{
      activity: [{
        'intent-filter': [{
          data: [
            { $: { 'android:scheme': 'c1rcle' } },
            { $: { 'android:scheme': 'exp+thec1rcle' } },
          ],
        }],
      }],
    }],
  };

  releasePlugin.stripAndroidDevMetadata(manifest);
  assert.deepEqual(manifest['uses-permission'].map((entry) => entry.$['android:name']), [
    'android.permission.INTERNET',
  ]);
  assert.deepEqual(
    manifest.application[0].activity[0]['intent-filter'][0].data.map((entry) => entry.$['android:scheme']),
    ['c1rcle'],
  );
});

test('production iOS plist strips only Expo Dev Launcher metadata', () => {
  const infoPlist = {
    NSBonjourServices: ['_expo._tcp', '_custom._tcp'],
    NSLocalNetworkUsageDescription: 'Expo Dev Launcher uses local networking',
    CFBundleURLTypes: [{ CFBundleURLSchemes: ['c1rcle', 'exp+thec1rcle'] }],
  };

  releasePlugin.stripIosDevMetadata(infoPlist);
  assert.deepEqual(infoPlist.NSBonjourServices, ['_custom._tcp']);
  assert.equal(infoPlist.NSLocalNetworkUsageDescription, undefined);
  assert.deepEqual(infoPlist.CFBundleURLTypes[0].CFBundleURLSchemes, ['c1rcle']);
});

test('production environment guard rejects test and placeholder provider values', () => {
  const errors = validateProductionEnvironment({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_DEMO_MODE: 'false',
    EXPO_PUBLIC_RAZORPAY_KEY: 'rzp_test_fixture',
    EXPO_PUBLIC_SENTRY_DSN: 'https://YOUR_DSN@oXXXX.ingest.sentry.io/XXXXXX',
  });

  assert(errors.includes('EXPO_PUBLIC_RAZORPAY_KEY must be a Razorpay live client key'));
  assert(errors.some((error) => error.startsWith('EXPO_PUBLIC_SENTRY_DSN contains a placeholder')));
  assert(errors.some((error) => error.endsWith('is missing')));
});
