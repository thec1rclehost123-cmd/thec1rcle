export function resolveExploreBootstrapCity(
  profileCity: string | null | undefined,
  currentCityFilter: string,
  selectionTouched: boolean,
): string {
  if (selectionTouched) return currentCityFilter;
  return profileCity?.trim().toLowerCase() || currentCityFilter;
}

export function shouldRunExploreBootstrap(
  isFocused: boolean,
  userId: string | null | undefined,
  loadedProfileUserId: string | null | undefined,
): boolean {
  if (!isFocused) return false;
  return !userId || loadedProfileUserId === userId;
}
