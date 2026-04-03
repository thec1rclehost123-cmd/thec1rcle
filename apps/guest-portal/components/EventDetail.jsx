"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { formatEventDate } from "@c1rcle/core/time";
import { selectInterestedUsersForDisplay } from "../lib/server/eventAudienceUtils";
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Instagram,
  MapPin,
  Minus,
  Plus,
  Share2,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";

const AMBIENT_DOTS = [
  { left: "6%", size: 4, duration: 11, delay: 0.2, drift: 18 },
  { left: "12%", size: 6, duration: 14, delay: 1.1, drift: -22 },
  { left: "18%", size: 5, duration: 10, delay: 0.6, drift: 16 },
  { left: "25%", size: 4, duration: 15, delay: 2.1, drift: -18 },
  { left: "33%", size: 6, duration: 12, delay: 1.7, drift: 24 },
  { left: "41%", size: 4, duration: 16, delay: 0.4, drift: -14 },
  { left: "49%", size: 5, duration: 13, delay: 2.6, drift: 20 },
  { left: "57%", size: 4, duration: 11, delay: 1.3, drift: -26 },
  { left: "64%", size: 6, duration: 15, delay: 0.9, drift: 18 },
  { left: "72%", size: 4, duration: 12, delay: 2.8, drift: -20 },
  { left: "81%", size: 5, duration: 14, delay: 0.7, drift: 22 },
  { left: "90%", size: 4, duration: 10, delay: 1.9, drift: -16 },
  { left: "3%", size: 3, duration: 13, delay: 2.4, drift: 12 },
  { left: "9%", size: 5, duration: 9, delay: 3.1, drift: -15 },
  { left: "15%", size: 3, duration: 16, delay: 1.4, drift: 14 },
  { left: "21%", size: 4, duration: 12, delay: 0.8, drift: -12 },
  { left: "28%", size: 3, duration: 15, delay: 2.9, drift: 18 },
  { left: "36%", size: 5, duration: 11, delay: 1.9, drift: -20 },
  { left: "45%", size: 3, duration: 14, delay: 3.5, drift: 16 },
  { left: "53%", size: 4, duration: 10, delay: 0.5, drift: -18 },
  { left: "61%", size: 3, duration: 17, delay: 2.2, drift: 15 },
  { left: "69%", size: 5, duration: 12, delay: 1.2, drift: -14 },
  { left: "77%", size: 3, duration: 15, delay: 3.3, drift: 17 },
  { left: "85%", size: 4, duration: 11, delay: 0.9, drift: -19 },
  { left: "94%", size: 3, duration: 16, delay: 2.7, drift: 13 },
];

/* ─── Utility helpers ────────────────────────────────────────────────────── */

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
  const target = host?.username || host?.handle || host?.slug || host?.id;
  if (!target) return "/explore";
  return host?.type === "venue" ? `/venue/${encodeURIComponent(target)}` : `/${encodeURIComponent(target)}`;
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
  return "";
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

function getTierLimit(ticket, pendingTotalFree = 0, currentQty = 0) {
  const maxPerOrder = Number(ticket?.maxPerOrder || 10);
  const remaining =
    ticket?.remaining !== undefined
      ? Number(ticket.remaining)
      : ticket?.remainingQuantity !== undefined
        ? Number(ticket.remainingQuantity)
        : ticket?.quantity !== undefined
          ? Number(ticket.quantity)
          : maxPerOrder;

  const isFree = Number(ticket?.price || 0) === 0;
  let computedMax = maxPerOrder;

  if (isFree) {
    computedMax = Math.max(0, Math.min(1, currentQty + (1 - pendingTotalFree)));
  }

  if (remaining > 0) {
    return Math.max(0, Math.min(computedMax, remaining));
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

function formatDateShort(event) {
  if (!event?.startDate) return "Date TBA";
  try {
    const d = new Date(event.startDate);
    const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" });
    const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Kolkata" });
    const date = d.toLocaleDateString("en-US", { day: "2-digit", timeZone: "Asia/Kolkata" });
    return `${day}, ${month} ${date}`;
  } catch {
    return "Date TBA";
  }
}

function formatTimeShort(event) {
  if (event?.startTime) return event.startTime;
  if (!event?.startDate) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }).format(new Date(event.startDate));
  } catch {
    return "";
  }
}

