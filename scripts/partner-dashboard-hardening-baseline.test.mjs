import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPartnerDashboardHardeningBaseline } from './partner-dashboard-hardening-baseline.mjs';

test('captures the expected May 1 partner-dashboard route baseline', () => {
  const baseline = buildPartnerDashboardHardeningBaseline();

  assert.equal(baseline.routeCounts.hostBffRoutes, 41);
  assert.equal(baseline.routeCounts.venueBffRoutes, 92);
  assert.equal(baseline.routeCounts.promoterBffRoutes, 21);
  assert.equal(baseline.routeCounts.crossRolePromoterRoutes, 7);
  assert.equal(baseline.routeCounts.unifiedPartnerCatchAllRoutes, 1);
});

test('tracks upload surfaces and direct-store inventory hotspots', () => {
  const baseline = buildPartnerDashboardHardeningBaseline();

  assert.deepEqual(baseline.uploadSurfaces, []);
  assert.equal(
    baseline.storeInventory.some((entry) => entry.file === 'lib/server/hostSettingsStore.ts'),
    true,
  );
});
