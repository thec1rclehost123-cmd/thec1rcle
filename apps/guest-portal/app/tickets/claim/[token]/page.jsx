import PageClient from './PageClient';
import { guestServerJson } from '../../../../lib/api/server';
import {
  buildTitle,
  getEventImage,
  getSiteUrl,
} from '../../../../features/seo/seoUtils';

async function loadShareBundle(token) {
  if (!token) return null;
  const { response, data } = await guestServerJson(
    `/tickets/claim?token=${encodeURIComponent(token)}`,
    { forwardCookies: false, cache: 'no-store' },
  );
  if (!response.ok) return null;
  return data?.bundle || null;
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const token = String(resolved?.token || '');
  const bundle = await loadShareBundle(token);
  const event = bundle?.event || null;

  if (!bundle || !event) {
    return {
      title: 'Claim Ticket | THE.C1RCLE',
      description: 'Claim your ticket and join the C1RCLE.',
      alternates: { canonical: `${getSiteUrl()}/tickets/claim/${encodeURIComponent(token)}` },
    };
  }

  const title = event.title || event.name || 'C1RCLE Event';
  const image = getEventImage(event);
  const senderName = bundle.senderName || bundle.senderEmail?.split('@')[0] || 'Someone';
  const canonical = `${getSiteUrl()}/tickets/claim/${encodeURIComponent(token)}`;
  const description = `${senderName} sent you ${bundle.remainingSlots > 1 ? `tickets` : 'a ticket'} to ${title}. Claim it now on THE.C1RCLE.`;

  const startDate = event.startDateTime || event.startAt || event.startDate;
  const venueName = event.venueName || event.venue || event.location;
  let dateStr = '';
  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      dateStr = d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) + ' • ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
  }
  const richDescription = [dateStr, venueName, description].filter(Boolean).join(' | ');

  return {
    title: buildTitle(`Claim ${title}`),
    description: richDescription,
    alternates: { canonical },
    openGraph: {
      title: `${senderName} sent you ${bundle.remainingSlots > 1 ? 'tickets' : 'a ticket'} to ${title}`,
      description: richDescription,
      url: canonical,
      type: 'website',
      siteName: 'THE.C1RCLE',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${senderName} sent you ${bundle.remainingSlots > 1 ? 'tickets' : 'a ticket'} to ${title}`,
      description: richDescription,
      images: [image],
    },
  };
}

export default function Page(props) {
  return <PageClient {...props} />;
}
