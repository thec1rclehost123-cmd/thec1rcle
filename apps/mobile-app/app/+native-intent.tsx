import { collapseRapidDuplicateDetailIntent } from '@/lib/nativeIntentDedupe';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    return collapseRapidDuplicateDetailIntent(path);
  } catch {
    // Native intent rewriting must never make app startup fail.
    return path;
  }
}
