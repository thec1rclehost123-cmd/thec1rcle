import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const homepageDataPath = path.resolve(process.cwd(), 'features/discovery/homepageData.js');

test('homepage discovery content uses browser-side Fastify public discovery helpers', () => {
  const source = readFileSync(homepageDataPath, 'utf8');

  assert.equal(source.includes('./server/eventStore'), false);
  assert.equal(source.includes('./server/featuredFeed'), false);
  assert.equal(source.includes('./publicDiscovery.js'), true);
  assert.equal(source.includes('fetchPublicEvents'), true);
  assert.equal(source.includes('fetchFeaturedEvents'), true);
  assert.equal(source.includes('fetchHomepageSelects'), true);
  assert.equal(source.includes('fetchHomepageInterviews'), true);
  assert.equal(source.includes('getHomepageSelects'), false);
  assert.equal(source.includes('getHomepageInterviews'), false);
});
