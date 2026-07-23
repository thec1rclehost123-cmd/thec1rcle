import { colors } from '@/lib/design/theme';

export const BRAND_ACCENT = colors.iris;
export const TICKET_ACCENT = '#D915A8';

type AccentFallback = 'brand' | 'ticket' | (string & {});

export interface AccentColorResult {
  accentColor: string;
  dominantColor?: string;
  posterAccentColor?: string;
}

function getFallbackColor(fallback: AccentFallback): string {
  if (fallback === 'brand') return BRAND_ACCENT;
  if (fallback === 'ticket') return TICKET_ACCENT;
  return fallback;
}

export function resolveEventAccentColor(
  obj: Record<string, any> | null | undefined,
  fallback: AccentFallback = 'brand',
): string {
  if (!obj) return getFallbackColor(fallback);

  const finalFallback = getFallbackColor(fallback);

  return (
    obj.posterAccentColor ||
    obj.dominantColor ||
    obj.eventAccentColor ||
    (obj.accentColor && String(obj.accentColor).toUpperCase() !== BRAND_ACCENT.toUpperCase()
      ? obj.accentColor
      : undefined) ||
    finalFallback
  );
}

export function useEventAccent(
  obj: Record<string, any> | null | undefined,
  fallback: AccentFallback = 'brand',
): AccentColorResult {
  return {
    accentColor: resolveEventAccentColor(obj, fallback),
    dominantColor: obj?.dominantColor,
    posterAccentColor: obj?.posterAccentColor,
  };
}
