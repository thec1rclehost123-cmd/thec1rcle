import { notFound } from "next/navigation";
import EventRSVP from "../../../components/EventRSVP";
import { getEvent, getEventInterested, getEventGuestlist } from "../../../lib/server/eventStore";
import { getHostProfile } from "../../../data/hosts";


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

  const hostProfile = getHostProfile(event.host);

  // Fetch live social proof
  const interestedData = await getEventInterested(event.id);

  let guestlist = [];
  if (event.settings?.showGuestlist) {
    guestlist = await getEventGuestlist(event.id);
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
