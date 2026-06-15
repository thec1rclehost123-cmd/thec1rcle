import PageClient from './PageClient';
import { guestServerJson } from '../../../lib/api/server';
import { buildEventDetailView } from '../../../lib/bff/events.js';
import { isGuestBffEnabled } from '../../../lib/bff/flags.js';
import {
  buildEventJsonLd,
  buildTitle,
  getEventDescription,
  getEventImage,
  getSiteUrl,
} from '../../../features/seo/seoUtils';

const EVENT_REVALIDATE_SECONDS = 30;

async function resolveParams(params) {
  return await params;
}

async function loadEventDetail(eventId) {
  if (!eventId) return null;

  if (isGuestBffEnabled('eventDetail')) {
    const result = await buildEventDetailView(eventId);
    return result.data || null;
  }

  const { response, data } = await guestServerJson(
    `/public/events/${encodeURIComponent(eventId)}`,
    {
      forwardCookies: false,
      next: { revalidate: EVENT_REVALIDATE_SECONDS },
    },
  );

  if (!response.ok) return null;
  return data;
}

export async function generateMetadata({ params }) {
  const resolved = await resolveParams(params);
  const eventId = decodeURIComponent(String(resolved?.eventId || ''));
  const detail = await loadEventDetail(eventId);
  const event = detail?.event || detail || null;

  if (!event) {
    return {
      title: 'Event unavailable | THE.C1RCLE',
      description: 'This C1RCLE event is unavailable or has been removed.',
      alternates: { canonical: `${getSiteUrl()}/event/${encodeURIComponent(eventId)}` },
    };
  }

  const title = event.title || event.name || 'C1RCLE Event';
  const description = getEventDescription(event);
  const image = getEventImage(event);
  const canonical = `${getSiteUrl()}/event/${encodeURIComponent(event.slug || event.id || eventId)}`;

  return {
    title: buildTitle(title),
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function EventDetailPage({ params }) {
  const resolved = await resolveParams(params);
  const eventId = decodeURIComponent(String(resolved?.eventId || ''));
  const detail = await loadEventDetail(eventId);
  const event = detail?.event || detail || null;
  const jsonLd = event ? buildEventJsonLd(event) : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      ) : null}
      <PageClient initialDetail={detail} initialEventId={eventId} />
    </>
  );
}
