import { notFound } from "next/navigation";
import EventRSVP from "../../../components/EventRSVP";
import { getEvent, getEventInterested, getEventGuestlist } from "../../../lib/server/eventStore";
import { getHostByHandle } from "../../../lib/server/hostStore";
import { getVenueBySlug } from "../../../lib/server/venueStore";
import { getHostProfile as getMockHostProfile } from "../../../data/hosts";


export async function generateMetadata({ params }) {
  const identifier = decodeURIComponent(params.eventId);
  const event = await getEvent(identifier);

  if (!event) {
    return {
      title: "Event Not Found",
      description: "The event you are looking for does not exist."
    };
  }

  const title = event.title.toUpperCase();
  const description = event.summary || event.description || "Join us at THE C1RCLE.";
  const images = event.image ? [event.image] : [];

  return {
    title: title,
    description: description,
    openGraph: {
      title: `THE.C1RCLE | ${title}`,
      description: description,
      images: images,
      siteName: "THE.C1RCLE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `THE.C1RCLE | ${title}`,
      description: description,
      images: images,
    }
  };
}

import Link from "next/link";

export const revalidate = 120; // 2-minute ISR — view tracking moved to client-side useEffect in EventRSVP

const AuroraBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-color)]">
    <div className="absolute -top-[30%] left-0 h-[80vh] w-full bg-gradient-to-b from-orange/10 dark:from-iris/10 via-transparent to-transparent blur-[120px] opacity-60" />
    <div className="absolute top-[20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-orange/5 dark:bg-gold/5 blur-[100px] opacity-40 mix-blend-multiply dark:mix-blend-screen animate-pulse" />
  </div>
);

export default async function EventDetailPage({ params }) {
  const identifier = decodeURIComponent(params.eventId);
  const event = await getEvent(identifier);

  if (!event) {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center bg-[var(--bg-color)] px-4">
        <AuroraBackground />
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
              <svg className="h-10 w-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight text-[var(--text-primary)] md:text-6xl">
            Event unavailable
          </h1>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
            The event reference is missing or broken. This link might have expired or the host has removed the listing.
          </p>
          <div className="mt-12">
            <Link
              href="/explore"
              className="inline-flex items-center gap-3 rounded-full bg-orange dark:bg-white px-10 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white dark:text-black shadow-lg shadow-orange/20 dark:shadow-none transition-transform hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Explore Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Determine the primary host profile
  // Q1: Use denormalized data embedded in the event document if available (eliminates 1-2 Firestore reads).
  // Falls back to separate collection queries for events created before the denormalization write path is deployed.
  let hostProfile = null;

  if (event.hostData) {
    // Embedded at write time — no extra Firestore read needed
    hostProfile = { ...event.hostData, type: event.hostData.type || "host" };
  } else if (event.host) {
    // Legacy path: separate collection read
    hostProfile = await getHostByHandle(event.host);
    if (hostProfile) hostProfile.type = "host";
  }

  if (!hostProfile && event.venueData) {
    // Embedded at write time — no extra Firestore read needed
    hostProfile = { ...event.venueData, type: "venue", avatar: event.venueData.photoURL || event.venueData.image };
  } else if (!hostProfile && event.venue) {
    // Legacy path: separate collection read
    const venueSlug = event.venueSlug || event.venue.toLowerCase().replace(/\s+/g, '-');
    const venueProfile = await getVenueBySlug(venueSlug);
    if (venueProfile) {
      hostProfile = {
        ...venueProfile,
        type: "venue",
        avatar: venueProfile.photoURL || venueProfile.image
      };
    }
  }

  // 3. Fallback to mock data if still nothing
  if (!hostProfile) {
    const mock = getMockHostProfile(event.host);
    hostProfile = {
      ...mock,
      type: "host",
      handle: event.host || "@guest",
      slug: (event.host || "@guest").replace("@", "").replace(/\./g, "-")
    };
  }

  // Ensure hostProfile always has a type and fallback slug
  if (hostProfile && !hostProfile.type) hostProfile.type = "host";
  if (hostProfile && !hostProfile.slug) {
    hostProfile.slug = hostProfile.handle ? hostProfile.handle.replace("@", "").replace(/\./g, "-") : hostProfile.id;
  }

  // Fetch live social proof
  const interestedData = await getEventInterested(event.id);

  let guestlist = [];
  if (event.settings?.showGuestlist) {
    guestlist = await getEventGuestlist(event.id);
  }

  // ── Handle Cancelled Event ──
  if (event.lifecycle === "cancelled") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-color)] px-4 py-20">
        <AuroraBackground />

        <div className="relative z-10 w-full max-w-lg text-center">
          {/* Cancelled Badge */}
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 ring-8 ring-red-500/5">
            <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          {/* Event Title */}
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight text-[var(--text-primary)] md:text-5xl">
            Event Cancelled
          </h1>

          <p className="mx-auto mt-4 max-w-md text-base font-medium text-[var(--text-muted)] leading-relaxed">
            <span className="font-bold text-[var(--text-primary)]">{event.title}</span> has been cancelled by the organizer.
          </p>

          {/* Reason */}
          {event.cancellationReason && (
            <div className="mx-auto mt-8 max-w-md rounded-3xl border border-black/5 dark:border-white/5 bg-black/3 dark:bg-white/3 p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                Reason
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {event.cancellationReason}
              </p>
            </div>
          )}

          {/* Refund Info */}
          {event.refundPolicy && (
            <div className="mx-auto mt-4 max-w-md rounded-3xl border border-black/5 dark:border-white/5 bg-black/3 dark:bg-white/3 p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                Refund Status
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {event.refundPolicy === "full"
                  ? "A full refund has been initiated. It will be processed within 5–7 business days."
                  : event.refundPolicy === "partial"
                    ? `A ${event.partialRefundPercent || 50}% refund has been initiated. It will be processed within 5–7 business days.`
                    : "Contact support for refund information."}
              </p>
              {event.refundStatus === "completed" && (
                <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Refunds Processed
                </p>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 flex flex-col items-center gap-4">
            <Link
              href="/explore"
              className="inline-flex items-center gap-3 rounded-full bg-orange dark:bg-white px-10 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white dark:text-black shadow-lg shadow-orange/20 dark:shadow-none transition-transform hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Explore Other Events
            </Link>
            <Link
              href="/profile"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              View My Tickets →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EventRSVP
      event={event}
      host={hostProfile}
      interestedData={interestedData}
      guestlist={guestlist}
    />
  );
}
