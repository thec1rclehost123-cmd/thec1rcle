const PLACEHOLDER_PATTERN = /(your[_-]|placeholder|replace[_-]?me|xxxx|example\.com|localhost|127\.0\.0\.1)/i;
const NON_PRODUCTION_PATTERN = /(^|[._/-])(test|testing|stage|staging|demo|development|local)([._/-]|$)/i;

function validateProductionEnvironment(env) {
  const errors = [];
  const required = [
    'EXPO_PUBLIC_API_BASE_URL',
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    'EXPO_PUBLIC_RAZORPAY_KEY',
    'EXPO_PUBLIC_SENTRY_DSN',
  ];

  for (const name of required) {
    const value = String(env[name] || '').trim();
    if (!value) {
      errors.push(`${name} is missing`);
      continue;
    }
    if (PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`${name} contains a placeholder or local value`);
    }
  }

  if (env.EXPO_PUBLIC_APP_ENV !== 'production') {
    errors.push('EXPO_PUBLIC_APP_ENV must equal production');
  }
  if (env.EXPO_PUBLIC_DEMO_MODE !== 'false') {
    errors.push('EXPO_PUBLIC_DEMO_MODE must equal false');
  }

  const apiUrl = String(env.EXPO_PUBLIC_API_BASE_URL || '');
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.thec1rcle.com') {
      errors.push('EXPO_PUBLIC_API_BASE_URL must use https://api.thec1rcle.com');
    }
  } catch {
    if (apiUrl) errors.push('EXPO_PUBLIC_API_BASE_URL is not a valid URL');
  }

  const razorpayKey = String(env.EXPO_PUBLIC_RAZORPAY_KEY || '');
  if (razorpayKey && !/^rzp_live_[A-Za-z0-9]{8,}$/.test(razorpayKey)) {
    errors.push('EXPO_PUBLIC_RAZORPAY_KEY must be a Razorpay live client key');
  }

  const firebaseProjectId = String(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '');
  if (firebaseProjectId && NON_PRODUCTION_PATTERN.test(firebaseProjectId)) {
    errors.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID identifies a non-production project');
  }

  const sentryDsn = String(env.EXPO_PUBLIC_SENTRY_DSN || '');
  try {
    const parsed = new URL(sentryDsn);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.ingest.sentry.io')) {
      errors.push('EXPO_PUBLIC_SENTRY_DSN must be a valid Sentry ingest DSN');
    }
  } catch {
    if (sentryDsn) errors.push('EXPO_PUBLIC_SENTRY_DSN is not a valid URL');
  }

  const googleClientId = String(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '');
  if (googleClientId && !/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) {
    errors.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not a Google OAuth web client ID');
  }

  return errors;
}

function run(env = process.env) {
  if (env.EAS_BUILD !== 'true' || env.EAS_BUILD_PROFILE !== 'production') {
    console.log('SKIP production environment guard (not an EAS production build)');
    return 0;
  }

  const errors = validateProductionEnvironment(env);
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL ${error}`);
    console.error('Production build rejected: configure the production EAS environment and retry.');
    return 1;
  }

  console.log('OK  production EAS environment contains release-shaped, non-placeholder client configuration');
  console.log('WARN client-side values are public; this check does not prove provider ownership or credential restriction');
  return 0;
}

module.exports = { run, validateProductionEnvironment };

if (require.main === module) {
  process.exitCode = run();
}
