"use client";

import Image from "next/image";
import ShimmerImage from "./ShimmerImage";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TicketModal from "./TicketModal";
import GuestlistModal from "./GuestlistModal";
import { useAuth } from "./providers/AuthProvider";
import { useToast } from "./providers/ToastProvider";
import LikeButton from "./LikeButton";
import { saveIntent } from "../lib/utils/intentStore";

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

const NotLiveModal = ({ isOpen, onClose }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm overflow-hidden rounded-[40px] bg-white p-10 text-black text-center"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
              <svg className="h-8 w-8 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className="font-heading text-2xl font-black uppercase tracking-tight">This event is not live.</h2>
          <p className="mt-4 text-sm font-medium text-black/60">
            This event has either ended or is currently disabled. You can still access your tickets from the profile section.
          </p>
          <div className="mt-10 flex flex-col gap-3">
            <button
              onClick={onClose}
              className="rounded-full bg-black py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-black/80"
            >
              Close
            </button>
            <Link
              href="/explore"
              className="rounded-full border border-black/10 py-4 text-xs font-black uppercase tracking-widest text-black transition hover:bg-black/5"
            >
              Back to Explore
            </Link>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

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

const ticketState = (quantity = 0, name = "") => {
  const isCouple = name.toLowerCase().includes("couple") || name.toLowerCase().includes("pair");
  if (quantity <= 0) {
    return { label: "Sold Out", tone: "border-red-500/20 text-red-200 bg-red-500/10", isCouple };
  }
  if (quantity < 35) {
    return { label: "Few Left", tone: "border-amber-400/40 text-amber-200 bg-amber-500/10", isCouple };
  }
  return { label: "Available", tone: "border-emerald-400/30 text-emerald-200 bg-emerald-500/10", isCouple };
};

export default function EventRSVP({ event, host, interestedData = { count: 0, users: [] }, guestlist = [] }) {
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [notLiveModalOpen, setNotLiveModalOpen] = useState(() => {
    const isPastFromStatus = event?.status === "past";
    const isPastFromDate = event?.startDate && new Date(event.startDate) < new Date();
    const isDisabled = event?.settings?.activity === false;
    return isPastFromStatus || isPastFromDate || isDisabled;
  });

  const [rsvpLoading, setRsvpLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, updateEventList } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const { toast } = useToast();

  const interestedUsers = useMemo(() => {
    // If we have real data, use it
    if (interestedData.users.length > 0) {
      return interestedData.users.map((u, i) => ({
        ...u,
        id: u.id || `int-${i}`,
        color: avatarPalette[i % avatarPalette.length]
      }));
    }
    // If count is 0, return empty
    const interestedCount = interestedData.count || event?.stats?.saves || 0;
    if (interestedCount === 0) return [];

    // Otherwise, generate mock directory if needed
    return createGuestDirectory([]);
  }, [interestedData.users, interestedData.count, event?.stats?.saves]);

  const previewInterested = interestedUsers.slice(0, 6);
  const tickets = event?.tickets?.length ? event.tickets : fallbackTickets;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(event?.location || "Pune, India")}&z=14&ie=UTF8&iwloc=&output=embed`;
  const gradientStart = Array.isArray(event?.gradient) ? event.gradient[0] : event?.gradientStart || "#18181b";
  const gradientEnd = Array.isArray(event?.gradient) ? event.gradient[1] : event?.gradientEnd || "#0b0b0f";
  const interestedCount = interestedData.count || event?.stats?.saves || 0;

  const hasRSVPd = Boolean(event?.id && profile?.attendedEvents?.includes(event.id));

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("autoBook") === "true") {
        setTicketModalOpen(true);
        // Clean up the URL
        const newUrl = window.location.pathname;
        window.history.replaceState({ ...window.history.state }, "", newUrl);
      }
    }
  }, []);

  useEffect(() => {
    const handleOpenTicketModal = () => setTicketModalOpen(true);
    window.addEventListener("OPEN_TICKET_MODAL", handleOpenTicketModal);
    return () => window.removeEventListener("OPEN_TICKET_MODAL", handleOpenTicketModal);
  }, []);

  const ensureAuthenticated = (type) => {
    if (user) return true;
    saveIntent(type, event?.id);
    window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
      detail: { intent: type, eventId: event?.id }
    }));
    return false;
  };

  const handleRSVP = async ({ openTickets = false } = {}) => {
    if (!event?.id) return;

    if (openTickets) {
      if (!user) {
        saveIntent("BOOK", event.id);
        window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
          detail: { intent: "BOOK", eventId: event.id }
        }));
        return;
      }
      setTicketModalOpen(true);
      return;
    }

    if (!ensureAuthenticated("RSVP")) return;
    setRsvpLoading(true);
    try {
      await updateEventList("attendedEvents", event.id, !hasRSVPd);
      toast(!hasRSVPd ? "RSVP confirmed" : "RSVP removed", "success");
    } catch (error) {
      console.error("RSVP update failed", error);
      toast("Unable to update RSVP status.", "error");
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
        .then(() => toast("Link copied to clipboard", "success"))
        .catch(() => toast("Unable to copy link", "error"));
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

  const headerGradient = {
    backgroundImage: `linear-gradient(120deg, ${gradientStart}, ${gradientEnd})`
  };

  console.log("EventRSVP render:", { eventId: event?.id, image: event?.image });

  return (
    <div className="relative isolate overflow-hidden pb-28 pt-2 text-[var(--text-primary)] bg-[var(--bg-color)] transition-colors duration-500">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--glass-bg),transparent_45%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[800px] overflow-hidden">
        {event?.image ? (
          <motion.div
            className="relative h-full w-full"
            layoutId={`event-image-${event?.id || ""}`}
          >
            <ShimmerImage
              src={event.image}
              alt={event.title || "Event Image"}
              fill
              className="object-cover opacity-40 dark:opacity-80 blur-[80px] saturate-[1.8]"
              priority
            />
            {/* Seamless gradient fade */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-color)]/40 to-[var(--bg-color)]" />
          </motion.div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(180deg, ${gradientStart}, rgba(0,0,0,0.1) 60%, var(--bg-color))`,
              filter: "blur(50px)",
              opacity: 0.3
            }}
          />
        )}
      </div>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 border-b border-black/[0.03] dark:border-white/[0.05] px-4 py-3 backdrop-blur-3xl sm:px-6 bg-[var(--bg-color)]/40"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.35em] text-[var(--text-secondary)]">
          <div>
            <p className="font-bold">{event?.host}</p>
            <p className="text-[11px] opacity-70">
              {event?.date} · {event?.time || "Time TBA"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LikeButton
              eventId={event?.id}
              onAuthRequired={() => window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'))}
            />
            {shareActions.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleShare(id)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/10 text-[var(--text-primary)] transition hover:border-orange dark:hover:border-white hover:scale-105"
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
          className="rounded-[48px] border border-black/[0.04] dark:border-white/[0.08] bg-white/40 dark:bg-black/40 p-10 shadow-sm backdrop-blur-3xl"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 md:gap-16">
            <div className="flex-1 space-y-8">
              <div className="flex flex-col gap-4">
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display uppercase tracking-[-0.04em] text-black dark:text-white leading-[0.8] active:scale-[0.99] transition-transform duration-300">
                  {event?.title}
                </h1>
              </div>

              {/* Host and Metadata Inline Row */}
              <div className="flex flex-wrap items-center gap-5">
                <p className="text-[13px] font-medium text-black/60 dark:text-white/70">
                  Hosted by <span className="text-black dark:text-white font-black underline underline-offset-4 decoration-orange/30 active:text-orange transition-colors cursor-pointer">{host?.name || event?.host}</span>
                </p>

                <div className="h-4 w-[1px] bg-black/[0.1] dark:bg-white/[0.1] hidden sm:block" />

                <div className="flex items-center gap-3">
                  {/* Trending Pill */}
                  <div className="group relative flex items-center gap-2 rounded-full border border-black/[0.05] dark:border-white/10 bg-white/40 dark:bg-white/5 py-1.5 px-4 backdrop-blur-xl transition-all duration-300 hover:border-orange/20 hover:shadow-[0_0_15px_rgba(244,74,34,0.1)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black dark:text-white">
                      {event?.category || "Trending"}
                    </span>
                  </div>

                  {/* Date Pill */}
                  <div className="group relative flex items-center gap-2 rounded-full border border-black/[0.05] dark:border-white/10 bg-white/40 dark:bg-white/5 py-1.5 px-4 backdrop-blur-xl transition-all duration-300 hover:border-orange/20 hover:shadow-[0_0_15px_rgba(244,74,34,0.1)]">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black dark:text-white">
                      {event?.date}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-10 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-12">
            <div className="flex items-center gap-6">
              <div className="flex -space-x-3.5">
                {previewInterested.map((guest) => (
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white dark:border-black text-[10px] font-black text-black overflow-hidden bg-black/[0.05] dark:bg-white/10 shadow-sm"
                    style={{ backgroundColor: !guest.photoURL || guest.photoURL === "placeholder" ? guest.color : undefined }}
                  >
                    {guest.photoURL && guest.photoURL !== "placeholder" ? (
                      <ShimmerImage src={guest.photoURL} alt={guest.name} width={56} height={56} className="object-cover" />
                    ) : (
                      guest.initials
                    )}
                  </span>
                ))}
                {interestedCount > 6 && (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white dark:border-black bg-zinc-100 dark:bg-zinc-900 text-[10px] font-black text-black dark:text-white shadow-sm">
                    +{interestedCount - 6}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-display uppercase tracking-tight text-black dark:text-white leading-none">
                  {interestedCount.toLocaleString()} <span className="text-[var(--text-muted)] text-sm font-medium tracking-normal lowercase">interested</span>
                </p>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                  People who liked this event
                </p>
              </div>
            </div>

            {/* Relocated Action Buttons */}
            <div className="flex items-center gap-3 w-full lg:w-auto mt-4 sm:mt-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsLiked(!isLiked)}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 backdrop-blur-xl ${isLiked
                  ? "border-orange/30 bg-orange/10 dark:bg-orange/20 shadow-[0_0_20px_rgba(244,74,34,0.15)]"
                  : "border-black/[0.08] dark:border-white/10 bg-black/5 dark:bg-white/[0.05]"
                  }`}
                aria-label="Like event"
              >
                <svg
                  className={`h-6 w-6 transition-all duration-500 ${isLiked ? "fill-orange text-orange" : "text-black/30 dark:text-white/30"}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </motion.button>

              <button
                type="button"
                onClick={() => setGuestModalOpen(true)}
                className="group relative flex-1 min-w-[120px] rounded-full border border-black/[0.08] dark:border-white/20 bg-black/5 dark:bg-white/[0.02] px-8 py-4 text-[10px] font-black uppercase tracking-[0.4em] text-black/60 dark:text-white/60 transition-all hover:bg-black/[0.02] dark:hover:bg-white/5 hover:text-black dark:hover:text-white backdrop-blur-xl active:scale-95"
              >
                Interested
              </button>
              <button
                type="button"
                onClick={() => event?.isFree ? handleRSVP({ openTickets: true }) : setTicketModalOpen(true)}
                className="flex-[1.5] min-w-[160px] rounded-full bg-black dark:bg-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.45em] text-white dark:text-black transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/10 dark:shadow-none"
              >
                {event?.isFree ? "RSVP Now" : "Book Tickets"}
              </button>
            </div>
          </div>
        </motion.section>

        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-10">
          <div className="order-2 lg:order-1 space-y-6 lg:space-y-7">
            <motion.section
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.55 }}
              className="rounded-[40px] border border-black/[0.06] dark:border-white/10 bg-white/60 dark:bg-black/40 p-8 shadow-sm backdrop-blur-md"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-orange dark:text-iris/60">The Intel</p>
              <h3 className="mt-4 text-2xl font-display uppercase tracking-tight text-black dark:text-white">About Event</h3>
              <p className="mt-6 text-base leading-relaxed text-black/70 dark:text-white/60 font-medium">{event?.description}</p>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-black/[0.05] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">When</p>
                  <p className="mt-2 text-black dark:text-white font-black uppercase tracking-tight">
                    {event?.date}
                  </p>
                  <p className="text-[var(--text-muted)] text-[11px] font-bold mt-1">{event?.time || "Time TBA"}</p>
                </div>
                <div className="rounded-3xl border border-black/[0.05] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">Waitlist</p>
                  <p className="mt-2 text-black dark:text-white font-black uppercase tracking-tight italic">
                    Active
                  </p>
                  <p className="text-[var(--text-muted)] text-[11px] font-bold mt-1">30min buffer entry</p>
                </div>
              </div>
            </motion.section>

            <motion.section
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="rounded-[40px] border border-black/[0.06] dark:border-white/10 bg-white/60 dark:bg-black/40 p-8 shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-4 mb-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)]">Social Signal</p>
                  <h3 className="mt-4 text-2xl font-display uppercase tracking-tight text-black dark:text-white">People Liked</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1.5 opacity-60">Verified interest from THE C1RCLE members</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                {previewInterested.map((guest) => (
                  <div key={guest.id} className="flex items-center justify-between gap-4 rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] px-5 py-4 transition-all hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:scale-[1.01]">
                    <div className="flex items-center gap-4">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-2xl text-[10px] font-black text-black overflow-hidden bg-black/[0.05] dark:bg-white/10 shadow-sm"
                        style={{ backgroundColor: !guest.photoURL || guest.photoURL === "placeholder" ? guest.color : undefined }}
                      >
                        {guest.photoURL && guest.photoURL !== "placeholder" ? (
                          <ShimmerImage src={guest.photoURL} alt={guest.name} width={48} height={48} className="object-cover" />
                        ) : (
                          guest.initials
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-black text-black dark:text-white tracking-tight">{guest.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--text-muted)] mt-0.5">{guest.handle}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-black/[0.08] dark:border-white/20 px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] transition hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white active:scale-90"
                    >
                      Follow
                    </button>
                  </div>
                ))}
                {interestedUsers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-1px w-12 bg-black/10 dark:bg-white/10 mb-6" />
                    <p className="text-[10px] font-black text-[var(--text-muted)] tracking-[0.4em] uppercase">No noise yet</p>
                  </div>
                )}
              </div>
              {interestedUsers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setGuestModalOpen(true)}
                  className="mt-8 w-full text-center text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] hover:text-orange transition-colors"
                >
                  View full list
                </button>
              )}
            </motion.section>

            {/* Guestlist Section - Only if enabled and has data */}
            {event?.settings?.showGuestlist && guestlist.length > 0 && (
              <motion.section
                variants={sectionVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-120px" }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className="rounded-[36px] border border-orange/10 dark:border-iris/20 bg-orange/5 dark:bg-iris/5 p-6 shadow-sm dark:shadow-glow backdrop-blur-md"
              >
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-orange dark:text-iris/60">Verified Guestlist</p>
                    <h3 className="mt-2 text-xl font-display uppercase text-[var(--text-primary)]">Who&apos;s Going</h3>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mt-1">Confirmed ticket holders & RSVPs</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {guestlist.slice(0, 10).map((guest) => (
                    <div key={guest.id} className="flex items-center justify-between gap-4 rounded-3xl border border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/40 px-4 py-3 backdrop-blur">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-black overflow-hidden bg-black/5 dark:bg-white/10"
                          style={{ backgroundColor: !guest.photoURL || guest.photoURL === "placeholder" ? guest.color : undefined }}
                        >
                          {guest.photoURL && guest.photoURL !== "placeholder" ? (
                            <ShimmerImage src={guest.photoURL} alt={guest.name} width={40} height={40} className="object-cover" />
                          ) : (
                            guest.initials
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{guest.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{guest.stats}</p>
                        </div>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-orange dark:bg-iris shadow-[0_0_10px_orange] dark:shadow-[0_0_10px_#F44A22]" />
                    </div>
                  ))}
                  {guestlist.length > 10 && (
                    <p className="text-center text-[10px] text-[var(--text-muted)] uppercase tracking-[0.3em] pt-2">
                      + {guestlist.length - 10} verified guests
                    </p>
                  )}
                </div>
              </motion.section>
            )}

            <motion.section
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="rounded-[40px] border border-black/[0.06] dark:border-white/10 bg-white/60 dark:bg-black/40 p-8 shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)]">Coordinates</p>
                  <h3 className="mt-4 text-2xl font-display uppercase tracking-tight text-black dark:text-white">{event?.location}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1.5 opacity-60">{event?.city || "Pune, India"}</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-[32px] border border-black/[0.08] dark:border-white/10 shadow-2xl relative">
                <div className="absolute top-4 left-4 z-10 rounded-full bg-white/90 dark:bg-black/80 px-4 py-2 border border-black/5 dark:border-white/10 shadow-xl backdrop-blur-md">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-black dark:text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange animate-pulse" />
                    Live Destination
                  </p>
                </div>
                <iframe
                  title={`Map for ${event?.location}`}
                  src={mapSrc}
                  className="h-80 w-full grayscale-[1] invert dark:invert-0 opacity-80 contrast-[1.2] hover:grayscale-0 hover:opacity-100 transition-all duration-700"
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
              className="rounded-[36px] border border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/70 p-6 shadow-sm dark:shadow-glow backdrop-blur-md space-y-6"
            >
              <Link
                href={`/host/${event?.host}`}
                className="flex flex-wrap items-center gap-4 group cursor-pointer"
              >
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-black/10 dark:border-white/15 transition-all group-hover:border-orange dark:group-hover:border-white/40 group-hover:scale-105">
                  <Image src={host?.avatar || "/events/holi-edit.svg"} alt={host?.name || "Host"} fill className="object-cover" />
                </div>
                <div>
                  <p className="text-lg font-bold uppercase tracking-tight text-[var(--text-primary)] group-hover:text-orange transition-colors">{host?.name || event?.host}</p>
                  <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">
                    {host?.followers} followers · {host?.location}
                  </p>
                </div>
              </Link>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{host?.bio}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-black/10 dark:border-white/20 bg-black/[0.02] dark:bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--text-secondary)] transition hover:bg-black/[0.05] dark:hover:bg-white/10 hover:border-black/30 dark:hover:border-white/40 sm:flex-none sm:px-8"
                >
                  Message
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full bg-black dark:bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white dark:text-black transition hover:scale-105 shadow-lg sm:flex-none sm:px-8"
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
            className="order-1 lg:order-2 mt-0 space-y-6 lg:mt-0 mb-8 lg:mb-0"
          >
            <div className="rounded-[40px] border border-black/5 dark:border-white/10 bg-white dark:bg-black/70 p-5 shadow-xl dark:shadow-glow backdrop-blur-md">
              <div className="group relative">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[32px] border border-black/5 dark:border-white/10 bg-black shadow-2xl">
                  <ShimmerImage
                    src={event?.image}
                    alt={event?.title || "Event Image"}
                    fill
                    sizes="(max-width: 768px) 100vw, 380px"
                    className="object-cover transition duration-500 group-hover:scale-[1.01] group-hover:rotate-[1deg]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/60 mix-blend-screen opacity-80" />
                </div>
                <div className="absolute inset-x-8 -bottom-5 rounded-[26px] border border-black/5 dark:border-white/10 bg-white/90 dark:bg-black/80 px-5 py-4 text-center text-sm shadow-2xl backdrop-blur-xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--text-muted)]">Share</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    {shareActions.map(({ id, label, Icon }) => (
                      <button
                        key={`poster-${id}`}
                        type="button"
                        onClick={() => handleShare(id)}
                        className="flex h-9 w-9 items-center justify-center rounded-2xl border border-black/5 dark:border-white/20 bg-black/[0.03] dark:bg-white/10 text-[var(--text-primary)] transition hover:scale-110 hover:border-orange dark:hover:border-white/40"
                        aria-label={`${label} from poster`}
                      >
                        <Icon />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-10 space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] mb-4">Tiers</p>
                  <div className="space-y-3">
                    {tickets.map((ticket) => {
                      const state = ticketState(ticket.quantity, ticket.name);
                      return (
                        <div
                          key={ticket.id}
                          className="group relative rounded-[32px] border border-black/[0.04] dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.02] p-5 transition-all duration-300 hover:border-black/[0.1] dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/[0.05] hover:shadow-xl dark:hover:shadow-glow-sm backdrop-blur-sm"
                        >
                          {state.isCouple && (
                            <div className="absolute -top-3 -right-3 rounded-xl bg-orange dark:bg-white px-3 py-1.5 shadow-lg rotate-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-white dark:text-black">Couple · 2 Entries</p>
                            </div>
                          )}
                          <div className="flex items-start justify-between">
                            <div className="space-y-1.5">
                              <p className="text-base font-black uppercase tracking-tight text-black dark:text-white leading-none">{ticket.name}</p>
                              {state.isCouple && (
                                <p className="text-[10px] font-bold text-orange uppercase tracking-widest mt-1">Arrive Together · 1 QR</p>
                              )}
                              <p className="text-[9px] font-bold uppercase text-black/40 dark:text-white/40 tracking-[0.2em]">{ticket.quantity} spots available</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-display text-black dark:text-white tracking-tighter">₹{ticket.price}</p>
                            </div>
                          </div>
                          <div className="mt-5 flex items-center justify-between">
                            <span className={`inline-flex rounded-full border px-4 py-1.5 text-[8px] font-black uppercase tracking-[0.25em] ${state.tone}`}>
                              {state.label}
                            </span>
                            <div className="h-1px w-12 bg-black/[0.05] dark:bg-white/[0.05] group-hover:w-16 transition-all duration-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => setTicketModalOpen(true)}
                    className="w-full rounded-full bg-black dark:bg-white px-5 py-4 text-[10px] font-black uppercase tracking-[0.4em] text-white dark:text-black transition hover:scale-[1.02] active:scale-95 shadow-xl"
                  >
                    {event?.isFree ? "Secure Spot" : "Buy Tickets"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare("copy")}
                    className="w-full rounded-full border border-black/[0.08] dark:border-white/20 px-5 py-4 text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-primary)] transition hover:bg-black/[0.02] dark:hover:bg-white/5 active:scale-95"
                  >
                    Get Pass URL
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
      <GuestlistModal open={guestModalOpen} guests={interestedUsers} onClose={() => setGuestModalOpen(false)} title="Interested List" />
      <TicketModal open={ticketModalOpen} onClose={() => setTicketModalOpen(false)} tickets={tickets} eventId={event?.id} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-0 sm:px-4 pb-8 sm:pb-8"
      >
        <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-none sm:rounded-full border-t sm:border border-black/10 dark:border-white/15 bg-white/95 dark:bg-black/80 px-6 py-4 sm:py-4 text-sm shadow-2xl backdrop-blur-2xl transition-all duration-500">
          {hasRSVPd ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)]">You have {event?.isFree ? "RSVP’d to" : "tickets for"} this event.</p>
              <div className="flex gap-2">
                {event?.isFree && (
                  <button
                    type="button"
                    disabled={rsvpLoading}
                    onClick={() => handleRSVP()}
                    className="rounded-full border border-black/10 dark:border-white/20 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] transition hover:border-red-500 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rsvpLoading ? "..." : "Cancel"}
                  </button>
                )}
                {!event?.isFree && (
                  <button
                    type="button"
                    onClick={() => setTicketModalOpen(true)}
                    className="rounded-full bg-orange dark:bg-white px-6 py-2 text-[9px] font-black uppercase tracking-[0.4em] text-white dark:text-black transition hover:scale-105 shadow-md shadow-orange/20 dark:shadow-none"
                  >
                    Buy More
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[var(--text-primary)] font-black uppercase tracking-[0.3em] text-xs">
                  {event?.isFree ? "Get on the list" : "Tickets Available"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">
                  {event?.isFree ? "Secure your spot" : `From ₹${event?.priceRange?.min || event?.startingPrice || 0}`}
                </p>
              </div>
              <button
                type="button"
                disabled={rsvpLoading}
                onClick={() => event?.isFree ? handleRSVP({ openTickets: true }) : setTicketModalOpen(true)}
                className="rounded-full bg-orange dark:bg-white px-8 py-3 text-[10px] font-black uppercase tracking-[0.4em] text-white dark:text-black transition hover:scale-105 shadow-lg shadow-orange/20 dark:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rsvpLoading ? "..." : (event?.isFree ? "RSVP Now" : "Buy Tickets")}
              </button>
            </>
          )}
        </div>
      </motion.div>
      <NotLiveModal isOpen={notLiveModalOpen} onClose={() => setNotLiveModalOpen(false)} />
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


