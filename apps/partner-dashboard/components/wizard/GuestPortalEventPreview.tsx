"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

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

type PreviewTicket = {
    id?: string;
    name?: string;
    label?: string;
    description?: string;
    price?: number | string;
    amount?: number | string;
    quantity?: number | string;
    remaining?: number | string;
    available?: boolean;
};

type PreviewEvent = {
    id?: string;
    title?: string;
    name?: string;
    summary?: string;
    description?: string;
    category?: string;
    genre?: string;
    genres?: string[];
    dressCode?: string;
    ageLimit?: string | number;
    ageRestriction?: string | number;
    startDate?: string;
    startTime?: string;
    endTime?: string;
    venueName?: string;
    venue?: string;
    location?: string;
    address?: string;
    city?: string;
    image?: string;
    poster?: string;
    coverImage?: string;
    tickets?: PreviewTicket[];
};

type PreviewHost = {
    handle?: string;
    name?: string;
    city?: string;
    bio?: string;
};

const dominantColorCache: Record<string, string> = {};

function rgbToHsl(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100] as const;
}

function hslToRgb(h: number, s: number, l: number) {
    h /= 360;
    s /= 100;
    l /= 100;
    if (s === 0) {
        const value = Math.round(l * 255);
        return [value, value, value] as const;
    }
    const hue2rgb = (p: number, q: number, t: number) => {
        let next = t;
        if (next < 0) next += 1;
        if (next > 1) next -= 1;
        if (next < 1 / 6) return p + (q - p) * 6 * next;
        if (next < 1 / 2) return q;
        if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        Math.round(hue2rgb(p, q, h) * 255),
        Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ] as const;
}

function clampColor(r: number, g: number, b: number) {
    let [h, s, l] = rgbToHsl(r, g, b);
    s = Math.min(s, 70);
    l = Math.min(l, 55);
    const [cr, cg, cb] = hslToRgb(h, s, l);
    return `${cr}, ${cg}, ${cb}`;
}

function useDominantColor(imageUrl?: string | null) {
    const [color, setColor] = useState<string | null>(() => (imageUrl ? dominantColorCache[imageUrl] || null : null));

    useEffect(() => {
        if (!imageUrl) {
            setColor(null);
            return;
        }

        if (dominantColorCache[imageUrl]) {
            setColor(dominantColorCache[imageUrl]);
            return;
        }

        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = 40;
                canvas.height = 40;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, 40, 40);
                const data = ctx.getImageData(0, 0, 40, 40).data;

                let rTotal = 0;
                let gTotal = 0;
                let bTotal = 0;
                let count = 0;

                for (let i = 0; i < data.length; i += 16) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
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

                if (!count) return;

                const result = clampColor(
                    Math.round(rTotal / count),
                    Math.round(gTotal / count),
                    Math.round(bTotal / count),
                );
                dominantColorCache[imageUrl] = result;
                setColor(result);
            } catch {
                setColor(null);
            }
        };
        img.onerror = () => setColor(null);
    }, [imageUrl]);

    return color;
}

