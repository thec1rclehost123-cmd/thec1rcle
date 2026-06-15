import PageClient from './PageClient';
import { redirect } from 'next/navigation';
import { buildVanityRedirectTarget, loadVanityLink } from '../../../features/vanity/vanityResolver';

async function resolveParams(params) {
  return await params;
}

async function resolveSearchParams(searchParams) {
  return await searchParams;
}

export default async function VanityEventPage({ params, searchParams }) {
  const resolvedParams = await resolveParams(params);
  const handle = decodeURIComponent(String(resolvedParams?.handle || '')).toLowerCase();
  const eventSlug = decodeURIComponent(String(resolvedParams?.eventSlug || ''));
  const link = await loadVanityLink(handle, eventSlug);
  const redirectTarget = buildVanityRedirectTarget(link, await resolveSearchParams(searchParams));

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  return <PageClient />;
}
