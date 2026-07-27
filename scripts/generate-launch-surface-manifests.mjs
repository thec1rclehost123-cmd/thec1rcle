import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'qa-artifacts', 'manifests');
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set([
  '.expo',
  '.next',
  '.turbo',
  'android',
  'build',
  'coverage',
  'dist',
  'ios',
  'node_modules',
]);

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

function routeFromAppFile(file, appRoot, framework) {
  const rel = path.relative(appRoot, file);
  const extension = path.extname(rel);
  const withoutExtension = rel.slice(0, -extension.length);
  const rawSegments = withoutExtension.split(path.sep);
  const filename = rawSegments.at(-1);
  const isLayout = filename === '_layout' || filename === 'layout';
  const isApiRoute = filename === 'route';
  const dropFilename =
    filename === 'page' || filename === 'route' || filename === 'index' || isLayout;
  const segments = (dropFilename ? rawSegments.slice(0, -1) : rawSegments).filter(
    (segment) => !((segment.startsWith('(') && segment.endsWith(')')) || segment.startsWith('@')),
  );
  const route = `/${segments.join('/')}`.replace(/\/+/g, '/') || '/';
  return {
    route,
    kind: isLayout ? 'layout' : isApiRoute ? 'bff_route' : framework === 'expo' ? 'screen' : 'page',
  };
}

function routePersona(route) {
  const first = route.split('/').filter(Boolean)[0] || 'shared';
  if (['venue', 'host', 'promoter', 'scanner'].includes(first)) return first;
  if (['login', 'signup', 'auth', 'forgot-password', 'onboard', 'verify'].includes(first)) {
    return 'auth';
  }
  return 'shared';
}

async function buildAppManifest({ platform, directory, framework, include }) {
  const files = (await walk(directory)).filter(include);
  return files
    .map((file) => {
      const { route, kind } = routeFromAppFile(file, directory, framework);
      return {
        id: `${platform}:${kind}:${route}:${relative(file)}`,
        platform,
        kind,
        route,
        sourceFile: relative(file),
        persona: routePersona(route),
        dynamicSegments: [...route.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]),
        authClassification: 'REVIEW',
        interactions: [],
        upstreamEndpoints: [],
        positiveCases: [],
        negativeCases: [],
        recoveryCases: [],
        evidence: [],
        defects: [],
        status: 'PENDING',
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route) || a.sourceFile.localeCompare(b.sourceFile));
}

