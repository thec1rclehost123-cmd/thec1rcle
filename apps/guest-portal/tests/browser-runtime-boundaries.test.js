import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const runtimeFiles = [
  "app/page.js",
  "app/PageClient.jsx",
  "app/robots.js",
  "app/sitemap.js",
  "app/e/[eventId]/page.jsx",
  "app/explore/page.js",
  "app/event/[eventId]/page.jsx",
  "app/event/[eventId]/PageClient.jsx",
  "app/checkout/[eventId]/page.jsx",
  "app/checkout/[eventId]/PageClient.jsx",
  "app/confirmation/[orderId]/page.jsx",
  "app/confirmation/[orderId]/PageClient.jsx",
  "app/[handle]/page.jsx",
  "app/[handle]/PageClient.jsx",
  "app/[handle]/[eventSlug]/page.jsx",
  "app/[handle]/[eventSlug]/PageClient.jsx",
  "app/host/[slug]/page.jsx",
  "app/host/[slug]/PageClient.jsx",
  "app/hosts/page.js",
  "app/venue/[slug]/page.jsx",
  "app/venue/[slug]/PageClient.jsx",
  "app/venue/[slug]/menu/page.jsx",
  "app/venue/[slug]/menu/PageClient.jsx",
  "components/EventDetail.jsx",
  "features/discovery/homepageData.js",
];

const seoRenderingPages = new Set([
  "app/event/[eventId]/page.jsx",
  "app/explore/page.js",
  "app/host/[slug]/page.jsx",
  "app/hosts/page.js",
  "app/venue/[slug]/page.jsx",
]);

test("Guest portal runtime files stay free of server bridge imports and unsafe request helpers", () => {
  for (const relativePath of runtimeFiles) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.equal(source.includes("lib/server/"), false, `${relativePath} must not import lib/server/* runtime helpers`);
    assert.equal(source.includes("next/headers"), false, `${relativePath} must not import next/headers`);
    assert.equal(source.includes("cookies("), false, `${relativePath} must not read request cookies`);
    assert.equal(source.includes("export const revalidate"), false, `${relativePath} must not own ISR revalidation`);

    if (!seoRenderingPages.has(relativePath)) {
      assert.equal(source.includes("generateMetadata"), false, `${relativePath} must not own request-time metadata`);
    } else {
      assert.equal(source.includes("guestServerJson"), true, `${relativePath} metadata must use the server API seam`);
    }
  }
});

test("Guest portal owns only rendering-safe sitemap and robots metadata routes", () => {
  const sitemapPath = join(root, "app/sitemap.js");
  const robotsPath = join(root, "app/robots.js");
  assert.equal(existsSync(sitemapPath), true);
  assert.equal(existsSync(robotsPath), true);

  const sitemapSource = readFileSync(sitemapPath, "utf8");
  const robotsSource = readFileSync(robotsPath, "utf8");
  assert.equal(sitemapSource.includes("guestServerJson"), true, "sitemap must use the server API seam");
  assert.equal(sitemapSource.includes("lib/server"), false, "sitemap must not restore app-local server business modules");
  assert.equal(robotsSource.includes("getSiteUrl"), true, "robots must derive canonical host from SEO config");
  assert.equal(robotsSource.includes("lib/server"), false, "robots must not restore app-local server business modules");
});

test("Guest portal uses the Next 16 proxy convention for API tracing", () => {
  const proxyPath = join(root, "proxy.js");
  const middlewarePath = join(root, "middleware.js");

  assert.equal(existsSync(proxyPath), true, "Next 16 proxy.js should own request tracing");
  assert.equal(existsSync(middlewarePath), false, "deprecated middleware.js should stay removed");

  const source = readFileSync(proxyPath, "utf8");
  assert.equal(source.includes("export function proxy"), true, "proxy.js must export the proxy function");
  assert.equal(source.includes("x-request-id"), true, "proxy should preserve request tracing");
  assert.equal(source.includes('matcher: ["/api/:path*"]'), true, "proxy should stay scoped to API paths");
});