/* ─── Extract dominant color from image for glow effect ──────────────────── */

const _colorCache = {};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(hue2rgb(p, q, h + 1/3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1/3) * 255)];
}

function clampColor(r, g, b) {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.min(s, 70);
  l = Math.min(l, 55);
  const [cr, cg, cb] = hslToRgb(h, s, l);
  return `${cr}, ${cg}, ${cb}`;
}

function useDominantColor(imageUrl) {
  const [color, setColor] = useState(() => (imageUrl && _colorCache[imageUrl]) || null);

  useEffect(() => {
    if (!imageUrl) return;
    if (_colorCache[imageUrl]) { setColor(_colorCache[imageUrl]); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 40, 40);
        const data = ctx.getImageData(0, 0, 40, 40).data;

        let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const weight = 0.3 + saturation * 0.7;
          rTotal += r * weight;
          gTotal += g * weight;
          bTotal += b * weight;
          count += weight;
        }

        if (count > 0) {
          const result = clampColor(Math.round(rTotal / count), Math.round(gTotal / count), Math.round(bTotal / count));
          _colorCache[imageUrl] = result;
          setColor(result);
        }
      } catch {
        setColor("244, 74, 34");
      }
    };
    img.onerror = () => setColor("244, 74, 34");
  }, [imageUrl]);

  return color || "244, 74, 34";
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function MiniAvatar({ person, size }) {
  const image = person?.photoURL || person?.avatar;
  const initials = String(person?.initials || person?.name || person?.displayName || "C")
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === "xl" ? "h-full w-full" : size === "lg" ? "h-20 w-20 text-[20px]" : size === "sm" ? "h-8 w-8 text-[9px]" : "h-10 w-10 text-[10px]";

  return (
    <div className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-lg`}>
      {image ? (
        <Image
          src={image}
          alt={person?.name || person?.displayName || ""}
          width={48}
          height={48}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/15 to-white/5 font-bold text-white/80">
          {initials}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, className = "" }) {
  return (
    <div className={`text-[10px] font-black uppercase tracking-[0.28em] text-white/40 ${className}`}>
      {children}
    </div>
  );
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LIVE_WINDOW_MS = 6 * HOUR;

function getCountdownState(targetDate) {
  if (!targetDate) return { status: "hidden", diff: 0 };
  const diff = targetDate.getTime() - Date.now();
  if (diff > 0) return { status: "upcoming", diff };
  if (Math.abs(diff) <= LIVE_WINDOW_MS) return { status: "live", diff };
  return { status: "ended", diff };
}

function toCountdownParts(diff) {
  const remaining = Math.max(diff, 0);
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
  };
}

function padCountdown(value) {
  return String(value).padStart(2, "0");
}

function EventCountdown({ event, dominantColor }) {
  const targetDate = useMemo(() => {
    if (!event?.startDate) return null;
    const value = event?.startTime ? `${event.startDate}T${event.startTime}` : event.startDate;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [event?.startDate, event?.startTime]);

  const [state, setState] = useState(() => getCountdownState(targetDate));

  useEffect(() => {
    setState(getCountdownState(targetDate));
    if (!targetDate) return undefined;
    const interval = window.setInterval(() => {
      setState(getCountdownState(targetDate));
    }, SECOND);
    return () => window.clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || state.status === "hidden") return null;

  const parts = toCountdownParts(state.diff);
  const countdownValue = `${padCountdown(parts.days)}:${padCountdown(parts.hours)}:${padCountdown(parts.minutes)}:${padCountdown(parts.seconds)}`;

  return (
    <GlassCard className="px-4 py-4 sm:px-5 sm:py-4" glowColor={dominantColor}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/42">
            {state.status === "upcoming" ? "Party starts in" : state.status === "live" ? "Party is live" : "Party closed"}
          </div>
          <div
            className="mt-1 font-black leading-none tracking-[-0.08em] text-white"
            style={{
              fontSize: "clamp(1.55rem, 4vw, 2.5rem)",
              textShadow: `0 0 22px rgba(${dominantColor}, 0.16), 0 0 42px rgba(${dominantColor}, 0.08)`,
            }}
          >
            {state.status === "upcoming" ? countdownValue : "00:00:00:00"}
          </div>
        </div>
        <span
          className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${state.status === "live" ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" : "bg-white/70 shadow-[0_0_16px_rgba(255,255,255,0.28)]"}`}
        />
      </div>
    </GlassCard>
  );
}

