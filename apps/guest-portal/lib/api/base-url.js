const DEFAULT_GUEST_API_BASE_URL = "http://localhost:4000/api/v1";
const GUEST_API_BASE_ALIASES = [
  "GUEST_API_GATEWAY_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_GATEWAY_URL",
  "PUBLIC_API_URL",
];

function normalizeGuestApiBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withoutTrailingSlash = raw.replace(/\/+$/, "");

  if (/\/api\/v1$/.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api/v1`;
}

export function resolveGuestApiBaseUrl(env = process.env) {
  for (const key of GUEST_API_BASE_ALIASES) {
    if (env?.[key]) {
      return normalizeGuestApiBaseUrl(env[key]);
    }
  }
  return DEFAULT_GUEST_API_BASE_URL;
}

export function resolveGuestApiOrigin(env = process.env) {
  return resolveGuestApiBaseUrl(env).replace(/\/api\/v1$/, "");
}

export function getGuestApiBaseConfig(env = process.env) {
  const matchedKey = GUEST_API_BASE_ALIASES.find((key) => env?.[key]);
  return {
    apiBaseUrl: resolveGuestApiBaseUrl(env),
    origin: resolveGuestApiOrigin(env),
    sourceKey: matchedKey || "default",
  };
}

export { DEFAULT_GUEST_API_BASE_URL, GUEST_API_BASE_ALIASES };
