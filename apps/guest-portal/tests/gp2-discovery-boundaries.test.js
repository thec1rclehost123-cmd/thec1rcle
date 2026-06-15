import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('Discovery client surfaces use the generated guest API client instead of direct legacy bridges', () => {
  const storeSource = readFileSync(join(root, 'store/exploreStore.js'), 'utf8');
  const hostsStoreSource = readFileSync(join(root, 'store/hostsStore.js'), 'utf8');
  const instantSearchSource = readFileSync(join(root, 'lib/hooks/useInstantSearch.js'), 'utf8');
  const exploreStateSource = readFileSync(
    join(root, 'features/discovery/hooks/useExplorePageState.js'),
    'utf8',
  );
  const exploreClientSource = readFileSync(join(root, 'components/ExploreClient.jsx'), 'utf8');

  assert.equal(
    storeSource.includes('fetchPublicEvents'),
    true,
    'explore store should use the discovery feature seam',
  );
  assert.equal(
    hostsStoreSource.includes('fetchPublicHosts') || hostsStoreSource.includes('fetchPublicVenues'),
    true,
    'hosts store should use the discovery feature seam',
  );
  assert.equal(
    instantSearchSource.includes('searchPublicDiscovery'),
    true,
    'instant search should use the discovery feature seam',
  );
  assert.equal(
    instantSearchSource.includes('fetchSearchSuggestions'),
    true,
    'instant search should use the discovery suggestion helper',
  );
  assert.equal(
    exploreStateSource.includes('getBackendSort'),
    true,
    'explore page state should normalize sort aliases before hitting the discovery store',
  );
  assert.equal(
    exploreStateSource.includes('fetchPublicEvents'),
    false,
    'explore page state should not trigger a second direct trending fetch on top of the shared discovery store',
  );
  assert.equal(
    exploreClientSource.includes('useExplorePageState'),
    true,
    'ExploreClient should delegate discovery orchestration to the feature hook',
  );

  for (const [relativePath, source] of [
    ['store/exploreStore.js', storeSource],
    ['store/hostsStore.js', hostsStoreSource],
    ['lib/hooks/useInstantSearch.js', instantSearchSource],
    ['features/discovery/hooks/useExplorePageState.js', exploreStateSource],
    ['components/ExploreClient.jsx', exploreClientSource],
  ]) {
    if (relativePath.startsWith('store/')) {
      assert.equal(
        source.includes('guestApiFetch'),
        false,
        `${relativePath} should use typed helpers, not the low-level fetch helper`,
      );
    }
    assert.equal(
      source.includes('/api/v1/public/'),
      false,
      `${relativePath} must not hard-code /api/v1/public/* routes`,
    );
    assert.equal(
      source.includes('/api/search'),
      false,
      `${relativePath} must not call /api/search`,
    );
    assert.equal(
      source.includes('/api/events'),
      false,
      `${relativePath} must not call /api/events`,
    );
    assert.equal(source.includes('/api/hosts'), false, `${relativePath} must not call /api/hosts`);
    assert.equal(
      source.includes('/api/venues'),
      false,
      `${relativePath} must not call /api/venues`,
    );
  }
});
