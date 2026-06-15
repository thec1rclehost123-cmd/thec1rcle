/**
 * THE C1RCLE - Secret Registry
 * Centralized authority for runtime secrets with hard-fail assertions.
 */

function requireRuntimeSecret(name, developmentFallback) {
  const value = process.env[name];
  if (value) return value;

  const env = process.env.NODE_ENV || 'development';
  if (env === 'development' || env === 'test') {
    console.warn(
      `[SECURITY WARNING] Missing ${name} - using development fallback. DO NOT USE IN PRODUCTION.`,
    );
    return developmentFallback;
  }

  // Hard-fail in production/staging
  throw new Error(
    `CRITICAL SECURITY FAILURE: ${name} environment variable is required in ${env} mode.`,
  );
}

export function getQrSecret() {
  return requireRuntimeSecret('QR_SECRET', 'dev-only-qr-secret-123');
}

export function getTicketSecret() {
  return requireRuntimeSecret('TICKET_SECRET', 'dev-only-ticket-secret-456');
}

export function getScanSecret() {
  return requireRuntimeSecret('SCAN_SECRET', 'dev-only-scan-secret-789');
}

export default {
  getQrSecret,
  getTicketSecret,
  getScanSecret,
};