function AmbientDots({ dominantColor }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {AMBIENT_DOTS.map((dot, index) => (
          <span
            key={index}
            className="event-detail-dot absolute rounded-full"
            style={{
              left: dot.left,
              bottom: "-6%",
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
              "--dot-drift": `${dot.drift}px`,
              background: index % 3 === 0 ? "rgba(255,255,255,0.82)" : `rgba(${dominantColor}, ${index % 2 === 0 ? 0.88 : 0.62})`,
              boxShadow: index % 3 === 0
                ? "0 0 18px rgba(255,255,255,0.32)"
                : `0 0 20px rgba(${dominantColor}, 0.34)`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        .event-detail-dot {
          animation-name: event-detail-float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          opacity: 0;
          will-change: transform, opacity;
        }

        @keyframes event-detail-float {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          12% {
            opacity: 0.92;
          }
          82% {
            opacity: 0.85;
          }
          100% {
            transform: translate3d(var(--dot-drift), -110vh, 0);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

/* ─── Glass Card wrapper ─────────────────────────────────────────────────── */

function GlassCard({ children, className = "", glowColor, onClick, as = "div", style }) {
  const Tag = as;
  const extraProps = {};

  if (as === "button") {
    extraProps.type = "button";
  }

  return (
    <Tag
      {...extraProps}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[24px] border border-solid bg-black/60 backdrop-blur-xl transition-all duration-300 ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""} ${className}`}
      style={{
        borderColor: glowColor ? `rgba(${glowColor}, 0.3)` : "rgba(255,255,255,0.08)",
        boxShadow: glowColor 
          ? `0 24px 60px rgba(0,0,0,0.4), inset 0 0 40px rgba(${glowColor}, 0.1), inset 0 0 2px 1px rgba(${glowColor}, 0.2)`
          : "0 24px 60px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      <div 
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] opacity-70" 
        style={{
          background: glowColor ? `linear-gradient(90deg, transparent, rgba(${glowColor}, 0.8), transparent)` : "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)"
        }}
      />
      <div className="relative z-10 h-full">
        {children}
      </div>
    </Tag>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────────── */

export default function EventDetail({
  event,
  host,
  interestedData = { count: 0, users: [] },
  onAction,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [quantities, setQuantities] = useState({});
  const [crowdModalOpen, setCrowdModalOpen] = useState(false);
  const [waitlistState, setWaitlistState] = useState({});
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Track impression on mount
  useEffect(() => {
    if (!event?.id) return;
    const promoterRef = searchParams?.get("ref") || null;
    const body = promoterRef ? { type: "impression", ref: promoterRef } : { type: "impression" };
    fetch(`/api/events/${event.id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const posterArtwork = useMemo(() => resolveBackdropPoster(event) || resolveEventImage(event), [event]);
  const eventImage = posterArtwork;
  const dominantColor = useDominantColor(eventImage);
  const venueLabel =
    event?.venue || event?.location || event?.venueName || event?.address || "Venue to be announced";
  const addressLabel = event?.address || venueLabel;
  const timeLabel = formatTimeLabel(event);
  const goingLabel = buildGoingLabel(interestedData);
  const hostName = host?.name || event?.host || "THE C1RCLE";
  const organizerLabel = hostName && hostName !== venueLabel ? hostName : venueLabel;
  const hostUrl = buildHostUrl(host);
  const posterGradient = buildPosterGradient(event);
  const appUrl = "https://thec1rcle.com/app";
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLabel)}`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(addressLabel)}&z=14&ie=UTF8&iwloc=&output=embed`;
  const hostAvatar = host?.avatar || host?.photoURL || eventImage;
  const hostInstagram = resolveInstagramProfile(host);
  const displayTitle = formatDisplayTitle(event?.title);
  const dateShort = formatDateShort(event);
  const timeShort = formatTimeShort(event);
  const description = event?.description || event?.summary || "";
  const descriptionParagraphs = parseParagraphs(description);
  const aboutText = event?.summary || descriptionParagraphs[0] || "";

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

  const totalFreeSelected = useMemo(() => {
    return tickets.reduce((sum, ticket) => {
      const isFree = Number(ticket?.price || 0) === 0;
      return sum + (isFree ? Number(quantities[ticket.id] || 0) : 0);
    }, 0);
  }, [tickets, quantities]);

  const crowdPeople = useMemo(() => {
    if (interestedData?.users?.length) {
      return selectInterestedUsersForDisplay(interestedData.users, 12);
    }
    return [];
  }, [interestedData]);
  const visibleCrowdPeople = crowdPeople.slice(0, 5);

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

  /* ─── Schedule helper ──────────────────────────────────────────────────── */
  const scheduleDate = event?.startDate ? formatEventDate(event.startDate) : "Date soon";
  const scheduleDoorNote = event?.doorPolicy || (timeShort ? `Doors into your sector for 30 minutes past start time.` : "");
  const tagline = buildTagline(event, venueLabel);
  const cityLabel = event?.cityLabel || event?.city || host?.city || "";
  const isFreeEntry = tickets.length > 0 && tickets.every((ticket) => Number(ticket?.price || 0) === 0);
  const startsFree = tickets.length > 0 && Number(startingPrice || 0) === 0;
  const entryLabel = tickets.length > 0 ? (isFreeEntry ? "Free RSVP" : startsFree ? "From Free" : `From ${formatINR(startingPrice)}`) : "Tickets Soon";
  const ticketLeadCopy = tickets.length > 0
    ? "Reserve your spot."
    : "Ticket tiers will appear here once the drop is live.";
  const noteLabel = event?.doorPolicy ? "Door policy" : event?.dressCode ? "Dress code" : "Heads up";
  const noteValue = event?.doorPolicy || (event?.dressCode ? String(event.dressCode).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "Arrive early for the smoothest entry window.");
  const stickySupportLabel = [venueLabel, timeLabel || dateShort].filter(Boolean).join(" · ");
  const primaryActionLabel = selectedTickets.length > 0
    ? `Continue • ${formatINR(totalPrice)}`
    : tickets.length > 0
      ? isFreeEntry
        ? "Get On The List"
        : "Get Tickets"
      : "Get Tickets";

  return (
    <div 
      className="relative min-h-screen overflow-x-hidden bg-[#0A0A0A] text-white"
      style={{ "--event-accent": dominantColor }}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Layer 1: Base Black */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Layer 2: Primary centralized glow from dominant color */}
        <div
          className="absolute inset-0 opacity-100 mix-blend-screen"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, rgba(var(--event-accent), 0.9), transparent 85%)`,
          }}
        />

        {/* Layer 3: Secondary diffuse glow */}
        <div
          className="absolute inset-0 opacity-80 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(var(--event-accent), 0.5), transparent 85%)`,
          }}
        />

        {/* Layer 4: Grain/Noise */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px 256px" }} />

        {/* Layer 5: Black Vignette Gradients from all 4 sides (focusing light to center) */}
        <div className="absolute left-0 right-0 top-0 h-[15vh] bg-gradient-to-b from-black via-black/60 to-transparent" />
        <div className="absolute left-0 right-0 bottom-0 h-[40vh] bg-gradient-to-t from-black via-black/90 to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-[25vw] bg-gradient-to-r from-black via-black/80 to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-[25vw] bg-gradient-to-l from-black via-black/80 to-transparent" />
        <AmbientDots dominantColor={dominantColor} />
      </div>

      <div className="relative z-10 px-3 pb-20 pt-5 sm:px-6 sm:pb-24 sm:pt-7 lg:px-8 lg:pb-40 lg:pt-8">
        <div className="mx-auto max-w-[1160px]">
          <div>
            <div aria-hidden="true" className="h-[40px] sm:h-[48px]" />

            <div className="sticky top-5 z-30 mt-2">
              <GlassCard
                className="rounded-[24px] p-4 sm:px-5 sm:py-4"
                glowColor={dominantColor}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <SectionLabel>Get on the list</SectionLabel>
                    <div className="mt-2 text-[clamp(1.15rem,2vw,1.45rem)] font-semibold leading-tight text-white">
                      {tickets.length > 0
                        ? isFreeEntry
                          ? "Free RSVP is open now."
                          : startsFree
                            ? "Entry starts free."
                            : `Tickets start at ${formatINR(startingPrice)}.`
                        : "Ticket drop coming soon."}
                    </div>
                    <div className="mt-2 truncate text-[14px] text-white/48">
                      {stickySupportLabel}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setCrowdModalOpen(true)}
                      className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 shadow-[0_0_12px_rgba(255,255,255,0.06)] transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_16px_rgba(255,255,255,0.12)]"
                    >
                      View Guestlist
                    </button>
                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      className="rounded-full px-5 sm:px-6 py-3 sm:py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_16px_rgba(255,255,255,0.15)] transition-all hover:scale-[1.02] hover:brightness-110"
                      style={{
                        background: `linear-gradient(135deg, rgba(${dominantColor}, 0.98) 0%, rgba(${dominantColor}, 0.74) 100%)`,
                        boxShadow: `0 16px 46px rgba(${dominantColor}, 0.34), inset 0 1px 0 rgba(255,255,255,0.24), 0 0 20px rgba(${dominantColor}, 0.4)`,
                      }}
                    >
                      {primaryActionLabel}
                    </button>
                  </div>
                </div>
              </GlassCard>
            </div>

            <div className="mt-2 grid items-start gap-2.5 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex flex-col gap-2.5 sm:gap-3 order-2 lg:order-1">
              <GlassCard
                className="p-5 sm:p-6 lg:p-7"
                glowColor={dominantColor}
              >
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.26em] text-white/60">
                    <Sparkles className="h-3 w-3" />
                    {event?.category || "Announcement"}
                  </div>

                  <h1 className="mt-4 max-w-4xl font-heading text-[clamp(1.75rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-tight text-white">
                    {displayTitle}
                  </h1>

                  {tagline ? (
                    <p className="mt-4 max-w-[58ch] text-[15px] leading-7 text-white/65 sm:text-[16px]">
                      {tagline}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <Link href={hostUrl} className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 transition hover:border-white/20 hover:bg-white/[0.1]">
                      <div className="h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-white/10">
                        {hostAvatar ? (
                          <Image
                            src={hostAvatar}
                            alt={hostName}
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/70">
                            {hostName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-white/82">
                          {hostName}
                        </div>
                      </div>
                    </Link>

                    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-white/82">
                          {timeShort ? `${dateShort} · ${timeShort}` : dateShort}
                        </div>
                      </div>
                    </div>

                    {hostInstagram ? (
                      <a
                        href={hostInstagram.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/55 transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        {hostInstagram.label}
                      </a>
                    ) : null}
                  </div>

                  {crowdPeople.length > 0 && (
                    <div className={`mt-6 flex flex-col gap-3.5 rounded-[22px] border border-white/10 bg-black/30 p-4 backdrop-blur-md`}>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-white">
                            {goingLabel || "The line is forming"}
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                            Verified interest on THE C1RCLE
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {crowdPeople.map((person) => (
                          <MiniAvatar key={person.id || person.name} person={person} />
                        ))}
                      </div>

                      {interestedData?.count > 0 ? (
                        <div
                          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white"
                          style={{
                            background: `rgba(${dominantColor}, 0.22)`,
                            borderColor: `rgba(${dominantColor}, 0.28)`,
                          }}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Trending
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* Left Column content continues without extra wrapper */}
                <GlassCard className="p-5 sm:p-6" glowColor={dominantColor}>
                  <SectionLabel>About the event</SectionLabel>

                  <div className={`mt-4 space-y-3 ${!isDescriptionExpanded ? "line-clamp-4" : ""}`}>
                    {(descriptionParagraphs.length ? descriptionParagraphs : [aboutText || "Details coming soon."]).map((paragraph) => (
                      <p key={paragraph} className="text-[14px] leading-7 text-white/66">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {event?.artists?.length > 0 && isDescriptionExpanded && (
                    <div className="mt-6 border-t border-white/10 pt-5">
                      <SectionLabel>Lineup</SectionLabel>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {event.artists.map((artist, idx) => (
                          <span key={idx} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-white/80">
                            {artist.name || artist}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {descriptionParagraphs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
                    >
                      {isDescriptionExpanded ? (
                        <>Show Less <ChevronUp className="h-3.5 w-3.5" /></>
                      ) : (
                        <>View More <ChevronDown className="h-3.5 w-3.5" /></>
                      )}
                    </button>
                  )}

                  <div
                    className="mt-5 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3"
                    style={{ boxShadow: `0 0 28px rgba(${dominantColor}, 0.08)` }}
                  >
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
                      {noteLabel}
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-white/62">
                      {noteValue}
                    </div>
                  </div>
                </GlassCard>

                {crowdPeople.length > 0 && (
                  <GlassCard className="p-5 sm:p-6" glowColor={dominantColor}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <SectionLabel className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          Guestlist
                        </SectionLabel>
                        <div className="mt-3 text-[24px] font-black tracking-[-0.04em] text-white">
                          Who&apos;s Going
                        </div>
                        <div className="mt-2 text-[13px] text-white/48">
                          {goingLabel || "Community arrivals show up here first."}
                        </div>
                      </div>

                      <a
                        href={appUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
                      >
                        View All
                      </a>
                    </div>

                    <div className="mt-5 rounded-[22px] border border-white/[0.08] bg-black/20 p-5">
                      <div className="flex flex-wrap gap-3">
                        {crowdPeople.map((person) => (
                          <MiniAvatar key={person.id || person.name} person={person} size="lg" />
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                )}

                <EventCountdown event={event} dominantColor={dominantColor} />

                <section id="event-location">
                  <GlassCard className="overflow-hidden" glowColor={dominantColor}>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
                      <div>
                        <SectionLabel>Location</SectionLabel>
                        <div className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white">
                          {venueLabel}
                        </div>
                        {addressLabel ? (
                          <div className="mt-2 flex items-center gap-2 text-[13px] text-white/50">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {addressLabel}
                          </div>
                        ) : null}
                      </div>

                      <a
                        href={mapHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/65 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white"
                      >
                        Open Maps
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <div className="relative h-[320px] w-full">
                      <iframe
                        title={`${event?.title || "Event"} location`}
                        src={mapEmbed}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="absolute inset-0 h-full w-full grayscale contrast-125 brightness-[0.74]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                  </GlassCard>
                </section>

              </div>

              <aside className="relative flex flex-col gap-2.5 sm:gap-3 order-1 lg:order-2">
                {/* Ambient glow specifically behind the poster element */}
                <div 
                  className="pointer-events-none absolute -inset-20 z-[-1] opacity-60 blur-[80px] transition-opacity duration-700"
                  style={{ background: `radial-gradient(circle, rgba(var(--event-accent), 0.5) 0%, transparent 60%)` }}
                />
                <GlassCard
                  className="p-3 sm:p-4"
                  glowColor={dominantColor}
                >
                  <div className="relative aspect-[0.78] overflow-hidden rounded-[24px] border border-white/10">
                    <div className="absolute inset-0" style={{ background: posterGradient }} />
                    {eventImage ? (
                      <Image
                        src={eventImage}
                        alt={event?.title || ""}
                        fill
                        priority
                        unoptimized
                        className="object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,10,0.06),rgba(8,8,10,0.38)_48%,rgba(8,8,10,0.8)_100%)]" />
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/70 backdrop-blur-md">
                        {event?.category || "Event"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/70 backdrop-blur-md">
                        {dateShort}
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                        <div className="mt-1 text-[18px] font-black uppercase leading-[0.96] tracking-[-0.05em] text-white">
                          {displayTitle}
                        </div>
                        <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/46">
                          {organizerLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard glowColor={dominantColor}>
                  <div className="border-b border-white/[0.08] px-5 py-5">
                    <SectionLabel>Tickets</SectionLabel>
                    <div className="mt-3 text-[28px] font-black uppercase tracking-[-0.04em] text-white">
                      {entryLabel}
                    </div>
                    <div className="mt-2 max-w-[28ch] text-[13px] leading-6 text-white/48">
                      {ticketLeadCopy}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 px-5 py-5">
                    {tickets.length === 0 ? (
                      <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-[13px] leading-6 text-white/50">
                        Door list drops soon.
                      </div>
                    ) : null}

                    {tickets.map((ticket) => {
                      const availability = getAvailability(ticket);
                      const badge = getTierBadge(ticket, startingPrice);
                      const quantity = Number(quantities[ticket.id] || 0);
                      const limit = getTierLimit(ticket, totalFreeSelected, quantity);
                      const isSelected = quantity > 0;

                      return (
                        <div
                          key={ticket.id}
                          className={`relative overflow-hidden rounded-[20px] border px-5 py-5 transition-all duration-300 ${
                            isSelected
                              ? "border-white/20 bg-white/[0.08] shadow-lg"
                              : "border-white/[0.06] bg-black/40 hover:bg-black/60"
                          } ${availability.isSoldOut ? "opacity-60 grayscale" : ""}`}
                          style={
                            isSelected
                              ? {
                                  borderColor: `rgba(${dominantColor}, 0.3)`,
                                  boxShadow: `0 12px 36px rgba(${dominantColor}, 0.12)`,
                                }
                              : undefined
                          }
                        >
                          {/* Top Section */}
                          <div className="flex items-start justify-between gap-3 relative z-10">
                            <div>
                              {badge ? (
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] ${badge.classes}`}>
                                  {badge.label}
                                </span>
                              ) : null}
                              <div className={`${badge ? "mt-2" : ""} text-[16px] font-bold tracking-wide text-white`}>
                                {ticket.name || "Entry Tier"}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                                <div className={`h-1.5 w-1.5 rounded-full ${availability.isSoldOut ? "bg-red-500/50" : availability.fill > 0.8 ? "bg-amber-500/80" : "bg-emerald-500/80"}`} />
                                {availability.label}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[20px] font-black tracking-[-0.04em] text-white">
                                {Number(ticket.price || 0) === 0 ? "Free" : formatINR(ticket.price)}
                              </div>
                              <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
                                {Number(ticket.price || 0) === 0 ? (quantity >= 1 || (totalFreeSelected >= 1 && quantity === 0) ? "Limit Reached" : "Limit 1") : limit > 0 ? `Limit ${limit}` : "Closed"}
                              </div>
                            </div>
                          </div>

                          {/* Bottom Section */}
                          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 relative z-10">
                            <div className="text-[11px] font-semibold text-white/40">
                              {isSelected ? "Selected" : "Select Quantity"}
                            </div>
                            
                            {availability.isSoldOut ? (
                              <button
                                type="button"
                                onClick={() => handleNotifyMe(ticket)}
                                disabled={waitlistState[ticket.id] === "loading" || waitlistState[ticket.id] === "joined"}
                                className="rounded-xl border border-white/8 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/50 transition hover:border-white/15 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {waitlistState[ticket.id] === "joined"
                                  ? "You're on the list"
                                  : waitlistState[ticket.id] === "loading"
                                    ? "..."
                                    : "Notify Me"}
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-1 py-1 backdrop-blur-md">
                                <button
                                  type="button"
                                  onClick={() => setQuantity(ticket, quantity - 1)}
                                  disabled={quantity <= 0}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-4 text-center text-[14px] font-bold text-white">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setQuantity(ticket, quantity + 1)}
                                  disabled={quantity >= limit}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Ambient fill for progress - absolutely positioned at bottom so it doesn't interrupt flow */}
                          <div
                            className="absolute bottom-0 left-0 h-1 bg-white/10 transition-all duration-500"
                            style={{ 
                              width: `${Math.max(2, availability.fill * 100)}%`, 
                              background: isSelected ? `rgba(${dominantColor}, 0.8)` : undefined 
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-white/[0.08] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
                          Cart
                        </div>
                        <div className="mt-0.5 text-[13px] font-semibold text-white/70">
                          {selectedTickets.length > 0
                            ? `${totalSelected} selected`
                            : tickets.length > 0
                              ? "Pick your tickets"
                              : "Join the waitlist"}
                        </div>
                      </div>
                      <div className="text-[17px] font-black text-white">
                        {selectedTickets.length > 0 ? formatINR(totalPrice) : tickets.length > 0 ? (isFreeEntry ? "Free" : formatINR(startingPrice)) : "--"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      className="mt-3.5 inline-flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:scale-[1.01] hover:brightness-110"
                      style={{
                        background: `linear-gradient(135deg, rgba(${dominantColor}, 0.9) 0%, rgba(${dominantColor}, 0.65) 100%)`,
                        boxShadow: `0 14px 44px rgba(${dominantColor}, 0.25), inset 0 1px 0 rgba(255,255,255,0.18)`,
                      }}
                    >
                      <Ticket className="h-4 w-4" />
                      {selectedTickets.length > 0 ? "Continue To Checkout" : primaryActionLabel}
                    </button>
                  </div>
                </GlassCard>

                <GlassCard
                  className="p-5"
                  glowColor={dominantColor}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15">
                      <img src="/logo-circle.jpg" alt="The C1rcle" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/36">
                        App Access
                      </div>
                      <div className="mt-1 text-[14px] font-semibold text-white">
                        Download the app
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start justify-between gap-4">
                    <div className="max-w-[13rem]">
                      <div className="text-[18px] font-semibold leading-tight text-white">
                        Move faster at the door.
                      </div>
                      <div className="mt-2 text-[13px] leading-6 text-white/52">
                        Ticket vault, direct transfers, cleaner checkout.
                      </div>
                    </div>

                    <div className="rounded-[16px] bg-white p-2.5 shadow-xl">
                      <QRCodeSVG value={appUrl} size={96} bgColor="#ffffff" fgColor="#000000" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-4 text-center text-[10px] text-white/46">
                    <div className="flex flex-col items-center gap-1.5">
                      <Ticket className="h-3.5 w-3.5 text-white/72" />
                      Instant access
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <Share2 className="h-3.5 w-3.5 text-white/72" />
                      Transfers
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-white/72" />
                      Curated entry
                    </div>
                  </div>
                </GlassCard>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {crowdModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-12">
          <button
            type="button"
            aria-label="Close going list"
            onClick={() => setCrowdModalOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          <div
            className="relative z-10 w-full max-w-[920px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0c0c10]/95 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.48)] backdrop-blur-3xl sm:p-7 max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: `0 0 100px rgba(${dominantColor}, 0.1)` }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionLabel>Going</SectionLabel>
                  <div className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-white sm:text-[34px]">
                    Guest list
                  </div>
                  {interestedData?.count > 0 ? (
                    <div className="mt-2 text-[13px] text-white/50">
                      {interestedData.count.toLocaleString("en-IN")} people going
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setCrowdModalOpen(false)}
                  className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 flex max-h-[68vh] flex-wrap gap-3 overflow-y-auto pr-1">
                {crowdPeople.map((person) => (
                  <div
                    key={`crowd-modal-${person.id || person.name}`}
                    className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/15 shadow-lg sm:h-24 sm:w-24"
                  >
                    <MiniAvatar person={person} size="xl" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
