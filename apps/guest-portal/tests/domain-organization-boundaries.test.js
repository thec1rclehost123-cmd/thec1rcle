import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const routeFiles = [
  'app/page.js',
  'app/PageClient.jsx',
  'app/robots.js',
  'app/sitemap.js',
  'app/event/[eventId]/page.jsx',
  'app/event/[eventId]/PageClient.jsx',
  'app/explore/page.js',
  'app/[handle]/PageClient.jsx',
  'app/[handle]/[eventSlug]/page.jsx',
  'app/[handle]/[eventSlug]/PageClient.jsx',
  'app/checkout/[eventId]/PageClient.jsx',
  'app/tickets/PageClient.jsx',
  'app/tickets/claim/[token]/PageClient.jsx',
  'app/tickets/pair/[token]/PageClient.jsx',
  'app/profile/[userId]/PageClient.jsx',
  'app/host/[slug]/page.jsx',
  'app/host/[slug]/PageClient.jsx',
  'app/hosts/page.js',
  'app/venue/[slug]/page.jsx',
  'app/venue/[slug]/PageClient.jsx',
  'app/venue/[slug]/menu/PageClient.jsx',
  'app/confirmation/[orderId]/PageClient.jsx',
];

const forbiddenRouteImports = [
  'lib/client/publicDiscovery',
  'lib/client/ticketApi',
  'lib/homepageData',
  'lib/homepageData.shared',
  'lib/utils/seo',
  'components/CheckoutContainer',
];

test('guest app routes compose feature modules instead of app-local domain helpers', () => {
  for (const relativePath of routeFiles) {
    const source = readFileSync(join(root, relativePath), 'utf8');
    for (const forbidden of forbiddenRouteImports) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not import ${forbidden}`,
      );
    }
  }
});

test('legacy domain helper shims stay removed after feature migration', () => {
  const removedShims = [
    'lib/client/publicDiscovery.js',
    'lib/client/ticketApi.js',
    'lib/homepageData.js',
    'lib/homepageData.shared.js',
    'lib/utils/seo.js',
  ];

  for (const relativePath of removedShims) {
    assert.equal(
      existsSync(join(root, relativePath)),
      false,
      `${relativePath} should stay deleted`,
    );
  }
});

test('guest feature modules own the moved domains', () => {
  const featureFiles = [
    'features/discovery/publicDiscovery.js',
    'features/discovery/homepageContent.js',
    'features/discovery/homepageData.js',
    'features/seo/seoUtils.js',
    'features/tickets/ticketApi.js',
    'features/tickets/ticketsQueries.js',
    'features/notifications/notificationsQueries.js',
    'features/profiles/profileQueries.js',
    'features/vanity/vanityResolver.js',
    'features/checkout/CheckoutContainer.jsx',
  ];

  for (const relativePath of featureFiles) {
    assert.equal(existsSync(join(root, relativePath)), true, `${relativePath} should exist`);
  }
});
