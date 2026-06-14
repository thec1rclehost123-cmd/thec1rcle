"use client";

import { SectionLabel, GlassCard } from "../EventDetailPrimitives";

export function EventStickyBar({
  dominantColor,
  isFreeEntry,
  onOpenGuestlist,
  onPrimaryAction,
  primaryActionLabel,
  startsFree,
  startingPriceLabel,
  stickySupportLabel,
  ticketsCount,
}) {
  return (
    <div className="sticky top-5 z-30 mt-2">
      <GlassCard className="rounded-[24px] p-4 sm:px-5 sm:py-4" glowColor={dominantColor}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <SectionLabel>Get on the list</SectionLabel>
            <div className="mt-2 text-[clamp(1.15rem,2vw,1.45rem)] font-semibold leading-tight text-white">
              {ticketsCount > 0
                ? isFreeEntry
                  ? "Free RSVP is open now."
                  : startsFree
                    ? "Entry starts free."
                    : `Tickets start at ${startingPriceLabel}.`
                : "Ticket drop coming soon."}
            </div>
            <div className="mt-2 truncate text-[14px] text-white/48">{stickySupportLabel}</div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenGuestlist}
              className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 shadow-[0_0_12px_rgba(255,255,255,0.06)] transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_16px_rgba(255,255,255,0.12)]"
            >
              View Guestlist
            </button>
            <button
              type="button"
              onClick={onPrimaryAction}
              className="rounded-full px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_16px_rgba(255,255,255,0.15)] transition-all hover:scale-[1.02] hover:brightness-110 sm:px-6 sm:py-3.5"
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
  );
}
