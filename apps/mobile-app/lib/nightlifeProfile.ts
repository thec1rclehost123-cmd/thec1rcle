export const NIGHTLIFE_VIBE_OPTIONS = [
  'Techno',
  'House',
  'Hip Hop',
  'R&B',
  'Afrobeats',
  'Bollywood',
  'Live Music',
  'Raves',
  'Dive Bars',
  'Lounge',
  'Warehouse Parties',
  'Afterparties',
  'Concerts',
  'Festivals',
  'Underground',
] as const;

export const NIGHTLIFE_PRONOUN_OPTIONS = [
  'He/Him',
  'She/Her',
  'They/Them',
  'Other',
  'Prefer not to say',
] as const;

export const NIGHTLIFE_LIFESTYLE_OPTIONS = [
  'Social Drinker',
  'Drinks & Smokes',
  'Sober',
  '420 Friendly',
  'Prefer not to say',
] as const;

export const NIGHTLIFE_HEIGHT_OPTIONS = Array.from(
  { length: (7 - 4) * 12 + 1 },
  (_, index) => {
    const feet = Math.floor(index / 12) + 4;
    const inches = index % 12;
    return `${feet}'${inches}"`;
  },
);

export const NIGHTLIFE_EDITOR_MODE_EDIT = 'edit' as const;

export function isNightlifeDraftOwnedBy(
  userId: string | null | undefined,
  ownerUserId: string | null | undefined,
): boolean {
  return Boolean(userId && ownerUserId === userId);
}

type NightlifeEditorModeOptions = {
  routeMode?: string | string[];
  datingActive?: boolean;
};

/**
 * Settings records the active-profile decision in the route. That decision
 * remains authoritative if a later partial profile hydration omits
 * `datingActive`. Legacy edit links still fall back to the profile flag.
 */
export function isActiveNightlifeProfileEditor({
  routeMode,
  datingActive,
}: NightlifeEditorModeOptions): boolean {
  const normalizedRouteMode = Array.isArray(routeMode) ? routeMode[0] : routeMode;
  return normalizedRouteMode === NIGHTLIFE_EDITOR_MODE_EDIT || datingActive === true;
}

type NightlifeProfileUpdater = (
  userId: string,
  updates: { datingActive: false },
) => Promise<boolean>;

type PauseNightlifeProfileOptions = {
  userId: string;
  updateProfile: NightlifeProfileUpdater;
  getStoreError?: () => string | null;
};

export type PauseNightlifeProfileResult =
  | { ok: true }
  | { ok: false; error: string };

const PAUSE_NIGHTLIFE_FALLBACK_ERROR =
  'Your Nightlife profile could not be paused. Please check your connection and try again.';

/**
 * Pauses visibility without replacing any saved Nightlife profile fields.
 * Keeping this transition narrow is what preserves photos, prompts, vitals,
 * and preferences for a later re-enable.
 */
export async function pauseActiveNightlifeProfile({
  userId,
  updateProfile,
  getStoreError,
}: PauseNightlifeProfileOptions): Promise<PauseNightlifeProfileResult> {
  try {
    const ok = await updateProfile(userId, { datingActive: false });
    if (!ok) {
      return {
        ok: false,
        error: getStoreError?.() || PAUSE_NIGHTLIFE_FALLBACK_ERROR,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : PAUSE_NIGHTLIFE_FALLBACK_ERROR,
    };
  }
}
