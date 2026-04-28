import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GUEST_API_BASE_PATH, guestV1Operations } from "../lib/api/generated/guest-v1.js";
import { buildGuestOperationPath } from "../lib/api/client.js";

const root = process.cwd();
const normalizeOpenApiPath = (path) => path.replace(/\{([^}]+)\}/g, ":$1");

test("generated guest API contract exposes canonical Fastify paths", () => {
  assert.equal(GUEST_API_BASE_PATH, "/api/v1");
  assert.deepEqual(guestV1Operations.getGuestAuthBootstrap, { method: "GET", path: "/auth/me" });
  assert.deepEqual(guestV1Operations.updateGuestPersonalProfile, { method: "PATCH", path: "/profiles/personal" });
  assert.deepEqual(guestV1Operations.listPublicEvents, { method: "GET", path: "/public/events" });
  assert.deepEqual(guestV1Operations.initiateCheckout, { method: "POST", path: "/checkout/initiate" });
  assert.deepEqual(guestV1Operations.verifyPayment, { method: "PATCH", path: "/payments/verify" });
  assert.deepEqual(guestV1Operations.getOrderCancelEligibility, { method: "GET", path: "/orders/:orderId/cancel" });
  assert.deepEqual(guestV1Operations.getGuestTickets, { method: "GET", path: "/tickets" });
  assert.deepEqual(guestV1Operations.getGuestTicket, { method: "GET", path: "/tickets/:ticketId" });
});

test("generated guest API client operations stay fresh against the gateway OpenAPI artifact", () => {
  const openApi = JSON.parse(readFileSync(join(root, "../api-gateway/openapi/guest-v1.json"), "utf8"));
  const openApiOperations = new Map();

  for (const [path, methods] of Object.entries(openApi.paths || {})) {
    for (const [method, operation] of Object.entries(methods || {})) {
      if (operation?.operationId) {
        openApiOperations.set(operation.operationId, {
          method: method.toUpperCase(),
          path: normalizeOpenApiPath(path),
        });
      }
    }
  }

  for (const [operationId, generated] of Object.entries(guestV1Operations)) {
    assert.deepEqual(
      generated,
      openApiOperations.get(operationId),
      `${operationId} should match apps/api-gateway/openapi/guest-v1.json`
    );
  }

  assert.deepEqual(
    [...Object.keys(guestV1Operations)].sort(),
    [...openApiOperations.keys()].sort(),
    "generated guest API client must expose every OpenAPI operation"
  );
});

test("generated guest API helper builds parameterized and queried paths", () => {
  assert.equal(buildGuestOperationPath("getPublicEvent", { idOrSlug: "event 1" }), "/public/events/event%201");
  assert.equal(buildGuestOperationPath("getCoverChargeWallet", { walletId: "wallet/1" }), "/cover-charge/wallet/wallet%2F1");
  assert.equal(buildGuestOperationPath("getTicketShareBundle", {}, { token: "abc 123" }), "/tickets/claim?token=abc+123");
});

test("route ownership matrix documents the generated guest contract boundary", () => {
  const matrixPath = join(root, "../../docs/guest-portal-route-ownership-matrix.md");
  assert.equal(existsSync(matrixPath), true, "Guest Portal route ownership matrix should exist");

  const matrix = readFileSync(matrixPath, "utf8");
  for (const phrase of [
    "Frontend owner",
    "Generated operation(s)",
    "Gateway owner",
    "Backend/core owner",
    "Acceptance rule",
  ]) {
    assert.equal(matrix.includes(phrase), true, `route ownership matrix should include ${phrase}`);
  }
});

test("temporary guest compatibility adapter is fully retired from runtime", () => {
  assert.equal(
    existsSync(join(root, "lib/client/gateway.js")),
    false,
    "lib/client/gateway.js should be deleted once runtime callers are on generated guest API helpers"
  );
});

test("production gateway rewrite and type checking are not pinned to localhost-only shortcuts", () => {
  const nextConfig = readFileSync(join(root, "next.config.mjs"), "utf8");

  assert.equal(nextConfig.includes("ignoreBuildErrors: true"), false, "production builds must not ignore TypeScript errors");
  assert.equal(nextConfig.includes("resolveGuestApiOrigin"), true, "gateway rewrite should use the shared guest API origin resolver");
  assert.equal(nextConfig.includes("destination: `${gatewayOrigin}/api/v1/:path*`"), true, "rewrite destination should be derived from gateway env");
});
