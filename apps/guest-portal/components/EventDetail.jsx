"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { formatEventDate } from "@c1rcle/core/time";
import { Minus, Plus, Share2, Music2, ChevronDown, ArrowUpRight, MapPin } from "lucide-react";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getSecondsUntil(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((new Date(dateStr) - Date.now()) / 1000));
}

function formatINR(amount) {
  const n = Number(amount);
  if (!n || isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

function getTierStyle(ticket) {
  const name = (ticket.name || "").toLowerCase();
  const type = (ticket.entryType || "").toLowerCase();
  const g = ticket.gender;

  if (name.includes("vip") || name.includes("open bar") || type === "vip" || type === "backstage") {
    return {
      border: "border-yellow-400/20",
      bg: "bg-yellow-500/[0.04]",
      badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
      label: "VIP",
      glow: "shadow-yellow-500/10",
    };
  }
  if (g === "female" || name.includes("ladies") || name.includes("female") || name.includes("women") || type === "female") {
    return {
      border: "border-rose-400/20",
      bg: "bg-rose-500/[0.04]",
      badge: "bg-rose-500/15 text-rose-300 border-rose-500/25",
      label: "Ladies",
      glow: "shadow-rose-500/10",
    };
  }
  if (name.includes("couple") || name.includes("pair") || type === "couple") {
    return {
      border: "border-pink-400/20",
      bg: "bg-pink-500/[0.04]",
      badge: "bg-pink-500/15 text-pink-300 border-pink-500/25",
      label: "Couple",
      glow: "shadow-pink-500/10",
    };
  }
  if (name.includes("table") || name.includes("booth") || name.includes("creator") || type === "table") {
    return {
      border: "border-violet-400/20",
      bg: "bg-violet-500/[0.04]",
      badge: "bg-violet-500/15 text-violet-300 border-violet-500/25",
      label: "Premium",
      glow: "shadow-violet-500/10",
    };
  }
  if (name.includes("early") || type === "early_bird") {
    return {
      border: "border-sky-400/20",
      bg: "bg-sky-500/[0.04]",
      badge: "bg-sky-500/15 text-sky-300 border-sky-500/25",
      label: "Early Bird",
      glow: "shadow-sky-500/10",
    };
  }
  return {
    border: "border-white/8",
    bg: "bg-white/[0.02]",
    badge: "bg-white/8 text-white/50 border-white/10",
    label: "Entry",
    glow: "",
  };
}

function hashTagStyle(tag) {
  const palette = [
    { bg: "bg-indigo-500/10", border: "border-indigo-400/20", text: "text-indigo-300" },
    { bg: "bg-amber-500/10", border: "border-amber-400/20", text: "text-amber-300" },
    { bg: "bg-emerald-500/10", border: "border-emerald-400/20", text: "text-emerald-300" },
    { bg: "bg-rose-500/10", border: "border-rose-400/20", text: "text-rose-300" },
    { bg: "bg-sky-500/10", border: "border-sky-400/20", text: "text-sky-300" },
    { bg: "bg-violet-500/10", border: "border-violet-400/20", text: "text-violet-300" },
    { bg: "bg-orange-500/10", border: "border-orange-400/20", text: "text-orange-300" },
    { bg: "bg-teal-500/10", border: "border-teal-400/20", text: "text-teal-300" },
  ];
  let hash = 0;
  for (const c of String(tag)) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

function parseSpotifyPath(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

function getAvailability(ticket) {
  const total = Number(ticket.quantity || ticket.totalQuantity || 0);
  const remaining = ticket.remaining ?? ticket.remainingQuantity;

  if (remaining === 0) {
    return { label: "Sold out", barColor: "bg-white/10", textColor: "text-white/25", fill: 0, isSoldOut: true };
  }
  if (remaining !== undefined && total > 0) {
    const pct = Math.max(0, Math.min(1, remaining / total));
    if (pct < 0.12)
      return { label: `${remaining} left`, barColor: "bg-red-500", textColor: "text-red-400", fill: pct, isFewLeft: true };
    if (pct < 0.35)
      return { label: "Few left", barColor: "bg-amber-400", textColor: "text-amber-400", fill: pct, isFewLeft: true };
    return { label: "Available", barColor: "bg-emerald-500", textColor: "text-emerald-400", fill: pct };
  }
  return { label: "Available", barColor: "bg-emerald-500", textColor: "text-emerald-400", fill: 1 };
}

// ─── COUNTDOWN DIGIT ─────────────────────────────────────────────────────────

function CountdownBlock({ label, value }) {
  return (
    <div className="flex flex-col items-center min-w-[3rem]">
      <div className="relative overflow-hidden h-[clamp(2.4rem,6vw,4.8rem)]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: -28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="block text-[clamp(2.4rem,6vw,4.8rem)] font-black tabular-nums leading-none tracking-tighter text-white"
          >
            {String(value).padStart(2, "0")}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="mt-1.5 text-[7px] font-black uppercase tracking-[0.35em] text-white/25">{label}</span>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function EventDetail({
  event,
  host,
  interestedData = { count: 0, users: [] },
  user,
  profile,
  toast,
  onAction,
}) {
  const [scrollY, setScrollY] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [descExpanded, setDescExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => getSecondsUntil(event?.startDate));
  const shareRef = useRef(null);

  // Scroll tracking
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrollY(y);
      setShowStickyBar(y > window.innerHeight * 0.88);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Countdown
  useEffect(() => {
    if (!event?.startDate) return;
    const id = setInterval(() => setTimeLeft(getSecondsUntil(event.startDate)), 1000);
    return () => clearInterval(id);
  }, [event?.startDate]);

  // Close share menu on outside click
  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareOpen]);

  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;
  const isDoorsOpen = timeLeft === 0 && !!event?.startDate;

  // Event image — checks all common field names
  const eventImage = useMemo(() => {
    if (!event) return null;
    return (
      event.image || event.poster || event.posterUrl ||
      event.flyer || event.flyerUrl ||
      (Array.isArray(event.images) ? event.images[0] : null) ||
      (Array.isArray(event.gallery) ? event.gallery[0] : null) ||
      null
    );
  }, [event]);

  const tickets = event?.tickets?.length ? event.tickets : [];

  const startingPrice = useMemo(() => {
    const paid = tickets.filter((t) => Number(t.price) > 0);
    return paid.length === 0 ? 0 : Math.min(...paid.map((t) => Number(t.price)));
  }, [tickets]);

  const isFree = tickets.length > 0 && tickets.every((t) => Number(t.price) === 0);

  const totalSelected = useMemo(
    () => Object.values(quantities).reduce((s, q) => s + Number(q), 0),
    [quantities]
  );

  const totalPrice = useMemo(
    () => tickets.reduce((sum, t) => sum + (quantities[t.id] || 0) * Number(t.price || 0), 0),
    [tickets, quantities]
  );

  const vibeTags = useMemo(
    () =>
      [
        ...(event?.genres || []),
        ...(event?.tags || []),
        event?.category || null,
        event?.dressCode ? `Dress: ${event.dressCode}` : null,
        event?.ageLimit || event?.ageRestriction || null,
      ].filter(Boolean),
    [event]
  );

  const interestedCount = interestedData.count || event?.stats?.saves || 0;
  const isTonight =
    event?.startDate &&
    new Date(event.startDate).toDateString() === new Date().toDateString();
  const isLive = event?.lifecycle === "live" || event?.status === "live";

  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    event?.location || event?.address || event?.venue || "India"
  )}&z=14&ie=UTF8&iwloc=&output=embed`;

  const spotifyPath = parseSpotifyPath(event?.spotifyUrl);

  const setQty = (id, delta, max) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.min(max, Math.max(0, (prev[id] || 0) + delta)),
    }));
  };

  const handleConfirm = () => {
    const selected = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => ({ id, quantity }));
    if (selected.length > 0) onAction?.("BOOK", { tickets: selected });
  };

  const handleShare = (type) => {
    setShareOpen(false);
    onAction?.("SHARE", { id: type });
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative isolate min-h-screen bg-black text-white overflow-x-hidden">

      {/* Film grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[200] opacity-[0.022] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ─── STICKY BAR ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: -70 }}
            animate={{ y: 0 }}
            exit={{ y: -70 }}
            transition={{ type: "spring", stiffness: 440, damping: 42 }}
            className="fixed top-0 left-0 right-0 z-[150] px-3 pt-3"
          >
            <div className="mx-auto max-w-5xl flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/85 px-5 py-3 backdrop-blur-2xl shadow-2xl">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-black font-black text-[10px] shrink-0">
                  C
                </div>
                <p className="text-[11px] font-bold text-white/80 truncate">{event?.title}</p>
                {event?.startDate && (
                  <span className="hidden sm:block shrink-0 text-[10px] text-white/25 font-medium">
                    {formatEventDate(event.startDate)}
                  </span>
                )}
              </div>
              <button
                onClick={() =>
                  document.getElementById("ticket-section")?.scrollIntoView({ behavior: "smooth" })
                }
                className="shrink-0 rounded-full bg-[#F44A22] px-5 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-[#FF5E36] active:scale-95"
              >
                {isFree ? "Get in" : `From ${formatINR(startingPrice)}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100dvh] flex flex-col overflow-hidden">

        {/* Ambient aura — blurred poster fills bg */}
        {eventImage && (
          <div
            className="absolute inset-0 -z-10"
            style={{
              maskImage: "radial-gradient(ellipse 80% 60% at 60% 20%, black 0%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 60% 20%, black 0%, transparent 75%)",
            }}
          >
            <Image
              src={eventImage}
              alt=""
              fill
              className="object-cover blur-[110px] saturate-[2.2] scale-[1.5] opacity-55"
              unoptimized
              priority
            />
          </div>
        )}

        {/* Gradient overlays for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />

        {/* ── Nav ──────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-30 px-4 pt-4 md:px-8 shrink-0"
        >
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-black font-black text-sm">
                C
              </div>
              <span className="hidden sm:block text-[9px] font-black uppercase tracking-[0.4em] text-white/50">
                THE C1RCLE
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Like */}
              <button
                onClick={() => {
                  setIsLiked((v) => !v);
                  onAction?.("LIKE", { val: !isLiked });
                }}
                className={`h-9 w-9 flex items-center justify-center rounded-full border transition-all ${
                  isLiked
                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : "border-white/10 bg-black/30 text-white/40 hover:text-white hover:border-white/20"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill={isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>

              {/* Share */}
              <div className="relative" ref={shareRef}>
                <button
                  onClick={() => setShareOpen((v) => !v)}
                  className="h-9 w-9 flex items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/40 hover:text-white hover:border-white/20 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {shareOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 z-50 flex flex-col gap-0.5 rounded-2xl border border-white/10 bg-[#0d0d0d]/98 p-1.5 backdrop-blur-xl shadow-2xl min-w-[140px]"
                    >
                      {[
                        { id: "copy", label: "Copy link" },
                        { id: "whatsapp", label: "WhatsApp" },
                        { id: "instagram", label: "Instagram" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleShare(s.id)}
                          className="rounded-xl px-4 py-2.5 text-left text-[11px] font-bold text-white/60 hover:bg-white/8 hover:text-white transition-colors"
                        >
                          {s.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.header>

        {/* ── Hero content ─────────────────────────────────────────────── */}
        <div className="relative z-20 mx-auto max-w-7xl w-full px-4 md:px-8 lg:px-10 mt-auto pb-14 pt-10 flex flex-col lg:grid lg:grid-cols-[1fr_360px] lg:items-end lg:gap-14 min-h-[88dvh]">

          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Status chip */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F44A22]/30 bg-[#F44A22]/10 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-[#F44A22]">
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-[#F44A22] ${isLive ? "animate-pulse" : ""}`}
                />
                {isLive ? "Live now" : isTonight ? "Tonight" : event?.category || "Event"}
              </span>
              {event?.isHighDemand && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-amber-400">
                  Selling fast
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-[clamp(2.6rem,8vw,7rem)] font-black uppercase tracking-tighter leading-[0.87] text-white mb-4 max-w-2xl">
              {event?.title || "Event"}
            </h1>

            {/* By host */}
            {host?.name && (
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F44A22] mb-2">
                by {host.name}
              </p>
            )}

            {/* Date · Venue */}
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35 mb-9">
              {formatEventDate(event?.startDate)}
              {(event?.venue || event?.location) && (
                <> &middot; {event?.venue || event?.location}</>
              )}
              {event?.city && <>, {event.city}</>}
            </p>

            {/* Countdown */}
            {event?.startDate && (
              <div className="mb-9">
                {isDoorsOpen ? (
                  <motion.div
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                    className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-3"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-black uppercase tracking-[0.28em] text-emerald-400">
                      Doors open now
                    </span>
                  </motion.div>
                ) : (
                  <div className="flex items-end gap-3 sm:gap-5">
                    <CountdownBlock label="Days" value={days} />
                    <span className="text-white/15 text-2xl font-light pb-5 select-none">:</span>
                    <CountdownBlock label="Hours" value={hours} />
                    <span className="text-white/15 text-2xl font-light pb-5 select-none">:</span>
                    <CountdownBlock label="Min" value={mins} />
                    <span className="text-white/15 text-2xl font-light pb-5 select-none">:</span>
                    <CountdownBlock label="Sec" value={secs} />
                  </div>
                )}
              </div>
            )}

            {/* Social proof + CTA row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {interestedCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-sm font-bold text-white/65">
                    {(interestedCount + 80).toLocaleString()}+ going
                  </span>
                </div>
              )}
              <button
                onClick={() =>
                  document.getElementById("ticket-section")?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-full bg-white px-8 py-4 text-[11px] font-black uppercase tracking-[0.32em] text-black transition-all hover:bg-white/92 active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.12)]"
              >
                {isFree ? "Get in free" : `From ${formatINR(startingPrice)}`}
              </button>
            </div>
          </motion.div>

          {/* Right — poster card (desktop only) */}
          {eventImage && (
            <motion.div
              initial={{ opacity: 0, x: 32, rotate: 4 }}
              animate={{ opacity: 1, x: 0, rotate: 2 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
              className="hidden lg:block w-full aspect-[3/4] rounded-[28px] overflow-hidden shadow-[0_50px_130px_rgba(0,0,0,0.85)] border border-white/8 relative"
            >
              <Image
                src={eventImage}
                alt={event?.title || ""}
                fill
                className="object-cover"
                sizes="380px"
                priority
              />
            </motion.div>
          )}
        </div>

        {/* Scroll cue */}
        <motion.div
          animate={{ opacity: scrollY < 50 ? 0.45 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none"
        >
          <div className="h-9 w-px bg-gradient-to-b from-white/40 to-transparent" />
          <span className="text-[7px] font-black uppercase tracking-[0.45em] text-white/20">Scroll</span>
        </motion.div>
      </section>

      {/* ─── BODY ────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 pt-14 pb-44 sm:px-6 lg:px-8 space-y-4">

        {/* ── About + Vibe (2-col on desktop) ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4">

          {/* About */}
          {event?.description && (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="rounded-[28px] border border-white/8 bg-white/[0.02] p-8 md:p-10"
            >
              <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/25 mb-5">
                About this night
              </p>
              <div
                className={`relative overflow-hidden transition-[max-height] duration-500 ease-in-out ${
                  descExpanded ? "max-h-[600px]" : "max-h-[5.8rem]"
                }`}
              >
                <p className="text-[15px] leading-[1.72] text-white/60 font-medium whitespace-pre-line">
                  {event.description}
                </p>
                {!descExpanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#080808] to-transparent pointer-events-none" />
                )}
              </div>
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-4 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.28em] text-white/25 hover:text-white/50 transition-colors"
              >
                {descExpanded ? "Show less" : "Read more"}
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-300 ${descExpanded ? "rotate-180" : ""}`}
                />
              </button>
            </motion.section>
          )}

          {/* Vibe + heat */}
          {(vibeTags.length > 0 || event?.heatScore > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="rounded-[28px] border border-white/8 bg-white/[0.02] p-8"
            >
              <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/25 mb-5">
                The vibe
              </p>
              <div className="flex flex-wrap gap-2">
                {vibeTags.map((tag, i) => {
                  const s = hashTagStyle(tag);
                  return (
                    <span
                      key={i}
                      className={`rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.border} ${s.text}`}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>

              {event?.heatScore > 0 && (
                <div className="mt-7">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.28em] text-white/20">
                      How hot is this?
                    </p>
                    <span className="text-[10px] font-black text-[#F44A22]">
                      {event.heatScore}
                    </span>
                  </div>
                  <div className="h-[3px] rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${event.heatScore}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.3, ease: "easeOut", delay: 0.2 }}
                      className="h-full rounded-full bg-gradient-to-r from-[#F44A22] to-red-500"
                    />
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </div>

        {/* ── Spotify ──────────────────────────────────────────────────── */}
        {spotifyPath && (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-[28px] border border-white/8 bg-white/[0.02] p-8"
          >
            <div className="flex items-center gap-2 mb-5">
              <Music2 className="w-3.5 h-3.5 text-[#1DB954]" />
              <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/25">
                get in the mood
              </p>
            </div>
            <iframe
              src={`https://open.spotify.com/embed/${spotifyPath}?utm_source=generator&theme=0`}
              width="100%"
              height="80"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-2xl w-full"
              style={{ border: "none", display: "block" }}
            />
          </motion.section>
        )}

        {/* ── Lineup ───────────────────────────────────────────────────── */}
        {event?.artists?.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-[28px] border border-white/8 bg-white/[0.02] p-8 md:p-10"
          >
            <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/25 mb-7">
              Lineup
            </p>
            <div className="flex gap-7 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x">
              {event.artists.map((name, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex flex-col items-center gap-2.5 shrink-0 snap-start"
                >
                  <div className="h-[76px] w-[76px] rounded-full overflow-hidden border-2 border-white/10 bg-zinc-900 ring-2 ring-transparent hover:ring-white/10 transition-all">
                    <Image
                      src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1c1c2e,14142a,0f0f23&fontFamily=Arial&fontSize=38`}
                      alt={name}
                      width={76}
                      height={76}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/50 max-w-[76px] text-center leading-tight">
                    {name}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Ticket tiers ─────────────────────────────────────────────── */}
        <motion.section
          id="ticket-section"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="rounded-[28px] border border-white/8 bg-white/[0.02] p-8 md:p-10"
        >
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/25 mb-1">
                Grab your spot
              </p>
              {tickets.length > 0 && (
                <p className="text-xs text-white/20">
                  {tickets.length} tier{tickets.length > 1 ? "s" : ""} available
                </p>
              )}
            </div>
            {startingPrice > 0 && (
              <p className="text-sm font-bold text-white/30">
                from <span className="text-white">{formatINR(startingPrice)}</span>
              </p>
            )}
          </div>

          {tickets.length === 0 ? (
            <div className="py-14 text-center text-white/15 text-sm">
              Ticket info coming soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {tickets.map((ticket) => {
                const style = getTierStyle(ticket);
                const avail = getAvailability(ticket);
                const qty = quantities[ticket.id] || 0;
                const maxQty = Math.min(ticket.remaining ?? (ticket.quantity || 99), 10);
                const soldOut = avail.isSoldOut;

                return (
                  <motion.div
                    key={ticket.id}
                    whileHover={!soldOut ? { y: -3, transition: { duration: 0.2 } } : {}}
                    className={`rounded-[20px] border p-5 transition-colors ${style.border} ${style.bg} ${
                      soldOut ? "opacity-45" : "hover:border-white/15"
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white leading-snug mb-1.5">
                          {ticket.name}
                        </p>
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.28em] ${style.badge}`}
                        >
                          {style.label}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-lg font-black leading-none tracking-tight ${
                            soldOut ? "line-through text-white/20" : "text-white"
                          }`}
                        >
                          {Number(ticket.price) === 0 ? "Free" : formatINR(ticket.price)}
                        </p>
                      </div>
                    </div>

                    {/* Availability bar */}
                    <div className="mb-4">
                      <div className="h-[3px] w-full rounded-full bg-white/6 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{
                            width: `${Math.max(soldOut ? 0 : 4, (avail.fill || 0) * 100)}%`,
                          }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, ease: "easeOut" }}
                          className={`h-full rounded-full ${avail.barColor}`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {avail.isFewLeft && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                        )}
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${avail.textColor}`}>
                          {avail.label}
                        </span>
                      </div>
                    </div>

                    {/* Qty selector or sold out */}
                    {soldOut ? (
                      <div className="h-10 rounded-full bg-white/4 flex items-center justify-center">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
                          Sold out
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-full bg-black/40 border border-white/8 p-1">
                        <button
                          onClick={() => setQty(ticket.id, -1, maxQty)}
                          disabled={qty === 0}
                          className="h-8 w-8 flex items-center justify-center rounded-full text-white/35 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-white tabular-nums w-5 text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => setQty(ticket.id, 1, maxQty)}
                          disabled={qty >= maxQty}
                          className="h-8 w-8 flex items-center justify-center rounded-full text-white/35 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* ── Host card ────────────────────────────────────────────────── */}
        {host && (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-[28px] border border-white/8 bg-white/[0.02] p-8 md:p-10"
          >
            <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/25 mb-6">
              Hosted by
            </p>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-white/10 bg-zinc-900 shrink-0">
                  {host.avatar ? (
                    <Image
                      src={host.avatar}
                      alt={host.name || ""}
                      width={56}
                      height={56}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-black text-white/50 bg-gradient-to-br from-[#F44A22]/20 to-zinc-900">
                      {(host.name || "H").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-white truncate">{host.name}</p>
                  {(host.eventCount || host.eventsCount) > 0 && (
                    <p className="text-[11px] text-white/30">
                      {host.eventCount || host.eventsCount} events hosted
                    </p>
                  )}
                </div>
              </div>
              {(host.id || host.slug) && (
                <Link
                  href={`/hosts/${host.slug || host.id}`}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/40 hover:border-white/20 hover:text-white/70 transition-all"
                >
                  More events
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </motion.section>
        )}

        {/* ── Location ─────────────────────────────────────────────────── */}
        {(event?.location || event?.venue || event?.address) && (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-[28px] border border-white/8 overflow-hidden"
          >
            {/* Map */}
            <div className="h-60 relative bg-zinc-950">
              <iframe
                title="venue location"
                src={mapSrc}
                width="100%"
                height="100%"
                style={{
                  border: "none",
                  filter: "grayscale(1) brightness(0.55) contrast(1.05)",
                  display: "block",
                }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {/* Inner edge shadow */}
              <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.6)] pointer-events-none rounded-t-[28px]" />
            </div>
            {/* Info */}
            <div className="p-8 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <MapPin className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white mb-0.5">
                    {event?.venue || event?.location}
                  </p>
                  {event?.address && (
                    <p className="text-xs text-white/35 leading-relaxed">{event.address}</p>
                  )}
                </div>
              </div>
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(
                  event?.address || event?.location || event?.venue || ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/40 hover:border-white/20 hover:text-white/70 transition-all"
              >
                Directions
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </motion.section>
        )}

        {/* ── Share strip ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 py-6 flex-wrap">
          <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/15">
            Share this night
          </p>
          <div className="h-px w-10 bg-white/8 hidden sm:block" />
          {[
            { id: "copy", label: "Copy link" },
            { id: "whatsapp", label: "WhatsApp" },
            { id: "instagram", label: "Instagram" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => handleShare(s.id)}
              className="rounded-full border border-white/8 px-4 py-2 text-[10px] font-bold text-white/25 hover:border-white/18 hover:text-white/50 transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>
      </main>

      {/* ─── BOTTOM CTA BAR ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {totalSelected > 0 && (
          <motion.div
            initial={{ y: 120 }}
            animate={{ y: 0 }}
            exit={{ y: 120 }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
            className="fixed bottom-0 left-0 right-0 z-[120] px-3 pb-4 pt-0"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto max-w-2xl flex items-center justify-between gap-4 rounded-full border border-white/12 bg-[#0a0a0a]/92 px-6 py-3.5 backdrop-blur-2xl shadow-[0_-24px_80px_rgba(0,0,0,0.9)]">
              <div>
                <p className="text-sm font-bold text-white leading-snug">
                  {totalSelected} ticket{totalSelected > 1 ? "s" : ""}
                  {totalPrice > 0 && (
                    <> &nbsp;&middot;&nbsp; <span className="text-white/70">{formatINR(totalPrice)}</span></>
                  )}
                </p>
                <p className="text-[9px] text-white/25 uppercase tracking-wider">
                  {totalPrice === 0 ? "Free entry" : "Tap to continue"}
                </p>
              </div>
              <button
                onClick={handleConfirm}
                className="rounded-full bg-[#F44A22] px-7 py-3.5 text-[10px] font-black uppercase tracking-[0.28em] text-white transition-all hover:bg-[#FF5E36] active:scale-95 shadow-[0_4px_30px_rgba(244,74,34,0.4)]"
              >
                {totalPrice === 0 ? "RSVP →" : "Confirm & pay →"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
