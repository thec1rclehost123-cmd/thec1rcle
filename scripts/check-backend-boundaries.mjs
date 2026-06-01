import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const APPS = [
    { name: 'guest-portal', routeRoot: 'apps/guest-portal/app/api' },
    { name: 'partner-dashboard', routeRoot: 'apps/partner-dashboard/app/api' },
];

const PROTECTED_COLLECTIONS = [
    'users',
    'venues',
    'hosts',
    'promoters',
    'events',
    'orders',
    'tickets',
    'payouts',
    'partnerships',
    'partner_memberships',
    'notifications',
    'staff_profiles',
    'guest_list',
    'guest_lists',
    'guestlist',
    'venue_daily_stats',
    'host_daily_stats',
    'promoter_daily_stats',
    'event_summary',
    'venue_overview_snapshot',
    'host_overview_snapshot',
    'promoter_commission_summary',
];

const DIRECT_ADMIN_PATTERNS = [
    /from\s+["']firebase-admin(?:\/[^"']*)?["']/g,
    /from\s+["']@\/lib\/firebase\/admin["']/g,
    /from\s+["']@c1rcle\/core\/admin["']/g,
    /\bgetAdmin(?:Db|Auth|App|Storage)\b/g,
    /\bisFirebaseConfigured\b/g,
];

const STORE_IMPORT_PATTERNS = [
    /from\s+["'][^"']*\/lib\/server\/[^"']*(?:Store|Middleware|Service)(?:\.[^"']+)?["']/g,
];

const ALLOWED_BRIDGE_IMPORT_PATTERNS = [
    /\/lib\/server\/apiClient(?:\.[^"']+)?["']/,
    /\/lib\/server\/withAuth(?:\.[^"']+)?["']/,
    /\/lib\/server\/auth(?:\.[^"']+)?["']/,
    /\/lib\/server\/logger(?:\.[^"']+)?["']/,
    /\/lib\/server\/apiResponse(?:\.[^"']+)?["']/,
];

const WRITE_METHOD_PATTERN = /\.(set|add|update|delete)\s*\(/g;
const GATEWAY_CLIENT_PATTERN = /\bgetApiClient\s*\(|\bnew\s+C1rcleApiClient\b|client\.(request|get|post|patch|delete)\s*\(|\bproxyGatewayJson\s*\(|\bcallGatewayJson\s*\(|\bfetchPublic(?:Events|Event|FeaturedEvents|Hosts|Host|Venues|Venue)\s*\(|\bsearchPublicDiscovery\s*\(/;

function repoRoot() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, '..');
}

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function walk(dir) {
    const output = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            output.push(...walk(fullPath));
            continue;
        }
        if (entry.isFile() && /route\.(js|ts)$/.test(entry.name)) {
            output.push(fullPath);
        }
    }
    return output.sort();
}

function detectSurface(routePath) {
    if (routePath.includes('/webhooks/')) return 'webhook';
    if (routePath.includes('/auth/')) return 'auth';
    if (routePath.includes('/scan') || routePath.includes('/door')) return 'scanner';
    if (routePath.includes('/venue/')) return 'venue';
    if (routePath.includes('/host/')) return 'host';
    if (routePath.includes('/promoter/')) return 'promoter';
    if (routePath.includes('guest-portal')) return 'guest';
    return 'shared';
}

function detectDataAccessMode(source) {
    const usesGatewayClient = GATEWAY_CLIENT_PATTERN.test(source);
    const usesDirectAdmin = DIRECT_ADMIN_PATTERNS.some((pattern) => pattern.test(source));
    if (usesGatewayClient && usesDirectAdmin) return 'mixed';
    if (usesDirectAdmin) return 'direct_firebase_admin';
    if (usesGatewayClient) return 'gateway_client';
    return 'web_only';
}

function detectTargetOwner(routePath) {
    if (routePath.includes('/follow')) return 'Fastify social/profile relationship routes + relationship services';
    if (routePath.includes('/checkout') || routePath.includes('/payments')) return 'Fastify checkout/payments routes + CheckoutService';
    if (routePath.includes('/tickets') || routePath.includes('/passes') || routePath.includes('/entitlements')) return 'Fastify tickets routes + ticket/entitlement services';
    if (routePath.includes('/scan') || routePath.includes('/door')) return 'Fastify scan routes + ScannerService';
    if (routePath.includes('/waitlist')) return 'Fastify waitlist routes + WaitlistService';
    if (routePath.includes('/orders')) return 'Fastify orders routes + OrderService';
    if (routePath.includes('/notifications')) return 'Fastify notifications routes + NotificationService';
    if (routePath.includes('/search') || routePath.includes('/recommendations') || routePath.includes('/events') || routePath.includes('/hosts') || routePath.includes('/venues')) {
        return 'Fastify public/events routes + discovery/event services';
    }
    if (routePath.includes('/venue/analytics')) return 'Fastify partner venue analytics routes + AnalyticsService';
    if (routePath.includes('/venue/finance') || routePath.includes('/payments/payout')) return 'Fastify partner venue finance routes + FinanceService';
    if (routePath.includes('/venue/staff')) return 'Fastify partner venue staff routes + StaffService';
    if (routePath.includes('/venue/guest-ops') || routePath.includes('/venue/orders') || routePath.includes('/venue/events')) return 'Fastify partner venue routes + Venue operations services';
    if (routePath.includes('/host/analytics')) return 'Fastify partner host analytics routes + AnalyticsService';
    if (routePath.includes('/host/finance') || routePath.includes('/host/orders')) return 'Fastify partner host finance routes + FinanceService';
    if (routePath.includes('/host/events') || routePath.includes('/host/ops')) return 'Fastify partner host routes + Host operations services';
    if (routePath.includes('/promoter/analytics')) return 'Fastify partner promoter analytics routes + AnalyticsService';
    if (routePath.includes('/promoter/finance') || routePath.includes('/promoter/payout') || routePath.includes('/promoter/commissions')) return 'Fastify partner promoter finance routes + CommissionService';
    if (routePath.includes('/promoter/')) return 'Fastify partner promoter routes + promoter services';
    if (routePath.includes('/auth/')) return 'Fastify auth routes + auth/profile services';
    if (routePath.includes('/profile')) return 'Fastify profiles routes + ProfileService';
    if (routePath.includes('/webhooks/') || routePath.includes('/inngest/')) return 'App-local web helper or worker bridge';
    return 'Fastify API gateway route + domain service';
}

function detectTargetPhase(routePath) {
    if (routePath.includes('guest-portal')) {
        if (routePath.includes('/auth/')) return 'GP-1';
        if (routePath.includes('/follow')) return 'GP-3';
        if (routePath.includes('/search') || routePath.includes('/hosts') || routePath.includes('/venues') || routePath === 'apps/guest-portal/app/api/events/route.js' || routePath.includes('/events/nearby')) return 'GP-2';
        if (routePath.includes('/events/') || routePath.includes('/follow') || routePath.includes('/recommendations')) return 'GP-3';
        if (routePath.includes('/checkout') || routePath.includes('/payments') || routePath.includes('/reservations') || routePath.includes('/webhooks/payment')) return 'GP-4';
        if (routePath.includes('/orders') || routePath.includes('/profile') || routePath.includes('/tickets') || routePath.includes('/notifications') || routePath.includes('/waitlist')) return 'GP-5';
        return 'GP-1';
    }

    if (routePath.includes('/venue/analytics')) return 'V-6';
    if (routePath.includes('/venue/finance') || routePath.includes('/payments/payout')) return 'V-5';
    if (routePath.includes('/venue/staff')) return 'V-4';
    if (routePath.includes('/venue/guest-ops') || routePath.includes('/venue/door') || routePath.includes('/scan') || routePath.includes('/walk-ins') || routePath.includes('/guestlist')) return 'V-3';
    if (routePath.includes('/venue/settings') || routePath.includes('/venue/marketing') || routePath.includes('/venue/partnership') || routePath.includes('/venue/gallery') || routePath.includes('/venue/broadcast') || routePath.includes('/venue/highlights')) return 'V-7';
    if (routePath.includes('/venue/') || routePath.includes('/events/create') || routePath.includes('/venues/')) return 'V-2';
    if (routePath.includes('/host/analytics')) return 'H-5';
    if (routePath.includes('/host/finance') || routePath.includes('/host/orders')) return 'H-4';
    if (routePath.includes('/host/team') || routePath.includes('/host/settings') || routePath.includes('/host/notifications')) return 'H-6';
    if (routePath.includes('/host/audience') || routePath.includes('/host/promoters') || routePath.includes('/host/partnership')) return 'H-3';
    if (routePath.includes('/host/events') || routePath.includes('/host/ops') || routePath.includes('/host/venue-calendar')) return 'H-2';
    if (routePath.includes('/host/')) return 'H-1';
    if (routePath.includes('/promoter/analytics') || routePath.includes('/promoter/stats')) return 'P-4';
    if (routePath.includes('/promoter/finance') || routePath.includes('/promoter/payout') || routePath.includes('/promoter/commissions')) return 'P-3';
    if (routePath.includes('/promoter/settings')) return 'P-5';
    if (routePath.includes('/promoter/links') || routePath.includes('/promoter/events') || routePath.includes('/promoter/guests') || routePath.includes('/promoter/connections')) return 'P-2';
    if (routePath.includes('/promoter/')) return 'P-1';
    if (routePath.includes('/auth/') || routePath.includes('/profile') || routePath.includes('/setup/provision-venue')) return 'V-1';
    return 'V-1';
}

export function analyzeRoute(routePath, source) {
    const directAdminMatches = DIRECT_ADMIN_PATTERNS.flatMap((pattern) => Array.from(source.matchAll(pattern)).map((match) => match[0]));
    const storeMatches = STORE_IMPORT_PATTERNS
        .flatMap((pattern) => Array.from(source.matchAll(pattern)).map((match) => match[0]))
        .filter((match) => !ALLOWED_BRIDGE_IMPORT_PATTERNS.some((allowed) => allowed.test(match)));
    const protectedWriteMatches = [];

    for (const collection of PROTECTED_COLLECTIONS) {
        const collectionPattern = new RegExp(`collection\\((["'\`])${collection}\\1\\)`, 'g');
        if (!collectionPattern.test(source)) continue;
        WRITE_METHOD_PATTERN.lastIndex = 0;
        if (WRITE_METHOD_PATTERN.test(source)) {
            protectedWriteMatches.push(collection);
        }
    }

    const usesGatewayClient = GATEWAY_CLIENT_PATTERN.test(source);
    const violations = [];

    if (directAdminMatches.length > 0) {
        violations.push({
            type: 'direct_admin_import',
            message: 'App-local route imports Firebase Admin or admin helpers directly.',
            evidence: [...new Set(directAdminMatches)],
        });
    }

    if (storeMatches.length > 0) {
        violations.push({
            type: 'business_module_import',
            message: 'App-local route imports business/store modules instead of staying a thin bridge/helper.',
            evidence: [...new Set(storeMatches)],
        });
    }

    if (protectedWriteMatches.length > 0) {
        violations.push({
            type: 'protected_firestore_write',
            message: 'App-local route performs protected Firestore writes directly.',
            evidence: [...new Set(protectedWriteMatches)],
        });
    }

    const classification = violations.length > 0
        ? 'legacy_backend_logic'
        : (usesGatewayClient ? 'temporary_bridge' : 'allowed_web_helper');

    return {
        route: routePath,
        surface: detectSurface(routePath),
        classification,
        data_access_mode: detectDataAccessMode(source),
        target_owner: detectTargetOwner(routePath),
        target_phase: detectTargetPhase(routePath),
        violations,
    };
}

export function loadRoutes(rootDir = repoRoot()) {
    const routes = [];
    for (const app of APPS) {
        const absoluteRoot = path.join(rootDir, app.routeRoot);
        if (!fs.existsSync(absoluteRoot)) continue;
        for (const fullPath of walk(absoluteRoot)) {
            const routePath = toPosix(path.relative(rootDir, fullPath));
            const source = fs.readFileSync(fullPath, 'utf8');
            routes.push(analyzeRoute(routePath, source));
        }
    }
    return routes.sort((a, b) => a.route.localeCompare(b.route));
}

export function evaluateRoutes(routes, manifest = {}) {
    const errors = [];
    const staleExceptions = [];

    for (const route of routes) {
        const exception = manifest[route.route];
        if (route.violations.length === 0) {
            if (exception) {
                staleExceptions.push(route.route);
            }
            continue;
        }

        if (!exception) {
            errors.push({
                route: route.route,
                reason: 'Route has boundary violations but no exception manifest entry.',
                violations: route.violations,
            });
            continue;
        }

        const requiredFields = ['classification', 'phase', 'target_owner', 'reason', 'parity_notes', 'remove_when'];
        const missingFields = requiredFields.filter((field) => !exception[field]);
        if (missingFields.length > 0) {
            errors.push({
                route: route.route,
                reason: `Exception manifest entry is missing required fields: ${missingFields.join(', ')}`,
                violations: route.violations,
            });
            continue;
        }

        if (exception.classification !== 'legacy_backend_logic') {
            errors.push({
                route: route.route,
                reason: `Violating routes must be classified as legacy_backend_logic, found ${exception.classification}.`,
                violations: route.violations,
            });
        }
    }

    return { errors, staleExceptions };
}

function parseArgs(argv) {
    const options = {
        manifest: 'governance/backend-boundary-exceptions.json',
        inventoryOut: null,
        format: 'text',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--manifest') options.manifest = argv[index + 1];
        if (arg === '--inventory-out') options.inventoryOut = argv[index + 1];
        if (arg === '--format') options.format = argv[index + 1];
    }

    return options;
}

function loadManifest(manifestPath, rootDir) {
    const absolutePath = path.join(rootDir, manifestPath);
    if (!fs.existsSync(absolutePath)) return {};
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function printTextSummary(routes, evaluation) {
    const counts = routes.reduce((acc, route) => {
        acc[route.classification] = (acc[route.classification] || 0) + 1;
        return acc;
    }, {});

    console.log(`Checked ${routes.length} app/api routes.`);
    console.log(`allowed_web_helper=${counts.allowed_web_helper || 0} temporary_bridge=${counts.temporary_bridge || 0} legacy_backend_logic=${counts.legacy_backend_logic || 0}`);

    if (evaluation.staleExceptions.length > 0) {
        console.log(`Stale exceptions: ${evaluation.staleExceptions.length}`);
        for (const route of evaluation.staleExceptions) {
            console.log(`  - ${route}`);
        }
    }

    if (evaluation.errors.length === 0) {
        console.log('Boundary check passed.');
        return;
    }

    console.error(`Boundary check failed with ${evaluation.errors.length} route violation(s).`);
    for (const error of evaluation.errors) {
        console.error(`- ${error.route}: ${error.reason}`);
        for (const violation of error.violations) {
            console.error(`    [${violation.type}] ${violation.message}`);
            console.error(`    evidence: ${violation.evidence.join(' | ')}`);
        }
    }
}

export function buildInventory(routes) {
    return {
        generated_at: new Date().toISOString(),
        summary: {
            total_routes: routes.length,
            by_classification: routes.reduce((acc, route) => {
                acc[route.classification] = (acc[route.classification] || 0) + 1;
                return acc;
            }, {}),
            by_surface: routes.reduce((acc, route) => {
                acc[route.surface] = (acc[route.surface] || 0) + 1;
                return acc;
            }, {}),
        },
        routes,
    };
}

export function buildExceptionManifest(routes) {
    const manifest = {};
    for (const route of routes) {
        if (route.violations.length === 0) continue;
        manifest[route.route] = {
            classification: 'legacy_backend_logic',
            phase: route.target_phase,
            target_owner: route.target_owner,
            reason: `Legacy ${route.surface} app/api route still owns backend logic during Phase 0.`,
            parity_notes: 'Preserve current business behavior exactly while re-homing ownership into Fastify and packages/core.',
            remove_when: `Remove when ${route.target_phase} migration completes and this route becomes a thin bridge or is deleted.`,
        };
    }
    return manifest;
}

export function runCli(argv = process.argv.slice(2)) {
    const rootDir = repoRoot();
    const options = parseArgs(argv);
    const routes = loadRoutes(rootDir);
    const manifest = loadManifest(options.manifest, rootDir);
    const evaluation = evaluateRoutes(routes, manifest);

    if (options.inventoryOut) {
        const outputPath = path.join(rootDir, options.inventoryOut);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, `${JSON.stringify(buildInventory(routes), null, 2)}\n`);
    }

    if (options.format === 'json') {
        console.log(JSON.stringify({ routes, evaluation }, null, 2));
    } else {
        printTextSummary(routes, evaluation);
    }

    if (evaluation.errors.length > 0) {
        process.exitCode = 1;
    }
}

import { pathToFileURL } from 'url';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    runCli();
}
