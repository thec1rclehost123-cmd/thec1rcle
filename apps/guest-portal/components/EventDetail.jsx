"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { formatEventDate } from "@c1rcle/core/time";
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  Instagram,
  MapPin,
  Minus,
  Plus,
  Share2,
  Sparkles,
  Ticket,
} from "lucide-react";

function formatINR(amount) {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDisplayTitle(value) {
  return String(value || "Event Detail")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function truncateCopy(value, maxLength = 180) {
  if (!value) return "";
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function resolveEventImage(event) {
  if (!event) return null;
  return (
    event.image ||
    event.poster ||
    event.posterUrl ||
    event.flyer ||
    event.flyerUrl ||
    (Array.isArray(event.images) ? event.images[0] : null) ||
    (Array.isArray(event.gallery) ? event.gallery[0] : null) ||
    null
  );
}

function resolveBackdropPoster(event) {
  if (!event) return null;
  return (
    event.poster ||
    event.posterUrl ||
    event.flyer ||
    event.flyerUrl ||
    event.image ||
    (Array.isArray(event.gallery) ? event.gallery[0] : null) ||
    (Array.isArray(event.images) ? event.images[0] : null) ||
    null
  );
}

function parseParagraphs(value) {
  if (!value) return [];
  return String(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTimeLabel(event) {
  if (event?.startTime || event?.endTime) {
    if (event.startTime && event.endTime) {
      return `${event.startTime} - ${event.endTime}`;
    }
    return event.startTime || event.endTime || "";
  }

  if (!event?.startDate) return "";

  try {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    const startLabel = formatter.format(new Date(event.startDate));
    if (!event?.endDate) return startLabel;
    const endLabel = formatter.format(new Date(event.endDate));
    return `${startLabel} - ${endLabel}`;
  } catch {
    return "";
  }
}

function buildHostUrl(host) {
  const target = host?.slug || host?.id;
  if (!target) return "/hosts";
  return host?.type === "venue" ? `/venue/${encodeURIComponent(target)}` : `/host/${encodeURIComponent(target)}`;
}

function buildPosterGradient(event) {
  if (event?.gradientStart && event?.gradientEnd) {
    return `linear-gradient(160deg, ${event.gradientStart} 0%, ${event.gradientEnd} 100%)`;
  }

  const category = String(event?.category || "").toLowerCase();
  if (category.includes("fashion")) {
    return "linear-gradient(160deg, #ff9a62 0%, #f44a22 42%, #2a0805 100%)";
  }
  if (category.includes("art")) {
    return "linear-gradient(160deg, #ff9057 0%, #d13b1b 40%, #120404 100%)";
  }
  return "linear-gradient(160deg, #ff7a18 0%, #f44a22 34%, #5c150f 62%, #080304 100%)";
}

function buildGoingLabel(interestedData) {
  const count = interestedData?.count || 0;
  const leadName = interestedData?.users?.[0]?.name || interestedData?.users?.[0]?.displayName;
  if (leadName && count > 1) {
    return `${leadName} and ${(count - 1).toLocaleString("en-IN")} others going`;
  }
  if (count > 0) {
    return `${count.toLocaleString("en-IN")} going`;
  }
  return "";
}

function buildTagline(event, venueLabel) {
  const primary = truncateCopy(event?.summary || parseParagraphs(event?.description)?.[0], 110);
  if (primary) return primary;
  return `${event?.title || "This event"} at ${venueLabel}.`;
}

function getAvailability(ticket) {
  const quantity = Number(ticket.quantity || ticket.totalQuantity || 0);
  const remaining =
    ticket.remaining !== undefined
      ? Number(ticket.remaining)
      : ticket.remainingQuantity !== undefined
        ? Number(ticket.remainingQuantity)
        : quantity;

  if (remaining <= 0 && quantity > 0) {
    return {
      label: "Sold out",
      isSoldOut: true,
      tone: "text-white/[0.35]",
      barClass: "bg-white/10",
      fill: 0,
    };
  }

  if (quantity > 0 && remaining >= 0) {
    const fill = Math.max(0, Math.min(1, remaining / quantity));
    if (fill <= 0.12) {
      return {
        label: `${remaining} left`,
        isSoldOut: false,
        tone: "text-rose-300",
        barClass: "bg-rose-500",
        fill,
      };
    }
    if (fill <= 0.35) {
      return {
        label: "Few left",
        isSoldOut: false,
        tone: "text-amber-200",
        barClass: "bg-amber-400",
        fill,
      };
    }
    return {
      label: "Available",
      isSoldOut: false,
      tone: "text-emerald-200",
      barClass: "bg-emerald-400",
      fill,
    };
  }

  return {
    label: "Open",
    isSoldOut: false,
    tone: "text-white/[0.65]",
    barClass: "bg-white",
    fill: 1,
  };
}

function getTierLimit(ticket) {
  const maxPerOrder = Number(ticket?.maxPerOrder || 6);
  const remaining =
    ticket?.remaining !== undefined
      ? Number(ticket.remaining)
      : ticket?.remainingQuantity !== undefined
        ? Number(ticket.remainingQuantity)
        : ticket?.quantity !== undefined
          ? Number(ticket.quantity)
          : maxPerOrder;

  if (remaining > 0) {
    return Math.max(0, Math.min(maxPerOrder, remaining));
  }
  if (ticket?.quantity === 0 || ticket?.remaining === 0 || ticket?.remainingQuantity === 0) {
    return 0;
  }
  return maxPerOrder;
}

function getTierBadge(ticket, startingPrice) {
  const name = String(ticket?.name || "").toLowerCase();
  const entryType = String(ticket?.entryType || "").toLowerCase();

  if (name.includes("vip") || entryType === "vip" || entryType === "backstage") {
    return { label: "VIP", classes: "border-amber-300/20 bg-amber-300/10 text-amber-100" };
  }
  if (name.includes("couple") || entryType === "couple") {
    return { label: "Couple", classes: "border-rose-300/20 bg-rose-300/10 text-rose-100" };
  }
  if (name.includes("ladies") || name.includes("female") || ticket?.gender === "female") {
    return { label: "Ladies", classes: "border-pink-300/20 bg-pink-300/10 text-pink-100" };
  }
  if (Number(ticket?.price || 0) === Number(startingPrice || 0) && String(ticket?.name || "").toLowerCase().includes("early")) {
    return { label: "Early", classes: "border-white/[0.15] bg-white/[0.08] text-white" };
  }
  return null;
}

function buildInfoChips(event) {
  return [event?.category || null].filter(Boolean).slice(0, 1);
}

function resolveInstagramProfile(host) {
  const raw =
    host?.socialLinks?.instagram ||
    host?.instagram ||
    host?.instagramHandle ||
    host?.contact?.instagram ||
    (String(host?.handle || "").startsWith("@") ? host.handle : null);

  if (!raw) return null;

  const normalized = String(raw).trim();
  if (!normalized) return null;

  if (normalized.includes("instagram.com")) {
    const url = normalized.startsWith("http") ? normalized : `https://${normalized}`;
    const match = url.match(/instagram\.com\/([^/?#]+)/i);
    const handle = match?.[1] || "instagram";
    return { url, label: `@${handle.replace(/^@/, "")}` };
  }

  const handle = normalized.replace(/^@/, "");
  return {
    url: `https://instagram.com/${handle}`,
    label: `@${handle}`,
  };
}

function MiniAvatar({ person, size }) {
  const image = person?.photoURL || person?.avatar;
  const initials = String(person?.initials || person?.name || person?.displayName || "C")
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === "xl" ? "h-full w-full" : "h-14 w-14 sm:h-16 sm:w-16";

  return (
    <div className={`relative ${sizeClass} overflow-hidden rounded-full border border-white/[0.2] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_40px_rgba(0,0,0,0.34)]`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),transparent)]" />
      {image ? (
        <Image
          src={image}
          alt={person?.name || person?.displayName || ""}
          width={64}
          height={64}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0.03)_62%,rgba(0,0,0,0.14))] text-sm font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-[11px] font-black uppercase tracking-[0.28em] text-white/[0.45]">
      {children}
    </div>
  );
}

function DetailStat({ icon: Icon, label, value, helper }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
        <Icon className="h-4 w-4 text-white/[0.62]" />
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/[0.42]">
          {label}
        </div>
        <div className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-white">
          {value}
        </div>
        {helper && (
          <div className="mt-1 text-sm text-white/[0.48]">
            {helper}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventDetail({
  event,
  host,
  interestedData = { count: 0, users: [] },
  onAction,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [crowdModalOpen, setCrowdModalOpen] = useState(false);
  const [waitlistState, setWaitlistState] = useState({});

  // Track impression and promoter link click on mount
  useEffect(() => {
    if (!event?.id) return;
    const promoterRef = searchParams?.get("ref") || null;
    const body = promoterRef ? { type: "impression", ref: promoterRef } : { type: "impression" };
    fetch(`/api/events/${event.id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {}); // fire-and-forget, never block render
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const posterArtwork = useMemo(() => resolveBackdropPoster(event) || resolveEventImage(event), [event]);
  const eventImage = posterArtwork;
  const backdropPoster = posterArtwork;
  const venueLabel =
    event?.venue || event?.location || event?.venueName || event?.address || "Venue to be announced";
  const addressLabel = event?.address || venueLabel;
  const timeLabel = formatTimeLabel(event);
  const tagline = buildTagline(event, venueLabel);
  const goingLabel = buildGoingLabel(interestedData);
  const hostName = host?.name || event?.host || "THE C1RCLE";
  const hostUrl = buildHostUrl(host);
  const posterGradient = buildPosterGradient(event);
  const appUrl = "https://thec1rcle.com/app";
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLabel)}`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(addressLabel)}&z=14&ie=UTF8&iwloc=&output=embed`;
  const hostAvatar = host?.avatar || host?.photoURL || eventImage;
  const hostInstagram = resolveInstagramProfile(host);
  const infoChips = buildInfoChips(event);
  const displayTitle = formatDisplayTitle(event?.title);

  const tickets = useMemo(() => {
    if (!Array.isArray(event?.tickets)) return [];
    return event.tickets
      .map((ticket, index) => ({ ...ticket, id: ticket?.id || `tier-${index + 1}` }))
      .sort((first, second) => Number(first?.price || 0) - Number(second?.price || 0));
  }, [event?.tickets]);

  const startingPrice = useMemo(() => {
    if (tickets.length === 0) return 0;
    return tickets.reduce((minimum, ticket) => {
      const price = Number(ticket?.price || 0);
      return price < minimum ? price : minimum;
    }, Number.MAX_SAFE_INTEGER);
  }, [tickets]);

  const selectedTickets = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([id, quantity]) => ({ id, quantity }));
  }, [quantities]);

  const totalSelected = useMemo(() => {
    return Object.values(quantities).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
  }, [quantities]);

  const totalPrice = useMemo(() => {
    return tickets.reduce((sum, ticket) => {
      return sum + Number(ticket?.price || 0) * Number(quantities[ticket.id] || 0);
    }, 0);
  }, [tickets, quantities]);

  const crowdPeople = useMemo(() => {
    if (interestedData?.users?.length) return interestedData.users.slice(0, 12);
    return Array.from({ length: 12 }, (_, index) => ({
      id: `fallback-${index}`,
      name: `Guest ${index + 1}`,
    }));
  }, [interestedData]);
  const visibleCrowdPeople = crowdPeople.slice(0, 7);

  const eventCount = host?.eventCount || host?.stats?.events || 1;
  const attendeeCount = host?.attendeeCount || interestedData?.count || 0;

  const handleNotifyMe = useCallback(async (ticket) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setWaitlistState((s) => ({ ...s, [ticket.id]: "loading" }));
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event?.id,
          ticketId: ticket.id,
          userId: user.uid,
          email: user.email,
        }),
      });
      setWaitlistState((s) => ({ ...s, [ticket.id]: res.ok ? "joined" : "error" }));
    } catch {
      setWaitlistState((s) => ({ ...s, [ticket.id]: "error" }));
    }
  }, [user, event?.id, router]);

  const setQuantity = (ticket, nextQuantity) => {
    const limit = getTierLimit(ticket);
    const safeQuantity = Math.max(0, Math.min(limit, nextQuantity));
    setQuantities((current) => ({
      ...current,
      [ticket.id]: safeQuantity,
    }));
  };

  const handlePrimaryAction = () => {
    if (selectedTickets.length > 0) {
      onAction?.("BOOK", { tickets: selectedTickets });
      return;
    }
    onAction?.("BOOK", {});
  };

  const handleSave = () => {
    setSaved((current) => !current);
    onAction?.("LIKE");
  };

  const handleShare = () => {
    onAction?.("SHARE", { id: "copy" });
  };

  return (
    <div className="relative min-h-screen bg-[#050506] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[#050506]" />

        <div className="absolute inset-x-0 top-0 h-[130vh] overflow-hidden">
          {backdropPoster && (
            <Image
              src={backdropPoster}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover object-center opacity-[0.5] blur-[20px] saturate-[1.4] brightness-[0.6] scale-[1.15]"
            />
          )}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_40%,rgba(5,5,6,0.35)_58%,rgba(5,5,6,0.7)_76%,#050506_100%)]" />
        </div>
      </div>

      <div className="relative z-10 px-4 pb-44 pt-16 sm:px-6 sm:pb-36 sm:pt-24 lg:px-8 lg:pb-[34rem] lg:pt-32 xl:px-10">
        <div className="mx-auto max-w-[1380px]">
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,380px)] lg:items-start lg:gap-12">
            <main className="min-w-0 lg:pr-2">
              <div className="pt-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-[12px] font-black uppercase text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      {hostName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/[0.38]">
                        THE C1RCLE PRESENTS
                      </div>
                      <div className="truncate text-[15px] font-bold tracking-tight text-white">
                        {hostName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      className={`rounded-full border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition ${
                        saved
                          ? "border-white/20 bg-white text-black"
                          : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <Bookmark className={`h-[16px] w-[16px] ${saved ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:bg-white/[0.08] hover:text-white"
                    >
                      <Share2 className="h-[16px] w-[16px]" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <h1 className="max-w-3xl font-heading text-[clamp(3rem,6.9vw,5.4rem)] font-black uppercase leading-[0.88] tracking-[-0.075em] text-white">
                  {displayTitle}
                </h1>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="inline-flex min-h-[56px] items-center justify-center rounded-full bg-gradient-to-r from-[#f44a22] via-[#ff6a3f] to-[#ff9b7c] px-8 text-[13px] font-black uppercase tracking-[0.18em] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_18px_40px_rgba(244,74,34,0.2)] transition hover:scale-[1.01] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_20px_44px_rgba(244,74,34,0.3)] sm:min-w-[280px]"
                  >
                    {selectedTickets.length > 0
                      ? `Continue • ${formatINR(totalPrice)}`
                      : tickets.length > 0
                        ? `Book from ${formatINR(startingPrice)}`
                        : "Get Tickets"}
                  </button>

                  <a
                    href="#event-location"
                    className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-8 text-[12px] font-black uppercase tracking-[0.22em] text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:bg-white/[0.09] hover:text-white"
                  >
                    See Venue
                  </a>
                </div>
              </div>

              <div className="mt-8 grid gap-5 border-y border-white/10 py-5 sm:grid-cols-3 sm:gap-6">
                <DetailStat
                  icon={CalendarDays}
                  label="Date"
                  value={event?.startDate ? formatEventDate(event.startDate) : "Date to be announced"}
                />
                <DetailStat
                  icon={Clock3}
                  label="Time"
                  value={timeLabel || "Timing drops soon"}
                />
                <DetailStat
                  icon={MapPin}
                  label="Venue"
                  value={venueLabel}
                  helper={event?.cityLabel || event?.city || ""}
                />
              </div>

              <div className="mt-8 border-b border-white/10 pb-8">
                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.028)_18%,rgba(255,255,255,0.018))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_48px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent)]" />
                  <div className="relative">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/[0.38]">
                          Going
                        </div>
                        {goingLabel ? (
                          <div className="mt-1 text-[16px] font-bold tracking-tight text-white sm:text-[18px]">
                            {goingLabel}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        {interestedData?.count > 0 ? (
                          <div className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-[11px] font-black uppercase tracking-[0.22em] text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                            {interestedData.count.toLocaleString("en-IN")} going
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setCrowdModalOpen(true)}
                          className="inline-flex h-10 items-center rounded-full border border-white/12 bg-white/[0.08] px-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition hover:bg-white/[0.12] hover:text-white"
                        >
                          View more
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3.5 sm:gap-4">
                      {visibleCrowdPeople.map((person) => (
                        <MiniAvatar key={person.id || person.name} person={person} />
                      ))}
                      <button
                        type="button"
                        onClick={() => setCrowdModalOpen(true)}
                        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.2] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] text-[26px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_40px_rgba(0,0,0,0.34)] transition hover:scale-[1.03] hover:bg-white/[0.08] sm:h-16 sm:w-16"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <section id="event-location" className="mt-10 border-b border-white/10 pb-10">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/[0.38]">
                    Location
                  </h2>
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition hover:bg-white/[0.12] hover:text-white"
                  >
                    Open Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#111216] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_48px_rgba(0,0,0,0.24)]">
                  <iframe
                    title={`${event?.title || "Event"} location`}
                    src={mapEmbed}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-[320px] w-full grayscale contrast-125 brightness-75"
                  />
                  {addressLabel && (
                    <div className="px-5 py-4 text-sm text-white/60">
                      {addressLabel}
                    </div>
                  )}
                </div>
              </section>

              <section className="mt-10 pb-10">
                <Link
                  href={hostUrl}
                  className="group relative flex items-center gap-5 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0e0e10] p-5 shadow-[0_2px_24px_rgba(0,0,0,0.5)] transition hover:border-white/[0.14] sm:gap-7 sm:p-7"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

                  <div className="relative shrink-0">
                    <div className="h-[88px] w-[88px] overflow-hidden rounded-full border border-white/10 bg-[#1a1a1d] shadow-[0_12px_40px_rgba(0,0,0,0.5)] sm:h-[108px] sm:w-[108px]">
                      {hostAvatar ? (
                        <Image
                          src={hostAvatar}
                          alt={hostName}
                          width={108}
                          height={108}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f44a22]/20 to-transparent text-[28px] font-black uppercase tracking-[-0.06em] text-white">
                          {hostName.slice(0, 2)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.26em] text-white/[0.36]">
                      Hosted by
                    </div>
                    <div className="mt-1.5 truncate text-[22px] font-black tracking-[-0.04em] text-white sm:text-[26px]">
                      {hostName}
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <div>
                        <span className="text-[18px] font-bold tabular-nums tracking-[-0.03em] text-white">
                          {eventCount}
                        </span>
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/[0.38]">
                          Events
                        </span>
                      </div>
                      <div className="h-3 w-px bg-white/[0.12]" />
                      <div>
                        <span className="text-[18px] font-bold tabular-nums tracking-[-0.03em] text-white">
                          {attendeeCount > 0 ? attendeeCount.toLocaleString("en-IN") : "—"}
                        </span>
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/[0.38]">
                          Reached
                        </span>
                      </div>
                      {hostInstagram && (
                        <>
                          <div className="h-3 w-px bg-white/[0.12]" />
                          <a
                            href={hostInstagram.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/50 transition hover:text-white/90"
                          >
                            <Instagram className="h-3.5 w-3.5" />
                            {hostInstagram.label}
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </Link>

                <section className="relative mt-5 flex h-full min-h-[360px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(23,24,29,0.96)_18%,rgba(23,24,29,0.98))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_54px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-7">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent)]" />
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-orange/20">
                      <img src="/logo-circle.jpg" alt="The C1rcle" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-left">
                      <div className="font-heading text-sm font-black uppercase tracking-[0.18em] text-white">
                        THE C1RCLE
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/[0.42]">
                        App Access
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-8 grid flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-center">
                    <div className="min-w-0">
                      <div className="max-w-[11ch] text-[clamp(2.6rem,4vw,4.2rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-white">
                        Move faster at the door.
                      </div>
                      <div className="mt-5 max-w-[24ch] text-[19px] leading-8 text-white/[0.58]">
                        Ticket vault, direct transfers, cleaner checkout.
                      </div>
                    </div>

                    <div className="flex flex-col items-start justify-center lg:items-end">
                      <div className="rounded-[18px] bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                        <QRCodeSVG value={appUrl} size={172} bgColor="#ffffff" fgColor="#000000" />
                      </div>
                      <div className="mt-4 pl-1 text-sm text-white/[0.55] lg:pr-2">Scan to download</div>
                    </div>
                  </div>

                  <div className="relative mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center text-[12px] text-white/[0.65]">
                    <div className="flex flex-col items-center gap-2">
                      <Ticket className="h-4 w-4 text-white/90" />
                      Instant access
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <Share2 className="h-4 w-4 text-white/90" />
                      Cleaner transfers
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <Sparkles className="h-4 w-4 text-white/90" />
                      Better curation
                    </div>
                  </div>
                </section>
              </section>
            </main>

            <aside className="h-fit self-start">
              <div className="space-y-8 lg:sticky lg:top-24">
                <div className="relative">
                  {eventImage && (
                    <Image
                      src={eventImage}
                      alt=""
                      fill
                      priority
                      unoptimized
                      className="pointer-events-none absolute inset-x-5 inset-y-10 h-auto w-auto rounded-[36px] object-cover opacity-[0.34] blur-[34px] saturate-[1.2] brightness-[0.78] scale-[1.06]"
                    />
                  )}
                  <div
                    className="pointer-events-none absolute inset-x-8 inset-y-14 rounded-[34px] opacity-40 blur-[36px]"
                    style={{ background: posterGradient }}
                  />
                  <div className="relative overflow-hidden rounded-[30px] border border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.18)_28%,rgba(0,0,0,0.28))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent)]" />
                    <div className="relative aspect-[0.78] overflow-hidden rounded-[24px] border border-white/10">
                      <div className="absolute inset-0" style={{ background: posterGradient }} />
                      {eventImage && (
                        <Image
                          src={eventImage}
                          alt={event?.title || ""}
                          fill
                          priority
                          unoptimized
                          className="object-cover opacity-[0.88]"
                        />
                      )}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,6,0.08),rgba(5,5,6,0.54)_72%,rgba(5,5,6,0.84))]" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_42%)]" />

                      <div className="absolute inset-x-0 top-0 p-[18px]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/[0.28] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-white/[0.82] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                            THE C1RCLE
                          </div>
                          <div className="rounded-full border border-white/10 bg-black/[0.28] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/[0.74] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                            {event?.startDate ? formatEventDate(event.startDate) : "Date soon"}
                          </div>
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.34)_20%,rgba(0,0,0,0.44))] p-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg">
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/[0.6]">
                            {event?.category || "Event"}
                          </div>
                          <div className="mt-2.5 text-[26px] font-black uppercase leading-[0.94] tracking-[-0.08em] text-white">
                            {displayTitle}
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-[0.24em] text-white/[0.58]">
                            <span className="truncate">{venueLabel}</span>
                            <span>{tickets.length > 0 ? formatINR(startingPrice) : "Soon"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(17,18,22,0.96)_18%,rgba(17,18,22,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_54px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent)]" />
                  <div className="border-b border-white/10 px-5 py-4">
                    <SectionLabel>Tickets</SectionLabel>
                    <div className="mt-2.5 text-[30px] font-black uppercase tracking-[-0.05em] text-white">
                      {tickets.length > 0 ? `From ${formatINR(startingPrice)}` : "Tickets Soon"}
                    </div>
                    <div className="mt-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white/[0.42]">
                      {tickets.length > 0 ? "Choose your tier" : "Inventory pending"}
                    </div>
                  </div>

                  <div className="space-y-2.5 px-4 py-3.5">
                    {tickets.length === 0 && (
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-white/[0.58]">
                        Door list drops soon.
                      </div>
                    )}

                    {tickets.map((ticket) => {
                      const availability = getAvailability(ticket);
                      const badge = getTierBadge(ticket, startingPrice);
                      const quantity = Number(quantities[ticket.id] || 0);
                      const limit = getTierLimit(ticket);
                      const isSelected = quantity > 0;

                      return (
                        <div
                          key={ticket.id}
                          className={`rounded-[22px] border px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md transition ${
                            isSelected
                              ? "border-orange/35 bg-[linear-gradient(180deg,rgba(244,74,34,0.18),rgba(244,74,34,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_44px_rgba(244,74,34,0.12)]"
                              : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]"
                          } ${availability.isSoldOut ? "opacity-70" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              {badge ? (
                                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${badge.classes}`}>
                                  {badge.label}
                                </span>
                              ) : null}
                              <div className={`${badge ? "mt-2.5" : ""} text-[19px] font-semibold text-white`}>
                                {ticket.name || "Entry Tier"}
                              </div>
                              <div className="mt-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-white/[0.5]">
                                {availability.label}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[26px] font-black tracking-[-0.05em] text-white">
                                {Number(ticket.price || 0) === 0 ? "Free" : formatINR(ticket.price)}
                              </div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/[0.34]">
                                {limit > 0 ? `Limit ${limit}` : "Closed"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                            <div
                              className={`h-full rounded-full ${availability.barClass}`}
                              style={{ width: `${Math.max(6, availability.fill * 100)}%` }}
                            />
                          </div>

                          <div className="mt-3.5 flex items-center justify-end gap-4">
                            {availability.isSoldOut ? (
                              <button
                                type="button"
                                onClick={() => handleNotifyMe(ticket)}
                                disabled={waitlistState[ticket.id] === "loading" || waitlistState[ticket.id] === "joined"}
                                className="w-full rounded-xl border border-white/10 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/60 transition hover:border-white/20 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {waitlistState[ticket.id] === "joined"
                                  ? "You're on the list"
                                  : waitlistState[ticket.id] === "loading"
                                    ? "..."
                                    : "Notify Me"}
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
                                <button
                                  type="button"
                                  onClick={() => setQuantity(ticket, quantity - 1)}
                                  disabled={quantity <= 0}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>

                                <span className="min-w-[20px] text-center text-sm font-semibold text-white">
                                  {quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setQuantity(ticket, quantity + 1)}
                                  disabled={quantity >= limit}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-white/10 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/[0.42]">
                          Cart
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {selectedTickets.length > 0
                            ? `${totalSelected} selected`
                            : tickets.length > 0
                              ? "Pick your tickets"
                              : "Join the waitlist"}
                        </div>
                      </div>
                      <div className="text-lg font-black text-white">
                        {selectedTickets.length > 0 ? formatINR(totalPrice) : tickets.length > 0 ? formatINR(startingPrice) : "--"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#f44a22] via-[#ff6a3f] to-[#ff9b7c] px-6 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_18px_40px_rgba(244,74,34,0.2)] transition hover:scale-[1.01] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_20px_44px_rgba(244,74,34,0.3)]"
                    >
                      <Ticket className="h-4 w-4" />
                      {selectedTickets.length > 0 ? "Continue To Checkout" : tickets.length > 0 ? "Get Tickets" : "Get Notified"}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {crowdModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-12">
          <button
            type="button"
            aria-label="Close going list"
            onClick={() => setCrowdModalOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <div className="relative z-10 w-full max-w-[920px] overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(12,13,18,0.96)_18%,rgba(10,10,14,0.98))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.48)] backdrop-blur-3xl sm:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/[0.42]">
                    Going
                  </div>
                  <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-white sm:text-[36px]">
                    Guest list
                  </div>
                  {interestedData?.count > 0 ? (
                    <div className="mt-2 text-sm text-white/[0.64]">
                      {interestedData.count.toLocaleString("en-IN")} people going
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setCrowdModalOpen(false)}
                  className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/[0.72] transition hover:bg-white/[0.08] hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 flex max-h-[68vh] flex-wrap gap-3 overflow-y-auto pr-1">
                {crowdPeople.map((person) => (
                  <div
                    key={`crowd-modal-${person.id || person.name}`}
                    className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.4)] sm:h-24 sm:w-24"
                  >
                    <MiniAvatar person={person} size="xl" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-8 z-[70] flex justify-center px-4 lg:hidden">
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="group relative flex min-h-[60px] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-[#d35400] to-[#e67e22] px-8 py-4 text-[13px] font-black uppercase tracking-[0.15em] text-white shadow-[0_24px_48px_rgba(211,84,0,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] sm:text-[14px]"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50" />

          <span className="relative z-10 drop-shadow-sm">
            {selectedTickets.length > 0
              ? `Continue • ${formatINR(totalPrice)}`
              : tickets.length > 0
                ? `Buy tickets from ${formatINR(startingPrice)}`
                : "Get Tickets"}
          </span>
        </button>
      </div>
    </div>
  );
}
