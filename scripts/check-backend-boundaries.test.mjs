import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRoute, evaluateRoutes } from './check-backend-boundaries.mjs';

test('flags direct Firebase admin imports as legacy backend logic', () => {
    const route = analyzeRoute(
        'apps/partner-dashboard/app/api/venue/orders/route.ts',
        `import { getAdminDb } from "@/lib/firebase/admin";\nexport async function GET() { return getAdminDb(); }`,
    );

    assert.equal(route.classification, 'legacy_backend_logic');
    assert.equal(route.violations[0].type, 'direct_admin_import');
});

test('treats gateway client routes as temporary bridges when no legacy patterns exist', () => {
    const route = analyzeRoute(
        'apps/partner-dashboard/app/api/venue/overview/summary/route.ts',
        `import { getApiClient } from "@/lib/server/apiClient";\nexport async function GET() { const client = getApiClient("token"); return client.request("/venue"); }`,
    );

    assert.equal(route.classification, 'temporary_bridge');
    assert.equal(route.violations.length, 0);
});

test('requires manifest entries for legacy routes and accepts complete exception metadata', () => {
    const route = analyzeRoute(
        'apps/guest-portal/app/api/checkout/initiate/route.js',
        `import { getAdminDb } from "@/lib/firebase/admin";\nimport { createOrder } from "@/lib/server/orderStore";\nexport async function POST() { return createOrder(getAdminDb()); }`,
    );

    const withoutException = evaluateRoutes([route], {});
    assert.equal(withoutException.errors.length, 1);

    const withException = evaluateRoutes([route], {
        [route.route]: {
            classification: 'legacy_backend_logic',
            phase: 'GP-4',
            target_owner: 'Fastify checkout/payments routes + CheckoutService',
            reason: 'Legacy checkout orchestration still lives in Next app.',
            parity_notes: 'Preserve promo, pricing, and payment behavior during re-home.',
            remove_when: 'Remove when checkout initiation is served by Fastify.',
        },
    });

    assert.equal(withException.errors.length, 0);
});

test('flags direct writes to protected collections in app-local routes', () => {
    const route = analyzeRoute(
        'apps/partner-dashboard/app/api/host/events/[id]/submit/route.ts',
        `export async function POST() { await db.collection("events").doc("a").update({ status: "submitted" }); }`,
    );

    assert.equal(route.classification, 'legacy_backend_logic');
    assert.equal(route.violations.some((violation) => violation.type === 'protected_firestore_write'), true);
});
