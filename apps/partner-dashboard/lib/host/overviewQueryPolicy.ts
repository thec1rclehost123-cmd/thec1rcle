export function resolveHostOverviewQueryPolicy(
  unifiedFlag: string | undefined,
  compareFlag: string | undefined,
) {
  const unifiedEnabled = unifiedFlag !== 'false';
  return {
    unifiedEnabled,
    legacyEnabled: !unifiedEnabled || compareFlag === 'true',
  };
}
