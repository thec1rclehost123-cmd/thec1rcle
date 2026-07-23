export type LatestRequestToken = Readonly<{ key: string; generation: number }>;

/**
 * Tracks the latest async request for state that has only one current owner.
 * A previous account or resource cannot overwrite a newer one after it settles.
 */
export function createLatestRequestGuard() {
  let generation = 0;

  return {
    begin(key: string): LatestRequestToken {
      generation += 1;
      return { key, generation };
    },
    isCurrent(token: LatestRequestToken): boolean {
      return token.generation === generation;
    },
    invalidate(): void {
      generation += 1;
    },
  };
}
