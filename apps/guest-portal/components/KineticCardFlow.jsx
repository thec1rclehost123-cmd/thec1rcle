"use client";

import { useEffect, useRef, useCallback } from "react";
import { resolvePoster } from "@c1rcle/core/events";
import { formatEventDate } from "@c1rcle/core/time";
import { useRouter } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION — Cinematic Conveyor Belt
// ═══════════════════════════════════════════════════════════════════════════════
const N_VISIBLE = 15;
const N_BUFFER = 4;
const N_SLOTS = N_VISIBLE + N_BUFFER; // 19
const HALF = Math.floor(N_SLOTS / 2); // 9

const BASE_W = 400;              // card width at scale 1.0 (+25%)
const BASE_H = 600;              // card height at scale 1.0 (+25%)
const CONTAINER_H = 720;         // section height

const PX_PER_SEC = 30;           // cinematic velocity (spec: 25–40 px/s)
const OVERLAP_FRAC = 0.06;       // 6% overlap between adjacent cards (spec: 4–8%)

// Scale table: user-specified dramatic falloff
const SCALES = [1.0, 0.6, 0.5, 0.45, 0.40, 0.37, 0.33, 0.30, 0.27, 0.24];

/** Smooth linear interpolation between scale stops — zero stepping artifacts */
function scaleAt(dist) {
    const d = Math.abs(dist);
    const max = SCALES.length - 1;
    if (d >= max) return SCALES[max];
    const lo = Math.floor(d);
    const f = d - lo;
    return SCALES[lo] + (SCALES[lo + 1] - SCALES[lo]) * f;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function KineticCardFlow({ events = [] }) {
    const containerRef = useRef(null);
    const rafRef = useRef(null);
    const prevTRef = useRef(null);
    const offsetRef = useRef(0);
    const hoveredRef = useRef(-1);
    const router = useRouter();

    const evts = events?.length > 0 ? events : [];

    const slots = useRef(
        Array.from({ length: N_SLOTS }, (_, i) => ({
            i, evIdx: 0, el: null, pos: 0,
            scale: 1, w: BASE_W, x: -9999,
            hLift: 0, hScl: 1,
        }))
    );

    // ── Imperatively paint card contents ──────────────────────────────────────
    const paint = useCallback((slot) => {
        const el = slot.el;
        if (!el || !evts.length) return;
        const ev = evts[((slot.evIdx % evts.length) + evts.length) % evts.length];
        if (!ev) return;
        el.dataset.eventId = ev.id || "";
        el.dataset.slug = ev.slug || "";
        const img = el.querySelector("[data-poster]");
        const title = el.querySelector("[data-title]");
        const date = el.querySelector("[data-date]");
        const venue = el.querySelector("[data-venue]");
        const live = el.querySelector("[data-live]");
        if (img) { const s = resolvePoster(ev); if (img.src !== s) img.src = s; }
        if (title) title.textContent = ev.title || "Untitled";
        if (date) date.textContent = formatEventDate(ev.startDate || ev.date || Date.now());
        if (venue) venue.textContent = ev.venueName || ev.venue?.name || "TBA";
        if (live) live.style.display = ev.lifecycle === "live" ? "flex" : "none";
    }, [evts]);

    // ── Core animation tick — 60 fps GPU-accelerated ─────────────────────────
    const tick = useCallback((now) => {
        if (!evts.length || !containerRef.current) {
            rafRef.current = requestAnimationFrame(tick);
            return;
        }
        const dt = prevTRef.current ? Math.min(now - prevTRef.current, 50) : 16;
        prevTRef.current = now;

        const cw = containerRef.current.offsetWidth;
        const evLen = evts.length;

        // ── 1. Advance offset — constant linear velocity, never stops ────────
        offsetRef.current += (PX_PER_SEC / 1000 / BASE_W) * dt;

        const baseShift = Math.floor(offsetRef.current);
        const frac = offsetRef.current - baseShift;

        // ── 2. Assign continuous positions & resolve event indices ────────────
        for (let i = 0; i < N_SLOTS; i++) {
            const s = slots.current[i];
            let vp = ((i - baseShift) % N_SLOTS + N_SLOTS) % N_SLOTS;
            if (vp > HALF) vp -= N_SLOTS;
            s.pos = vp - frac;
            s.scale = scaleAt(s.pos);
            s.w = BASE_W * s.scale;

            let nev = ((i + baseShift) % evLen + evLen) % evLen;
            if (s.evIdx !== nev) { s.evIdx = nev; paint(s); }
        }

        // ── 3. Sort by position → compute edge-to-edge X layout ─────────────
        const sorted = [...slots.current].sort((a, b) => a.pos - b.pos);

        // Find center slot (closest to pos 0)
        let ci = 0, minD = Infinity;
        for (let i = 0; i < sorted.length; i++) {
            const d = Math.abs(sorted[i].pos);
            if (d < minD) { minD = d; ci = i; }
        }

        // Anchor center card — drift proportional to its fractional offset
        const cs = sorted[ci];
        cs.x = (cw - cs.w) / 2 + cs.pos * cs.w;

        // Chain leftward: right edge of card[i] overlaps left edge of card[i+1]
        for (let i = ci - 1; i >= 0; i--)
            sorted[i].x = sorted[i + 1].x - sorted[i].w * (1 - OVERLAP_FRAC);

        // Chain rightward: left edge of card[i] overlaps right edge of card[i-1]
        for (let i = ci + 1; i < sorted.length; i++)
            sorted[i].x = sorted[i - 1].x + sorted[i - 1].w - sorted[i].w * OVERLAP_FRAC;

        // ── 4. Apply transforms to DOM ───────────────────────────────────────
        const yBase = (CONTAINER_H - BASE_H) / 2;

        for (const s of slots.current) {
            if (!s.el) continue;
            const ad = Math.abs(s.pos);
            const isH = hoveredRef.current === s.i;
            const lerp = 0.08;

            // Smooth hover spring
            s.hLift += ((isH ? -12 : 0) - s.hLift) * lerp;
            s.hScl += ((isH ? 1.05 : 1) - s.hScl) * lerp;

            // Buffer fade
            let op = 1;
            if (ad > 6.5) op = Math.max(0, 7.5 - ad);

            const z = isH ? 200 : Math.round(100 - ad * 10);

            // Outer: position only (no layout reflow)
            s.el.style.transform = `translate3d(${s.x}px, ${yBase + s.hLift}px, 0)`;
            s.el.style.zIndex = String(z);
            s.el.style.opacity = String(op);
            s.el.style.pointerEvents = ad < 7.5 ? "auto" : "none";

            // Inner: scale from left-center so left edge stays anchored to layout
            const inner = s.el.querySelector(".card-inner");
            if (inner) {
                inner.style.transform = `scale(${s.scale * s.hScl})`;
                inner.style.boxShadow = isH
                    ? "0 25px 50px -10px rgba(255,75,31,0.3), 0 0 0 1px rgba(255,75,31,0.25)"
                    : `0 20px 40px -10px rgba(0,0,0,${0.3 + ad * 0.04})`;
                inner.style.borderColor = isH ? "rgba(255,75,31,0.4)" : "rgba(255,255,255,0.06)";
            }

            const dk = s.el.querySelector(".card-darken");
            if (dk) dk.style.opacity = String(isH ? 0 : Math.min(0.55, ad * 0.12));
        }

        rafRef.current = requestAnimationFrame(tick);
    }, [evts, paint]);

    // ── Lifecycle ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!evts.length) return;
        slots.current.forEach((s, i) => { s.evIdx = i % evts.length; paint(s); });
        rafRef.current = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(rafRef.current); prevTRef.current = null; };
    }, [tick, evts, paint]);

    if (!evts.length) return null;

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden select-none"
            style={{ height: CONTAINER_H }}
            onMouseLeave={() => { hoveredRef.current = -1; }}
        >
            {/* ── Cinematic Background Glow ── */}
            <div className="absolute pointer-events-none z-0" style={{
                top: "50%", left: "50%", width: 1000, height: 800,
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(ellipse at center, rgba(255,75,31,0.15) 0%, rgba(200,50,15,0.06) 40%, rgba(80,20,5,0.02) 65%, transparent 85%)",
                filter: "blur(40px)",
                animation: "kineticGlow 25s ease-in-out infinite alternate",
            }} />
            <div className="absolute pointer-events-none z-0" style={{
                top: "50%", left: "50%", width: 600, height: 600,
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(circle, rgba(255,144,104,0.12) 0%, transparent 70%)",
                filter: "blur(80px)",
                animation: "kineticGlow 20s ease-in-out infinite alternate-reverse",
            }} />

            {/* ── Card Slots ── */}
            <div className="absolute inset-0">
                {slots.current.map((slot, k) => (
                    <div
                        key={k}
                        ref={(el) => { slot.el = el; }}
                        className="absolute will-change-transform cursor-pointer"
                        style={{ left: 0, top: 0, transform: "translate3d(-9999px,0,0)" }}
                        onMouseEnter={() => { hoveredRef.current = k; }}
                        onClick={() => {
                            const slug = slot.el?.dataset?.slug;
                            const evId = slot.el?.dataset?.eventId;
                            if (slug || evId) router.push(`/event/${slug || evId}`);
                        }}
                    >
                        <div
                            className="card-inner relative rounded-2xl overflow-hidden flex flex-col justify-end will-change-transform bg-zinc-950 border border-white/[0.06] transition-[border-color] duration-500"
                            style={{ width: BASE_W, height: BASE_H, transformOrigin: "left center" }}
                        >
                            <img data-poster src="/events/placeholder.svg" alt="" draggable="false" decoding="async"
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
                            <div className="card-darken absolute inset-0 bg-black pointer-events-none" style={{ opacity: 0 }} />

                            <div data-live className="absolute top-3 right-3 bg-red-600 text-white text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-lg backdrop-blur-sm" style={{ display: "none" }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
                            </div>

                            <div className="relative z-10 p-4 w-full pointer-events-none">
                                <p data-date className="text-[#ff4b1f] text-[10px] font-bold uppercase tracking-[0.15em] mb-1 drop-shadow-sm" />
                                <h3 data-title className="text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-md mb-0.5" />
                                <div className="flex items-center gap-1.5 mt-1 text-white/55">
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p data-venue className="text-[11px] font-medium truncate drop-shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Cinematic Edge Fades ── */}
            <div className="absolute top-0 bottom-0 left-0 w-40 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent pointer-events-none z-[200]" />
            <div className="absolute top-0 bottom-0 right-0 w-40 bg-gradient-to-l from-[#050505] via-[#050505]/80 to-transparent pointer-events-none z-[200]" />

            <style jsx global>{`
                @keyframes kineticGlow {
                    0%   { opacity: 0.6; transform: translate(-50%, -50%) scale(0.95); }
                    100% { opacity: 1;   transform: translate(-50%, -50%) scale(1.1); }
                }
            `}</style>
        </div>
    );
}
