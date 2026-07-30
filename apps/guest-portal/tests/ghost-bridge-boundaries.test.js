import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

const removedRuntimeFiles = [
  'app/api/[...path]/route.js',
  'app/api/passes/apple/route.js',
  'app/api/passes/google/route.js',
  'lib/firebase/client.js',
];

test('Guest Portal no longer ships a local app/api runtime bridge', () => {
  for (const relativePath of removedRuntimeFiles) {
    assert.equal(
      existsSync(join(root, relativePath)),
      false,
      `${relativePath} should be deleted for the execution-less portal target`,
    );
  }
});

test('Guest Portal app/api only contains internal or development-only handlers', () => {
  const apiRoot = join(root, 'app/api');
  if (!existsSync(apiRoot)) return;

  const routeFiles = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (/^route\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        routeFiles.push(fullPath);
      }
    }
  };

  visit(apiRoot);
  const relativeRouteFiles = routeFiles.map((filePath) =>
    relative(root, filePath).replace(/\\/g, '/'),
  );
  const approvedInternalRoutes = new Set([
    'app/api/dev/email-preview/route.js',
    'app/api/internal/revalidate/route.ts',
  ]);
  const disallowedRoutes = relativeRouteFiles.filter(
    (relativePath) => !approvedInternalRoutes.has(relativePath),
  );

  assert.deepEqual(
    disallowedRoutes,
    [],
    'app/api must not restore a Guest Portal BFF or proxy layer',
  );
});

test('Guest Portal does not restore deleted legacy server directories', () => {
  const staleDirs = ['lib/server', 'lib/firebase'];

  for (const relativePath of staleDirs) {
    assert.equal(
      existsSync(join(root, relativePath)),
      false,
      `${relativePath} should stay deleted`,
    );
  }
});

test('Guest Portal no longer keeps the temporary client compatibility shim or root-level runtime fixtures', () => {
  const staleFiles = [
    'lib/client/gateway.js',
    'components/RazorpayCheckout.jsx',
    'components/TicketModal.jsx',
    'data/events.js',
    'data/hosts.js',
  ];

  for (const relativePath of staleFiles) {
    assert.equal(
      existsSync(join(root, relativePath)),
      false,
      `${relativePath} should be removed or quarantined from runtime`,
    );
  }
});

test('Guest Portal source tree does not keep duplicate or backup runtime artifacts', () => {
  const ignoredDirs = new Set(['.next', 'node_modules', 'coverage']);
  const runtimeRoots = ['.', 'app', 'components', 'features', 'lib', 'tests'];
  const offenders = [];
  const duplicatePattern = /(?: [23]\.[jt]sx?| copy\.[jt]sx?|\.bak|\.old)$/;
  const seen = new Set();

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) visit(join(dir, entry.name));
        continue;
      }

      if (duplicatePattern.test(entry.name)) {
        const relativePath = join(dir, entry.name).replace(`${root}/`, '');
        if (seen.has(relativePath)) continue;
        seen.add(relativePath);
        offenders.push(relativePath);
      }
    }
  };

  for (const runtimeRoot of runtimeRoots) {
    const absoluteRoot = join(root, runtimeRoot);
    if (existsSync(absoluteRoot)) visit(absoluteRoot);
  }
  assert.deepEqual(offenders, [], 'remove duplicate/backup runtime artifacts before merging');
});

test('Guest Portal debug scripts do not call deleted local bridges or legacy app API routes', () => {
  const scripts = [
    'scripts/debugListEvents.js',
    'scripts/testExploreApi.js',
    'scripts/testShare.js',
  ];

  for (const relativePath of scripts) {
    const source = readFileSync(join(root, relativePath), 'utf8');
    assert.equal(
      source.includes('../lib/server/'),
      false,
      `${relativePath} must not import deleted lib/server modules`,
    );
    assert.equal(
      source.includes('/api/events'),
      false,
      `${relativePath} must not call legacy /api/events`,
    );
    assert.equal(
      source.includes('app/tickets/actions'),
      false,
      `${relativePath} must not require deleted server actions`,
    );
  }
});

