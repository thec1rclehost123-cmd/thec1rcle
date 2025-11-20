"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import TicketModal from "./TicketModal";
import GuestlistModal from "./GuestlistModal";
import { useAuth } from "./providers/AuthProvider";

const avatarPalette = ["#FDE047", "#F43F5E", "#A855F7", "#38BDF8", "#34D399", "#F97316"];
const fallbackGuests = ["Ari", "Dev", "Ira", "Nia", "Vik", "Reva", "Luna", "Taj", "Mira", "Noah", "Kian", "Sara"];
const fallbackTickets = [
  { id: "ga", name: "General Admission", price: 899, quantity: 200 },
  { id: "vip", name: "VIP Booth", price: 3200, quantity: 12 },
  { id: "crew", name: "Creator Tables", price: 0, quantity: 0 }
];

const shareActions = [
  { id: "copy", label: "Copy link", Icon: CopyIcon },
  { id: "whatsapp", label: "Share on WhatsApp", Icon: WhatsappIcon },
  { id: "instagram", label: "Share on Instagram", Icon: InstagramIcon }
];

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

const initials = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const buildHandle = (name, index) => {
  const safe = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `@${safe || `guest${index}`}`;
};

const guestStats = (index) => `${20 + index} events · ${Math.max(3, 4 + index)} months on THE C1RCLE`;

const createGuestDirectory = (guests = []) => {
  const source = guests?.length ? guests : fallbackGuests;
  return source.map((name, index) => ({
    id: `${name}-${index}`,
    name,
    handle: buildHandle(name, index),
    stats: guestStats(index),
    color: avatarPalette[index % avatarPalette.length],
    initials: initials(name)
  }));
};

const ticketState = (quantity = 0) => {
  if (quantity <= 0) {
    return { label: "Sold Out", tone: "border-red-500/20 text-red-200 bg-red-500/10" };
  }
  if (quantity < 35) {
    return { label: "Few Left", tone: "border-amber-400/40 text-amber-200 bg-amber-500/10" };
  }
  return { label: "Available", tone: "border-emerald-400/30 text-emerald-200 bg-emerald-500/10" };
};

