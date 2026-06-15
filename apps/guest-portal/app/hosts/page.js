import HostsClient from './HostsClient';
import { guestServerJson } from '../../lib/api/server';
import { getSiteUrl } from '../../features/seo/seoUtils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Hosts & Venues | THE.C1RCLE',
  description: 'Discover C1RCLE venues, hosts, DJs, collectives, and nightlife curators.',
  alternates: { canonical: `${getSiteUrl()}/hosts` },
};

function extractItems(payload, primaryKey) {
  if (Array.isArray(payload?.[primaryKey])) return payload[primaryKey];
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function loadHostsDirectoryData() {
  const [venuesResult, hostsResult] = await Promise.all([
    guestServerJson('/public/venues?limit=24', {
      forwardCookies: false,
      next: { revalidate: 120 },
    }),
    guestServerJson('/public/hosts?limit=24', { forwardCookies: false, next: { revalidate: 120 } }),
  ]);

  const errors = [];
  if (!venuesResult.response.ok) errors.push('Venue directory data is temporarily unavailable.');
  if (!hostsResult.response.ok) errors.push('Host directory data is temporarily unavailable.');

  return {
    venues: venuesResult.response.ok ? extractItems(venuesResult.data, 'venues') : [],
    hosts: hostsResult.response.ok ? extractItems(hostsResult.data, 'hosts') : [],
    errors,
  };
}

export default async function HostsPage() {
  const { venues, hosts, errors } = await loadHostsDirectoryData();
  return <HostsClient initialVenues={venues} initialHosts={hosts} initialErrors={errors} />;
}
