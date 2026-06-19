const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
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
warn('external proof required: iOS Razorpay native checkout issues a ticket and QR scans successfully');
warn('external proof required: Android Razorpay native checkout issues a ticket and QR scans successfully');
