import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

test("SEO-critical public pages fetch initial data through the server API seam", () => {
  const files = [
    "app/page.js",
    "app/event/[eventId]/page.jsx",
    "app/explore/page.js",
    "app/hosts/page.js",
    "app/venue/[slug]/page.jsx",
    "app/host/[slug]/page.jsx",
  ];

  for (const relativePath of files) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.equal(source.includes("guestServerJson"), true, `${relativePath} must fetch initial public data server-side`);
    assert.equal(source.includes("lib/server"), false, `${relativePath} must not restore app-local server business modules`);
    assert.equal(/fetch\(\s*[`"']\/api\/v1/.test(source), false, `${relativePath} must not raw-fetch /api/v1`);
  }
});

test("Public detail pages expose metadata and canonical SEO helpers", () => {
  const files = [
    "app/event/[eventId]/page.jsx",
    "app/venue/[slug]/page.jsx",
    "app/host/[slug]/page.jsx",
  ];

  for (const relativePath of files) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.equal(source.includes("generateMetadata"), true, `${relativePath} must export generateMetadata`);
    assert.equal(source.includes("alternates"), true, `${relativePath} must define canonical metadata`);
  }

  const eventPage = readFileSync(join(root, "app/event/[eventId]/page.jsx"), "utf8");
  assert.equal(eventPage.includes("application/ld+json"), true, "event pages must render JSON-LD");
});

test("Public directory pages expose canonical metadata", () => {
  const files = [
    "app/page.js",
    "app/explore/page.js",
    "app/hosts/page.js",
  ];

  for (const relativePath of files) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.equal(source.includes("metadata"), true, `${relativePath} must define metadata`);
    assert.equal(source.includes("alternates"), true, `${relativePath} must define canonical metadata`);
  }
});

test("Promoter vanity links resolve server-side before falling back to client resolution", () => {
  const source = readFileSync(join(root, "app/[handle]/[eventSlug]/page.jsx"), "utf8");
  const resolver = readFileSync(join(root, "features/vanity/vanityResolver.js"), "utf8");
  assert.equal(source.includes("loadVanityLink"), true, "vanity route must compose the feature resolver");
  assert.equal(source.includes("guestServerJson"), false, "vanity route must not own gateway fetching");
  assert.equal(resolver.includes("guestServerJson"), true, "vanity feature resolver must call the gateway from the server");
  assert.equal(resolver.includes("/public/promoters/"), true, "vanity feature resolver must use the canonical promoter link API");
  assert.equal(source.includes("redirect("), true, "vanity route must server-redirect when the gateway resolves the link");
  assert.equal(source.includes("<PageClient />"), true, "vanity route must keep the client fallback for unresolved links during migration");
});

test("Public client wrappers accept server-rendered initial data", () => {
  const files = [
    ["app/PageClient.jsx", "initialData"],
    ["app/event/[eventId]/PageClient.jsx", "initialDetail"],
    ["app/venue/[slug]/PageClient.jsx", "initialData"],
    ["app/host/[slug]/PageClient.jsx", "initialData"],
    ["app/hosts/HostsClient.jsx", "initialVenues"],
    ["app/hosts/HostsClient.jsx", "initialHosts"],
    ["components/ExploreClient.jsx", "initialEvents"],
  ];

  for (const [relativePath, propName] of files) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.equal(source.includes(propName), true, `${relativePath} must accept ${propName}`);
  }
});

test("Sitemap and robots are rendering-owned and gateway-backed", () => {
  const sitemap = readFileSync(join(root, "app/sitemap.js"), "utf8");
  const robots = readFileSync(join(root, "app/robots.js"), "utf8");

  assert.equal(sitemap.includes("guestServerJson"), true, "sitemap must fetch public index data through the server API seam");
  assert.equal(sitemap.includes("/public/events?limit=500"), true, "sitemap must include canonical event URLs from gateway public reads");
  assert.equal(sitemap.includes('itemPath("/host"'), true, "sitemap must use canonical host URLs");
  assert.equal(sitemap.includes('itemPath("/venue"'), true, "sitemap must use canonical venue URLs");
  assert.equal(robots.includes("sitemap:"), true, "robots metadata must point crawlers at sitemap.xml");
});

test("Venue menu page renders gateway menu data instead of hard-coded sample inventory", () => {
  const pageClient = readFileSync(join(root, "app/venue/[slug]/menu/PageClient.jsx"), "utf8");
  const menuClient = readFileSync(join(root, "app/venue/[slug]/menu/MenuClient.jsx"), "utf8");

  assert.equal(pageClient.includes("menu={data?.menu || venue.menuDoc || venue.menu || null}"), true);
  assert.equal(menuClient.includes("normalizeMenuSections"), true, "menu client should normalize returned venue/menu payloads");
  assert.equal(menuClient.includes("Neapolitan Pizza"), false, "menu client must not ship hard-coded sample sections");
  assert.equal(menuClient.includes("Mutton Kheema"), false, "menu client must not ship hard-coded sample items");
});