function buildDate(startDate?: string, startTime?: string) {
    if (!startDate) return null;
    const value = startTime ? `${startDate}T${startTime}` : startDate;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateChip(date: Date | null) {
    if (!date) return "Date TBA";
    try {
        const day = date.toLocaleDateString("en-US", { weekday: "short" });
        const month = date.toLocaleDateString("en-US", { month: "short" });
        const value = date.toLocaleDateString("en-US", { day: "numeric" });
        return `${day}, ${month} ${value}`;
    } catch {
        return "Date TBA";
    }
}

function formatTimeChip(date: Date | null, startTime?: string, endTime?: string) {
    if (startTime && endTime) return `${startTime} - ${endTime}`;
    if (startTime) return startTime;
    if (!date) return "";
    try {
        return new Intl.DateTimeFormat("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    } catch {
        return "";
    }
}

function formatINR(amount: number) {
    return `₹${amount.toLocaleString("en-IN")}`;
}

function GlassCard({
    children,
    accent,
    className = "",
}: {
    children: ReactNode;
    accent: string;
    className?: string;
}) {
    return (
        <div
            className={`relative overflow-hidden rounded-[22px] border bg-[rgba(18,11,8,0.72)] backdrop-blur-xl ${className}`}
            style={{
                borderColor: `rgba(${accent}, 0.2)`,
                boxShadow: `0 18px 52px rgba(0,0,0,0.42), inset 0 0 32px rgba(${accent}, 0.08)`,
            }}
        >
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${accent}, 0.65), transparent)` }}
            />
            <div className="relative z-10">{children}</div>
        </div>
    );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
    return <div className="text-[9px] font-black uppercase tracking-[0.26em] text-white/35">{children}</div>;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LIVE_WINDOW_MS = 6 * HOUR;

function getCountdownState(targetDate: Date | null) {
    if (!targetDate) return { status: "hidden", diff: 0 };
    const diff = targetDate.getTime() - Date.now();
    if (diff > 0) return { status: "upcoming", diff };
    if (Math.abs(diff) <= LIVE_WINDOW_MS) return { status: "live", diff };
    return { status: "ended", diff };
}

function toCountdownParts(diff: number) {
    const remaining = Math.max(diff, 0);
    return {
        days: Math.floor(remaining / DAY),
        hours: Math.floor((remaining % DAY) / HOUR),
        minutes: Math.floor((remaining % HOUR) / MINUTE),
        seconds: Math.floor((remaining % MINUTE) / SECOND),
    };
}

function EventCountdown({
    eventDate,
    accent,
    event,
}: {
    eventDate: Date | null;
    accent: string;
    event: PreviewEvent;
}) {
    const [state, setState] = useState(() => getCountdownState(eventDate));

    useEffect(() => {
        setState(getCountdownState(eventDate));
        if (!eventDate) return undefined;
        const interval = window.setInterval(() => {
            setState(getCountdownState(eventDate));
        }, SECOND);
        return () => window.clearInterval(interval);
    }, [eventDate]);

    if (!eventDate || state.status === "hidden") return null;

    const parts = toCountdownParts(state.diff);
    const countdownValue = `${String(parts.days).padStart(2, "0")}:${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}:${String(parts.seconds).padStart(2, "0")}`;

    return (
        <GlassCard accent={accent} className="px-4 py-4 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/42">
                        {state.status === "upcoming" ? "Party starts in" : state.status === "live" ? "Party is live" : "Party closed"}
                    </div>
                    <div
                        className="mt-1 font-black leading-none tracking-[-0.08em] text-white"
                        style={{
                            fontSize: "clamp(1.55rem, 4vw, 2.5rem)",
                            textShadow: `0 0 22px rgba(${accent}, 0.16), 0 0 42px rgba(${accent}, 0.08)`,
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

function getAvailability(ticket: PreviewTicket) {
    const quantity = Number(ticket.quantity || 0);
    const remaining = ticket.remaining != null ? Number(ticket.remaining) : quantity;
    if (remaining <= 0 && quantity > 0) return "Sold Out";
    if (remaining > 0 && remaining <= 10) return `${remaining} Left`;
    return "Available";
}

function AmbientDots({ accent }: { accent: string }) {
    return (
        <>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {AMBIENT_DOTS.map((dot, index) => (
                    <span
                        key={index}
                        className="event-preview-dot absolute rounded-full"
                        style={{
                            left: dot.left,
                            bottom: "-6%",
                            width: `${dot.size}px`,
                            height: `${dot.size}px`,
                            animationDuration: `${dot.duration}s`,
                            animationDelay: `${dot.delay}s`,
                            ["--dot-drift" as string]: `${dot.drift}px`,
                            background: index % 3 === 0 ? "rgba(255,255,255,0.82)" : `rgba(${accent}, ${index % 2 === 0 ? 0.88 : 0.62})`,
                            boxShadow: index % 3 === 0
                                ? "0 0 18px rgba(255,255,255,0.32)"
                                : `0 0 20px rgba(${accent}, 0.34)`,
                        }}
                    />
                ))}
            </div>
            <style jsx>{`
                .event-preview-dot {
                    animation-name: event-preview-float;
                    animation-timing-function: ease-in-out;
                    animation-iteration-count: infinite;
                    opacity: 0;
                    will-change: transform, opacity;
                }

                @keyframes event-preview-float {
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

export function GuestPortalEventPreview({
    event,
    host,
    className = "",
    onBack,
    backLabel = "Back to Wizard",
}: {
    event: PreviewEvent;
    host?: PreviewHost;
    className?: string;
    onBack?: () => void;
    backLabel?: string;
}) {
    const title = String(event.title || event.name || "Untitled Event").trim().toUpperCase();
    const poster = event.poster || event.image || event.coverImage || null;
    const extractedAccent = useDominantColor(poster);
    const accent = extractedAccent || "255, 255, 255";
    const eventDate = useMemo(() => buildDate(event.startDate, event.startTime), [event.startDate, event.startTime]);
    const dateChip = formatDateChip(eventDate);
    const timeChip = formatTimeChip(eventDate, event.startTime, event.endTime);
    const venue = event.venueName || event.venue || event.location || "Venue";
    const hostName = host?.name || "Host";
    const organizerLabel = hostName && hostName !== venue ? hostName : venue;
    const about = (event.summary || event.description || "Details coming soon.").trim();
    const dressCode = String(event.dressCode || "Smart Casual").replace(/_/g, " ");
    const category = String(event.category || "Music").toUpperCase();
    const tickets = (event.tickets || []).filter((ticket) => ticket && (ticket.price != null || ticket.amount != null));
    const allFree = tickets.length > 0 && tickets.every((ticket) => Number(ticket.price || ticket.amount || 0) === 0);
    const minPrice = tickets.length > 0 ? Math.min(...tickets.map((ticket) => Number(ticket.price || ticket.amount || 0))) : 0;
    const entryLabel = tickets.length === 0 ? "TICKETS SOON" : allFree ? "FREE RSVP" : minPrice === 0 ? "FROM FREE" : formatINR(minPrice);

    return (
        <div
            className={`relative min-h-screen overflow-hidden bg-[#0A0A0A] text-white ${className}`}
            style={{ "--event-accent": accent } as CSSProperties}
        >
            {onBack ? (
                <button
                    type="button"
                    onClick={onBack}
                    className="fixed left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/72 backdrop-blur-xl transition hover:border-white/20 hover:bg-black/60 hover:text-white"
                >
                    <span aria-hidden="true" className="text-sm leading-none">←</span>
                    <span>{backLabel}</span>
                </button>
            ) : null}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="absolute inset-0 bg-black" />
                {extractedAccent ? (
                    <>
                        <div
                            className="absolute inset-0 opacity-100 mix-blend-screen"
                            style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(var(--event-accent), 0.9), transparent 85%)" }}
                        />
                        <div
                            className="absolute inset-0 opacity-80 mix-blend-screen"
                            style={{ background: "radial-gradient(circle at 50% 50%, rgba(var(--event-accent), 0.5), transparent 85%)" }}
                        />
                    </>
                ) : poster ? (
                    <>
                        <img
                            src={poster}
                            alt=""
                            aria-hidden="true"
                            className="absolute left-1/2 top-[4%] h-[88vh] w-[88vw] -translate-x-1/2 object-cover opacity-40 mix-blend-screen blur-[110px] saturate-150"
                        />
                        <img
                            src={poster}
                            alt=""
                            aria-hidden="true"
                            className="absolute left-1/2 top-[20%] h-[62vh] w-[62vw] -translate-x-1/2 object-cover opacity-22 mix-blend-screen blur-[140px] saturate-125"
                        />
                    </>
                ) : null}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px 256px" }} />
                <div className="absolute left-0 right-0 top-0 h-[15vh] bg-gradient-to-b from-black via-black/60 to-transparent" />
                <div className="absolute left-0 right-0 bottom-0 h-[40vh] bg-gradient-to-t from-black via-black/90 to-transparent" />
                <div className="absolute bottom-0 left-0 top-0 w-[25vw] bg-gradient-to-r from-black via-black/80 to-transparent" />
                <div className="absolute bottom-0 right-0 top-0 w-[25vw] bg-gradient-to-l from-black via-black/80 to-transparent" />
                <AmbientDots accent={accent} />
            </div>

            <div className="relative z-10 mx-auto max-w-[1160px] px-3 pb-14 pt-5 sm:px-5">
                <div className="mx-auto flex max-w-[980px] items-center justify-between rounded-full border border-white/10 bg-[#140d0b]/82 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <div className="flex items-center gap-5">
                        <div className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full border border-white/12 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <img src="/logo-circle.jpg" alt="THE C1RCLE" className="h-full w-full object-cover scale-[1.02]" />
                        </div>
                        <div className="text-[18px] font-black tracking-tight text-white">THE C1RCLE</div>
                    </div>
                    <div className="hidden items-center gap-2 md:flex">
                        {["Explore", "Hosts", "Tickets", "App"].map((item) => (
                            <span key={item} className="rounded-full bg-white/[0.04] px-3.5 py-2 text-[8px] font-black uppercase tracking-[0.28em] text-white/36">
                                {item}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="rounded-full bg-white/[0.045] px-5 py-2.5 text-[8px] font-black uppercase tracking-[0.34em] text-white/62">
                            Profile
                        </span>
                        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/[0.05] text-[15px] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                            {(host?.name || "H")[0]}
                        </span>
                    </div>
                </div>

                <div className="mx-auto mt-3 max-w-[980px]">
                    <GlassCard accent={accent} className="px-5 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <SectionEyebrow>Get on the list</SectionEyebrow>
                                <div className="mt-2 text-[1.45rem] font-semibold leading-tight text-white">
                                    {tickets.length === 0 ? "Ticket drop coming soon." : allFree ? "Free RSVP is open now." : minPrice === 0 ? "Entry starts free." : `Tickets start at ${formatINR(minPrice)}.`}
                                </div>
                                <div className="mt-2 text-[13px] text-white/42">{venue} · {timeChip || dateChip}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/65">View Guestlist</button>
                                <button
                                    className="rounded-full px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white"
                                    style={{
                                        background: `linear-gradient(135deg, rgba(${accent}, 0.98), rgba(${accent}, 0.72))`,
                                        boxShadow: `0 14px 38px rgba(${accent}, 0.28)`,
                                    }}
                                >
                                    Preview
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                </div>

                <div className="mx-auto mt-3 grid max-w-[980px] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex min-w-0 flex-col gap-3">
                        <GlassCard accent={accent} className="p-5 sm:p-6">
                            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-white/55">
                                {category}
                            </div>

                            <h1 className="mt-4 text-[clamp(2rem,5vw,3.4rem)] font-black uppercase leading-[0.9] tracking-tight text-white">
                                {title}
                            </h1>

                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[11px] font-black text-white">
                                        {(venue || "V")[0]}
                                    </div>
                                    <div className="text-[13px] font-semibold text-white/82">{organizerLabel}</div>
                                </div>
                                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[11px] font-black text-white">◷</div>
                                    <div className="text-[13px] font-semibold text-white/82">{dateChip}{timeChip ? ` · ${timeChip}` : ""}</div>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard accent={accent} className="p-5 sm:p-6">
                            <SectionEyebrow>About the event</SectionEyebrow>
                            <p className="mt-4 text-[14px] leading-7 text-white/62">{about}</p>

                            <div className="mt-5 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3">
                                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Dress code</div>
                                <div className="mt-2 text-[13px] leading-6 text-white/65">{dressCode}</div>
                            </div>
                        </GlassCard>

                        <EventCountdown eventDate={eventDate} accent={accent} event={event} />

                        <GlassCard accent={accent} className="overflow-hidden">
                            <div className="flex items-center justify-between gap-3 px-5 py-5">
                                <div>
                                    <SectionEyebrow>Location</SectionEyebrow>
                                    <div className="mt-3 text-[24px] font-black uppercase tracking-tight text-white">{venue}</div>
                                    <div className="mt-2 text-[13px] text-white/48">{event.address || venue}</div>
                                </div>
                                <button className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                                    Open Maps
                                </button>
                            </div>
                            <div className="h-[250px] w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                        </GlassCard>
                    </div>

                    <aside className="relative flex min-w-0 flex-col gap-3">
                        <div
                            className="pointer-events-none absolute -inset-16 z-[-1] opacity-60 blur-[80px]"
                            style={{ background: "radial-gradient(circle, rgba(var(--event-accent), 0.5) 0%, transparent 60%)" }}
                        />
                        <GlassCard accent={accent} className="p-3">
                            <div className="relative aspect-[0.78] overflow-hidden rounded-[22px] border border-white/10 bg-black/30">
                                {poster ? <img src={poster} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : null}
                                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(10,10,10,0.06), rgba(10,10,10,0.36) 48%, rgba(10,10,10,0.86) 100%)` }} />
                                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/70">{category}</span>
                                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/70">{dateChip}</span>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <div className="rounded-[18px] border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                                        <div className="text-[18px] font-black uppercase leading-[0.96] tracking-tight text-white">{title}</div>
                                        <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/46">{organizerLabel}</div>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard accent={accent}>
                            <div className="border-b border-white/[0.08] px-5 py-5">
                                <SectionEyebrow>Tickets</SectionEyebrow>
                                <div className="mt-3 text-[28px] font-black uppercase tracking-tight text-white">{entryLabel}</div>
                                <div className="mt-2 text-[13px] leading-6 text-white/48">Reserve your spot.</div>
                            </div>

                            <div className="flex flex-col gap-3 px-5 py-5">
                                {tickets.length === 0 ? (
                                    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-[13px] text-white/50">Door list drops soon.</div>
                                ) : null}

                                {tickets.map((ticket, index) => {
                                    const price = Number(ticket.price || ticket.amount || 0);
                                    return (
                                        <div key={ticket.id || `ticket-${index}`} className="rounded-[18px] border border-white/[0.06] bg-black/35 px-4 py-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-white/55 inline-flex">
                                                        {ticket.name?.toLowerCase().includes("ladies") ? "Ladies" : "Tier"}
                                                    </div>
                                                    <div className="mt-2 text-[16px] font-bold text-white">{ticket.name || ticket.label || `Entry Tier ${index + 1}`}</div>
                                                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">{getAvailability(ticket)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[20px] font-black text-white">{price === 0 ? "Free" : formatINR(price)}</div>
                                                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/28">
                                                        {price === 0 ? "Limit 1" : `Limit ${Math.min(Number(ticket.quantity || 10) || 10, 10)}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
                                                <div className="text-[11px] font-semibold text-white/40">Select Quantity</div>
                                                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-1 py-1">
                                                    <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white">−</button>
                                                    <span className="w-4 text-center text-[14px] font-bold text-white">0</span>
                                                    <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="border-t border-white/[0.08] px-5 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Cart</div>
                                        <div className="mt-0.5 text-[13px] font-semibold text-white/70">Pick your tickets</div>
                                    </div>
                                    <div className="text-[18px] font-black text-white">{allFree ? "Free" : tickets.length ? formatINR(minPrice) : "--"}</div>
                                </div>
                                <button
                                    className="mt-3.5 inline-flex w-full items-center justify-center rounded-full py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white"
                                    style={{
                                        background: `linear-gradient(135deg, rgba(${accent}, 0.92), rgba(${accent}, 0.66))`,
                                        boxShadow: `0 14px 40px rgba(${accent}, 0.24)`,
                                    }}
                                >
                                    Preview
                                </button>
                            </div>
                        </GlassCard>

                        <GlassCard accent={accent} className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15">
                                    <img src="/logo-circle.jpg" alt="THE C1RCLE" className="h-full w-full object-cover" />
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/36">App Access</div>
                                    <div className="mt-1 text-[14px] font-semibold text-white">Download the app</div>
                                </div>
                            </div>

                            <div className="mt-5 flex items-start justify-between gap-4">
                                <div className="max-w-[13rem]">
                                    <div className="text-[18px] font-semibold leading-tight text-white">Move faster at the door.</div>
                                    <div className="mt-2 text-[13px] leading-6 text-white/52">Ticket vault, direct transfers, cleaner checkout.</div>
                                </div>
                                <div className="rounded-[16px] bg-white p-2.5 shadow-xl">
                                    <div className="flex h-24 w-24 items-center justify-center text-[9px] font-black uppercase tracking-[0.18em] text-black">
                                        App QR
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-4 text-center text-[10px] text-white/46">
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-white/72">◉</span>
                                    Instant access
                                </div>
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-white/72">↗</span>
                                    Transfers
                                </div>
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-white/72">✦</span>
                                    Curated entry
                                </div>
                            </div>
                        </GlassCard>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export function GuestPortalEventPreviewFrame({
    event,
    host,
    width = 300,
    height = 380,
}: {
    event: PreviewEvent;
    host?: PreviewHost;
    width?: number;
    height?: number;
}) {
    const baseWidth = 980;
    const baseHeight = 920;
    const scale = Math.min(width / baseWidth, height / baseHeight);

    return (
        <div className="overflow-hidden rounded-[32px] shadow-2xl transition-transform hover:scale-[1.02]" style={{ width, height }}>
            <div
                style={{
                    width: baseWidth,
                    height: baseHeight,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                }}
            >
                <GuestPortalEventPreview event={event} host={host} />
            </div>
        </div>
    );
}

export function GuestPortalPosterPreview({
    event,
    host,
    width = 300,
    height = 380,
}: {
    event: PreviewEvent;
    host?: PreviewHost;
    width?: number;
    height?: number;
}) {
    const title = String(event.title || event.name || "Untitled Event").trim().toUpperCase();
    const poster = event.poster || event.image || event.coverImage || null;
    const accent = useDominantColor(poster) || "255, 255, 255";
    const eventDate = useMemo(() => buildDate(event.startDate, event.startTime), [event.startDate, event.startTime]);
    const venue = event.venueName || event.venue || event.location || "Venue";
    const organizerLabel = host?.name || event.hostName || event.host || venue;
    const category = String(event.category || "Music").toUpperCase();

    return (
        <div
            className="relative overflow-hidden rounded-[32px] shadow-2xl transition-transform hover:scale-[1.02]"
            style={{ width, height }}
        >
            <div
                className="absolute inset-0 opacity-70 blur-3xl"
                style={{ background: `radial-gradient(circle at 50% 40%, rgba(${accent}, 0.42), transparent 65%)` }}
            />
            <div
                className="relative h-full w-full rounded-[32px] border bg-[#120b08] p-3"
                style={{
                    borderColor: `rgba(${accent}, 0.24)`,
                    boxShadow: `0 22px 60px rgba(0,0,0,0.48), inset 0 0 32px rgba(${accent}, 0.08)`,
                }}
            >
                <div className="relative h-full overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
                    {poster ? <img src={poster} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : null}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,10,0.08),rgba(8,8,10,0.24)_38%,rgba(8,8,10,0.88)_100%)]" />

                    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/70">
                            {category}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/70">
                            {formatDateChip(eventDate)}
                        </span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="rounded-[18px] border border-white/10 bg-black/40 p-4 backdrop-blur-md">
                            <div className="text-[18px] font-black uppercase leading-[0.96] tracking-tight text-white">
                                {title}
                            </div>
                            <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/46">
                                {organizerLabel}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