async function buildGatewayManifest(directory) {
  const files = (await walk(directory)).sort();
  const rows = [];
  const routePattern = /fastify\.(get|post|patch|put|delete)\s*\(\s*(['"`])([^'"`]+)\2/g;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    let match;
    let found = false;
    while ((match = routePattern.exec(source))) {
      found = true;
      rows.push({
        id: `api-gateway:${match[1].toUpperCase()}:${match[3]}:${relative(file)}`,
        platform: 'api-gateway',
        kind: 'gateway_route',
        method: match[1].toUpperCase(),
        declaredPath: match[3],
        canonicalPrefix: '/api/v1',
        sourceFile: relative(file),
        authClassification: 'REVIEW',
        permissions: [],
        requestSchema: 'REVIEW',
        responseSchema: 'REVIEW',
        coreAuthority: 'REVIEW',
        positiveCases: [],
        negativeCases: [],
        recoveryCases: [],
        evidence: [],
        defects: [],
        status: 'PENDING',
      });
    }
    if (!found) {
      rows.push({
        id: `api-gateway:module:${relative(file)}`,
        platform: 'api-gateway',
        kind: 'gateway_route_module',
        method: null,
        declaredPath: null,
        canonicalPrefix: '/api/v1',
        sourceFile: relative(file),
        authClassification: 'REVIEW',
        permissions: [],
        requestSchema: 'REVIEW',
        responseSchema: 'REVIEW',
        coreAuthority: 'REVIEW',
        positiveCases: [],
        negativeCases: [],
        recoveryCases: [],
        evidence: [],
        defects: [],
        status: 'PENDING',
      });
    }
  }

  return rows.sort(
    (a, b) =>
      (a.declaredPath || '').localeCompare(b.declaredPath || '') ||
      a.sourceFile.localeCompare(b.sourceFile),
  );
}

async function buildFeatureEndpointMap(directories) {
  const endpointPattern = /(['"`])(\/api\/(?:v1\/)?[^'"`\s?#]*)\1/g;
  const results = [];
  for (const directory of directories) {
    for (const file of await walk(directory)) {
      if (
        /(?:^|\/)(?:__tests__|test|tests)(?:\/|$)/.test(relative(file)) ||
        /\.(?:test|spec)\.[jt]sx?$/.test(file)
      ) {
        continue;
      }
      const source = await readFile(file, 'utf8');
      let match;
      while ((match = endpointPattern.exec(source))) {
        results.push({
          consumerFile: relative(file),
          endpointLiteral: match[2],
          method: 'REVIEW',
          gatewayMatch: 'REVIEW',
          status: 'PENDING',
        });
      }
    }
  }
  const deduped = new Map(
    results.map((item) => [`${item.consumerFile}:${item.endpointLiteral}`, item]),
  );
  return [...deduped.values()].sort(
    (a, b) =>
      a.endpointLiteral.localeCompare(b.endpointLiteral) ||
      a.consumerFile.localeCompare(b.consumerFile),
  );
}

function summary(manifests) {
  const result = {};
  for (const [name, rows] of Object.entries(manifests)) {
    const byKind = {};
    const byStatus = {};
    for (const row of rows) {
      const kind = row.kind || 'endpoint_reference';
      byKind[kind] = (byKind[kind] || 0) + 1;
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    }
    result[name] = {
      total: rows.length,
      byKind,
      byStatus,
    };
  }
  return result;
}

const nextInclude = (file) => /\/(?:page|route)\.(?:js|jsx|ts|tsx)$/.test(file);
const expoInclude = (file) => !/\.d\.ts$/.test(file);

const manifests = {
  partnerDashboard: await buildAppManifest({
    platform: 'partner-dashboard',
    directory: path.join(root, 'apps', 'partner-dashboard', 'app'),
    framework: 'next',
    include: nextInclude,
  }),
  guestPortal: await buildAppManifest({
    platform: 'guest-portal',
    directory: path.join(root, 'apps', 'guest-portal', 'app'),
    framework: 'next',
    include: nextInclude,
  }),
  mobile: await buildAppManifest({
    platform: 'mobile-app',
    directory: path.join(root, 'apps', 'mobile-app', 'app'),
    framework: 'expo',
    include: expoInclude,
  }),
  scanner: await buildAppManifest({
    platform: 'scanner-app',
    directory: path.join(root, 'apps', 'scanner-app', 'app'),
    framework: 'expo',
    include: expoInclude,
  }),
  gateway: await buildGatewayManifest(path.join(root, 'apps', 'api-gateway', 'src', 'routes')),
};

const featureEndpointMap = await buildFeatureEndpointMap([
  path.join(root, 'apps', 'partner-dashboard'),
  path.join(root, 'apps', 'guest-portal'),
  path.join(root, 'apps', 'mobile-app'),
  path.join(root, 'apps', 'scanner-app'),
]);

const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const generatedAt = new Date().toISOString();

await mkdir(outputDir, { recursive: true });
const files = {
  'partner-dashboard-routes.json': manifests.partnerDashboard,
  'guest-portal-routes.json': manifests.guestPortal,
  'mobile-routes.json': manifests.mobile,
  'scanner-routes.json': manifests.scanner,
  'gateway-routes.json': manifests.gateway,
  'feature-to-endpoint-map.json': featureEndpointMap,
};
for (const [filename, rows] of Object.entries(files)) {
  await writeFile(
    path.join(outputDir, filename),
    `${JSON.stringify({ generatedAt, gitSha, rows }, null, 2)}\n`,
  );
}

const coverageSummary = {
  generatedAt,
  gitSha,
  generator: relative(import.meta.filename),
  scannedRoots: [
    'apps/partner-dashboard/app',
    'apps/guest-portal/app',
    'apps/mobile-app/app',
    'apps/scanner-app/app',
    'apps/api-gateway/src/routes',
  ],
  ignoredDirectories: [...ignoredDirectories].sort(),
  counts: summary({ ...manifests, featureEndpointMap }),
  completion: {
    totalRows:
      Object.values(manifests).reduce((total, rows) => total + rows.length, 0) +
      featureEndpointMap.length,
    passedRows: 0,
    incompleteRows:
      Object.values(manifests).reduce((total, rows) => total + rows.length, 0) +
      featureEndpointMap.length,
    unclassifiedRows:
      manifests.partnerDashboard.length + manifests.guestPortal.length + manifests.gateway.length,
  },
};
await writeFile(
  path.join(outputDir, 'coverage-summary.json'),
  `${JSON.stringify(coverageSummary, null, 2)}\n`,
);

console.log(JSON.stringify(coverageSummary, null, 2));