export default function EventRSVP({ event, host }) {
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [likeLoading, setLikeLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const shareTimer = useRef(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, updateEventList } = useAuth();

  const guestDirectory = useMemo(() => createGuestDirectory(event?.guests), [event?.guests]);
  const previewGuests = guestDirectory.slice(0, 6);
  const tickets = event?.tickets?.length ? event.tickets : fallbackTickets;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(event?.location || "Pune, India")}&z=14&ie=UTF8&iwloc=&output=embed`;
  const gradientStart = Array.isArray(event?.gradient) ? event.gradient[0] : event?.gradientStart || "#18181b";
  const gradientEnd = Array.isArray(event?.gradient) ? event.gradient[1] : event?.gradientEnd || "#0b0b0f";
  const guestCount = event?.guestCount ?? 580 + previewGuests.length * 14;
  const isLiked = Boolean(event?.id && profile?.likedEvents?.includes(event.id));
  const hasRSVPd = Boolean(event?.userHasRSVPd) || Boolean(event?.id && profile?.attendedEvents?.includes(event.id));

  useEffect(() => {
    return () => {
      if (shareTimer.current) {
        window.clearTimeout(shareTimer.current);
      }
    };
  }, []);

  const ensureAuthenticated = () => {
    if (user) return true;
    if (typeof window !== "undefined") {
      const next = pathname || `/event/${event?.id || ""}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
    }
    return false;
  };

  const handleLikeToggle = async () => {
    if (!event?.id || !ensureAuthenticated()) return;
    setLikeLoading(true);
    try {
      await updateEventList("likedEvents", event.id, !isLiked);
      showShareFeedback(!isLiked ? "Saved to profile" : "Removed from saved");
    } catch (error) {
      console.error("Like toggle failed", error);
      showShareFeedback("Unable to update saved events.");
    } finally {
      setLikeLoading(false);
    }
  };

  const handleRSVP = async ({ openTickets = false } = {}) => {
    if (!event?.id || !ensureAuthenticated()) return;
    if (openTickets) {
      setTicketModalOpen(true);
    }
    setRsvpLoading(true);
    try {
      await updateEventList("attendedEvents", event.id, !hasRSVPd);
      showShareFeedback(!hasRSVPd ? "RSVP confirmed" : "RSVP removed");
    } catch (error) {
      console.error("RSVP update failed", error);
      showShareFeedback("Unable to update RSVP status.");
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleShare = (target) => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const payload = `${event?.title || "THE C1RCLE event"} • ${url}`;
    if (target === "copy") {
      navigator.clipboard
        ?.writeText(url)
        .then(() => showShareFeedback("Link copied"))
        .catch(() => showShareFeedback("Unable to copy"));
      return;
    }
    const encoded = encodeURIComponent(payload);
    if (target === "whatsapp") {
      window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (target === "instagram") {
      window.open(`https://www.instagram.com/?url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
    }
  };

  const showShareFeedback = (message) => {
    setShareFeedback(message);
    if (shareTimer.current) {
      window.clearTimeout(shareTimer.current);
    }
    shareTimer.current = window.setTimeout(() => setShareFeedback(""), 2200);
  };

  const headerGradient = {
    backgroundImage: `linear-gradient(120deg, ${gradientStart}, ${gradientEnd})`
  };

  return (
    <div className="relative isolate overflow-hidden pb-28 pt-2 text-white">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_45%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
        style={{
          backgroundImage: `linear-gradient(180deg, ${gradientStart}, rgba(0,0,0,0.1) 60%, #000)`,
          filter: "blur(50px)",
          opacity: 0.5
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 border-b border-white/5 px-4 py-3 backdrop-blur-2xl sm:px-6"
        style={headerGradient}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.35em] text-white/80">
          <div>
            <p>{event?.host}</p>
            <p className="text-[11px] text-white/70">
              {event?.date} · {event?.time || "Time TBA"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-white">
            <button
              type="button"
              onClick={handleLikeToggle}
              disabled={likeLoading}
              className={`flex h-9 w-9 items-center justify-center rounded-2xl border text-white transition ${
                isLiked ? "border-white bg-white/40" : "border-white/40 bg-white/20 hover:border-white hover:bg-white/30"
              }`}
              aria-label={isLiked ? "Remove from liked events" : "Save event"}
            >
              <HeartIcon filled={isLiked} />
            </button>
            {shareActions.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleShare(id)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/40 bg-white/20 text-white transition hover:border-white hover:bg-white/30"
                aria-label={label}
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
      <div className="mx-auto max-w-6xl space-y-10 px-4 pb-32 pt-10 sm:px-6 lg:space-y-12">
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5 }}
          className="glass-panel rounded-[40px] border border-white/10 bg-black/60 p-6 shadow-glow"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-white/40">Announcement</p>
              <h1 className="mt-3 text-4xl font-display uppercase tracking-[0.15em] sm:text-5xl">{event?.title}</h1>
              <p className="mt-3 text-base text-white/70 sm:text-lg">
                Hosted by <span className="text-white">{host?.name || event?.host}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 text-right text-sm text-white/70">
              <span className="rounded-full border border-white/20 px-4 py-1 text-[11px] uppercase tracking-[0.4em] text-white/60">
                {event?.category || "Drop"}
              </span>
              {shareFeedback && <span className="text-xs text-emerald-300">{shareFeedback}</span>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="flex -space-x-4">
              {previewGuests.map((guest) => (
                <span
                  key={guest.id}
                  className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black/40 text-sm font-semibold text-black"
                  style={{ backgroundColor: guest.color }}
                >
                  {guest.initials}
                </span>
              ))}
            </div>
            <div className="text-sm text-white/70">
              <p className="text-white">{guestCount.toLocaleString()} going</p>
              <p>Curated guestlist verified on THE C1RCLE</p>
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-3 text-sm">
              <button
                type="button"
                onClick={() => setGuestModalOpen(true)}
                className="rounded-full border border-white/20 px-5 py-2 text-[11px] uppercase tracking-[0.4em] text-white/80 transition hover:border-white/60"
              >
                View Guestlist
              </button>
              <button
                type="button"
                onClick={() => handleRSVP({ openTickets: true })}
                className="rounded-full bg-white/90 px-6 py-2 text-[11px] uppercase tracking-[0.45em] text-black transition hover:bg-white"
              >
                Get On List
              </button>
            </div>
          </div>
        </motion.section>

        <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-10">
          <div className="space-y-6 lg:space-y-7">
            <motion.section
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.55 }}
              className="glass-panel rounded-[36px] border border-white/10 bg-black/70 p-6 shadow-glow"
            >
              <p className="text-xs uppercase tracking-[0.5em] text-white/40">About the Event</p>
              <p className="mt-4 text-base leading-relaxed text-white/70">{event?.description}</p>
              <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-white/5 p-4 text-sm text-white/70">
                <p className="text-xs uppercase tracking-[0.4em] text-white/40">Schedule</p>
                <p className="mt-2 text-white">
                  {event?.date} · {event?.time || "Time TBA"}
                </p>
                <p className="text-white/60">Doors hold your RSVP for 30 minutes past start time.</p>
              </div>
            </motion.section>

            <motion.section
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="glass-panel rounded-[36px] border border-white/10 bg-black/70 p-6 shadow-glow"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.5em] text-white/40">Location</p>
                  <p className="mt-2 text-lg font-semibold">{event?.location}</p>
                </div>
                <span className="rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-white/60">
                  Map pinned
                </span>
              </div>
              <div className="mt-5 overflow-hidden rounded-[32px] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
                <iframe
                  title={`Map for ${event?.location}`}
                  src={mapSrc}
                  className="h-72 w-full"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </motion.section>

            <motion.section
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="glass-panel rounded-[36px] border border-white/10 bg-black/70 p-6 shadow-glow space-y-6"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/15">
                  <Image src={host?.avatar || "/events/holi-edit.svg"} alt={host?.name || "Host"} fill className="object-cover" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{host?.name || event?.host}</p>
                  <p className="text-sm text-white/60">
                    {host?.followers} followers · {host?.location}
                  </p>
                </div>
              </div>
              <p className="text-sm text-white/70">{host?.bio}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-white/20 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-white/80 transition hover:border-white/60 sm:flex-none sm:px-6"
                >
                  Message
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full bg-white px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-black transition hover:bg-white/90 sm:flex-none sm:px-6"
                >
                  Follow
                </button>
              </div>
            </motion.section>
          </div>

          <motion.aside
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mt-8 space-y-6 lg:mt-0"
          >
            <div className="glass-panel rounded-[40px] border border-white/10 bg-black/70 p-5 shadow-glow">
              <div className="group relative">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[32px] border border-white/10 bg-black">
                  <Image
                    src={event?.image}
                    alt={event?.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 380px"
                    className="object-cover transition duration-500 group-hover:scale-[1.01] group-hover:rotate-[1deg]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/60 mix-blend-screen opacity-80" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),transparent_55%)] opacity-60" />
                </div>
                <div className="absolute inset-x-8 -bottom-5 rounded-[26px] border border-white/10 bg-black/80 px-5 py-4 text-center text-sm text-white/70 shadow-2xl">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Share</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    {shareActions.map(({ id, label, Icon }) => (
                      <button
                        key={`poster-${id}`}
                        type="button"
                        onClick={() => handleShare(id)}
                        className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:border-white/40"
                        aria-label={`${label} from poster`}
                      >
                        <Icon />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-10 space-y-4">
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(true)}
                  className="w-full rounded-full bg-white px-5 py-3 text-[11px] uppercase tracking-[0.4em] text-black transition hover:bg-white/90"
                >
                  See Tickets
                </button>
                <button
                  type="button"
                  onClick={() => handleShare("copy")}
                  className="w-full rounded-full border border-white/20 px-5 py-3 text-[11px] uppercase tracking-[0.4em] text-white/90 transition hover:border-white/50"
                >
                  Get RSVP Link
                </button>
              </div>
              <div className="mt-6 space-y-3">
                {tickets.map((ticket) => {
                  const state = ticketState(ticket.quantity);
                  return (
                    <div
                      key={ticket.id}
                      className="rounded-3xl border border-white/10 bg-black/50 p-4 text-sm text-white/70 shadow-inner"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-semibold text-white">{ticket.name}</p>
                          <p className="text-xs text-white/50">{ticket.quantity} spots</p>
                        </div>
                        <p className="text-lg font-semibold text-white">₹{ticket.price}</p>
                      </div>
                      <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.4em] ${state.tone}`}>
                        {state.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
      <GuestlistModal open={guestModalOpen} guests={guestDirectory} onClose={() => setGuestModalOpen(false)} />
      <TicketModal open={ticketModalOpen} onClose={() => setTicketModalOpen(false)} tickets={tickets} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
      >
        <div className="glass-panel flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-full border border-white/15 bg-black/70 px-6 py-3 text-sm shadow-glow">
          {hasRSVPd ? (
            <>
              <p className="text-white/80">You have RSVP’d to this event.</p>
              <button
                type="button"
                disabled={rsvpLoading}
                onClick={() => handleRSVP()}
                className="rounded-full border border-white/20 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-white/80 transition hover:border-white/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rsvpLoading ? "Updating..." : "Cancel RSVP"}
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-white font-semibold uppercase tracking-[0.35em]">Get on the list</p>
                <p className="text-xs text-white/60">Secure your RSVP before doors close.</p>
              </div>
              <button
                type="button"
                disabled={rsvpLoading}
                onClick={() => handleRSVP({ openTickets: true })}
                className="rounded-full bg-white px-6 py-2 text-[11px] uppercase tracking-[0.4em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/60"
              >
                {rsvpLoading ? "Processing..." : "RSVP Now"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 9.5V6.5C9 5.4 9.9 4.5 11 4.5H18C19.1 4.5 20 5.4 20 6.5V13.5C20 14.6 19.1 15.5 18 15.5H15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="4" y="8.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5C7.9 3.5 4.5 6.8 4.5 10.9C4.5 12.7 5.2 14.4 6.4 15.7L5.5 19.5L9.4 18.6C10.6 19.3 11.8 19.6 13 19.6C17.1 19.6 20.5 16.3 20.5 12.1C20.5 7.9 17.1 3.5 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 9C9.5 9 9 10.7 12 13.8C15 16.9 16.7 16.4 16.7 16.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg width="17" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-6.5-4.2-8.5-7.8C2.4 9.5 3 6.4 5.6 5.2 8.2 4 10.4 5.8 12 7.6c1.6-1.8 3.8-3.6 6.4-2.4 2.6 1.2 3.2 4.3 2.1 7-2 3.6-8.5 7.8-8.5 7.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}
