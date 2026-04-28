import { guestServerJson } from "../lib/api/server";
import { getSiteUrl } from "../features/seo/seoUtils";

export const dynamic = "force-dynamic";

const STATIC_ROUTES = ["", "/explore", "/app", "/hosts", "/about", "/login"];

function extractItems(payload, primaryKey) {
  if (Array.isArray(payload?.[primaryKey])) return payload[primaryKey];
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function lastModified(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function entry(url, source = {}) {
  return {
    url,
    lastModified: lastModified(source.updatedAt || source.createdAt),
  };
}

function itemPath(prefix, item, fields) {
  const identifier = fields.map((field) => item?.[field]).find(Boolean);
  return identifier ? `${prefix}/${encodeURIComponent(identifier)}` : null;
}

async function loadSitemapItems(path, primaryKey) {
  const { response, data } = await guestServerJson(path, {
    forwardCookies: false,
    next: { revalidate: 300 },
  });
  return response.ok ? extractItems(data, primaryKey) : [];
}

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const [events, hosts, venues] = await Promise.all([
    loadSitemapItems("/public/events?limit=500", "events"),
    loadSitemapItems("/public/hosts?limit=200", "hosts"),
    loadSitemapItems("/public/venues?limit=200", "venues"),
  ]);

  return [
    ...STATIC_ROUTES.map((path) => entry(`${siteUrl}${path}`)),
    ...events
      .map((event) => [itemPath("/event", event, ["slug", "id"]), event])
      .filter(([path]) => Boolean(path))
      .map(([path, event]) => entry(`${siteUrl}${path}`, event)),
    ...hosts
      .map((host) => [itemPath("/host", host, ["slug", "username", "handle", "id"]), host])
      .filter(([path]) => Boolean(path))
      .map(([path, host]) => entry(`${siteUrl}${path}`, host)),
    ...venues
      .map((venue) => [itemPath("/venue", venue, ["slug", "id"]), venue])
      .filter(([path]) => Boolean(path))
      .map(([path, venue]) => entry(`${siteUrl}${path}`, venue)),
  ];
}
