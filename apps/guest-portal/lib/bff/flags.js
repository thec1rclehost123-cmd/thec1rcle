const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function readFlag(env, key) {
  const value = env?.[key];
  if (value === undefined || value === null) return false;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

export function getGuestBffFlags(env = process.env) {
  const enableAll = readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_ALL");

  return {
    enableAll,
    parity:
      readFlag(env, "GUEST_BFF_PARITY_LOGGING") ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_PARITY_LOGGING"),
    home:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_HOME"),
    tickets:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_TICKETS"),
    eventDetail:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_EVENT_DETAIL"),
    checkout:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_CHECKOUT"),
    confirmation:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_CONFIRMATION"),
    profile:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_PROFILE"),
    notifications:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_NOTIFICATIONS"),
    explore:
      enableAll ||
      readFlag(env, "NEXT_PUBLIC_GUEST_BFF_ENABLE_EXPLORE"),
  };
}

export function isGuestBffEnabled(surface, env = process.env) {
  const flags = getGuestBffFlags(env);
  return Boolean(flags?.[surface]);
}
