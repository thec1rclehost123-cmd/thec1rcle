import { getGuestBffFlags } from './flags.js';

function safeStableStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildDiffSummary(legacyData, bffData) {
  const keys = new Set([...Object.keys(legacyData || {}), ...Object.keys(bffData || {})]);
  const changedKeys = [];

  for (const key of keys) {
    if (safeStableStringify(legacyData?.[key]) !== safeStableStringify(bffData?.[key])) {
      changedKeys.push(key);
    }
  }

  return {
    changedKeysSample: changedKeys.slice(0, 10),
    totalChangedKeys: changedKeys.length,
  };
}

export function logGuestBffParity(surface, legacyData, bffData, context = {}) {
  if (!getGuestBffFlags(process.env).parity) return;

  console.info('[guest-bff-parity]', {
    diff: buildDiffSummary(legacyData, bffData),
    context,
    legacyData,
    bffData,
    surface,
  });
}