test('Auth and profile client runtime no longer imports Firebase SDK modules', () => {
  const files = [
    'components/providers/AuthProvider.jsx',
    'components/EditProfileModal.jsx',
    'app/forgot-password/PageClient.jsx',
    'lib/auth/passwordReset.js',
    'components/CancelOrderModal.jsx',
  ];

  for (const relativePath of files) {
    const source = readFileSync(join(root, relativePath), 'utf8');
    assert.equal(
      source.includes('firebase/auth'),
      false,
      `${relativePath} must not import firebase/auth`,
    );
    assert.equal(
      source.includes('firebase/storage'),
      false,
      `${relativePath} must not import firebase/storage`,
    );
    assert.equal(
      source.includes('getFirebaseAuth'),
      false,
      `${relativePath} must not call getFirebaseAuth`,
    );
    assert.equal(
      source.includes('getFirebaseStorage'),
      false,
      `${relativePath} must not call getFirebaseStorage`,
    );
  }
});

test('about route no longer keeps dead host modal scaffolding', () => {
  const source = [
    readFileSync(join(root, 'app/about/page.js'), 'utf8'),
    readFileSync(join(root, 'components/page-animations/AboutPageContent.jsx'), 'utf8'),
  ].join('\n');

  assert.equal(
    source.includes('showHostModal'),
    false,
    'about page should not keep dead host modal state',
  );
  assert.equal(
    source.includes('function HostModal'),
    false,
    'about page should not keep the removed host modal component',
  );
  assert.equal(
    source.includes('useAuth'),
    false,
    'about page should not import auth state it no longer uses',
  );
  assert.equal(
    source.includes('useRouter'),
    false,
    'about page should not import router state it no longer uses',
  );
  assert.equal(
    source.includes("window.open('https://thec1rclehost.com/host', '_blank')"),
    true,
    'about page should keep the dedicated host site handoff',
  );
});

test('Guest Portal runtime keeps backend-only and raw API access out of app code', () => {
  const runtimeRoots = ['app', 'components', 'hooks', 'lib', 'store'];
  const ignoredDirs = new Set(['api', '.next', 'node_modules', 'coverage']);
  const offenders = [];

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      const relativePath = fullPath.replace(`${root}/`, '');

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name) && relativePath === 'app/api') continue;
        if (!['.next', 'node_modules', 'coverage'].includes(entry.name)) visit(fullPath);
        continue;
      }

      if (!/\.(js|jsx|ts|tsx)$/.test(entry.name)) continue;
      const source = readFileSync(fullPath, 'utf8');
      const isApiLayer = relativePath.startsWith('lib/api/');

      const checks = [
        [source.includes('firebase-admin'), 'firebase-admin'],
        [source.includes('firebase/auth'), 'firebase/auth'],
        [source.includes('firebase/firestore'), 'firebase/firestore'],
        [source.includes('firebase/storage'), 'firebase/storage'],
        [source.includes('"use server"') || source.includes("'use server'"), 'use server'],
        [
          source.includes('lib/server/') ||
            /from\s+["'][^"']*\/server\//.test(source) ||
            /import\([^)]*\/server\//.test(source),
          'server module import',
        ],
        [!isApiLayer && /fetch\(\s*[`"']\/api\/v1/.test(source), 'raw /api/v1 fetch'],
        [source.includes('resolveGatewayCompatibilityPath'), 'compatibility path resolver import'],
      ];

      for (const [failed, label] of checks) {
        if (failed) offenders.push(`${relativePath}: ${label}`);
      }
    }
  };

  for (const runtimeRoot of runtimeRoots) {
    const absoluteRoot = join(root, runtimeRoot);
    if (existsSync(absoluteRoot)) visit(absoluteRoot);
  }

  assert.deepEqual(
    offenders,
    [],
    'Guest Portal runtime must stay on the typed API/client boundary',
  );
});
