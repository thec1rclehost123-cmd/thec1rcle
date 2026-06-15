'use client';

import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Minus, Plus, Share2, Sparkles, Ticket } from 'lucide-react';
import { GlassCard, SectionLabel } from '../EventDetailPrimitives';
import { formatINR, getTierBadge } from '../eventDetailUtils';

export function EventTicketsSidebar({
  appUrl,
  dateShort,
  displayTitle,
  dominantColor,
  entryLabel,
  event,
  eventImage,
  getAvailability,
  getTierLimit,
  handleNotifyMe,
  handlePrimaryAction,
  hostLabel,
  isFreeEntry,
  posterGradient,
  primaryActionLabel,
  quantities,
  selectedTickets,
  setQuantity,
  startingPrice,
  ticketLeadCopy,
  tickets,
  totalFreeSelected,
  totalPrice,
  totalSelected,
  waitlistState,
}) {
  return (
    <aside className="relative order-1 flex flex-col gap-2.5 sm:gap-3 lg:order-2">
      <div
        className="pointer-events-none absolute -inset-20 z-[-1] opacity-60 blur-[80px] transition-opacity duration-700"
        style={{
          background: `radial-gradient(circle, rgba(${dominantColor}, 0.5) 0%, transparent 60%)`,
        }}
      />

      <GlassCard className="p-3 sm:p-4" glowColor={dominantColor}>
        <div className="relative aspect-[0.78] overflow-hidden rounded-[24px] border border-white/10">
          <div className="absolute inset-0" style={{ background: posterGradient }} />
          {eventImage ? (
            <Image
              src={eventImage}
              alt={event?.title || ''}
              fill
              priority
              unoptimized
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,10,0.06),rgba(8,8,10,0.38)_48%,rgba(8,8,10,0.8)_100%)]" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/70 backdrop-blur-md">
              {event?.category || 'Event'}
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
                {hostLabel}
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
            const freeTierLimitLabel =
              quantity >= 1 || (totalFreeSelected >= 1 && quantity === 0)
                ? 'Limit Reached'
                : 'Limit 1';

            return (
              <div
                key={ticket.id}
                className={`relative overflow-hidden rounded-[20px] border px-5 py-5 transition-all duration-300 ${
                  isSelected
                    ? 'border-white/20 bg-white/[0.08] shadow-lg'
                    : 'border-white/[0.06] bg-black/40 hover:bg-black/60'
                } ${availability.isSoldOut ? 'opacity-60 grayscale' : ''}`}
                style={
                  isSelected
                    ? {
                        borderColor: `rgba(${dominantColor}, 0.3)`,
                        boxShadow: `0 12px 36px rgba(${dominantColor}, 0.12)`,
                      }
                    : undefined
                }
              >
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    {badge ? (
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                    <div
                      className={`${badge ? 'mt-2' : ''} text-[16px] font-bold tracking-wide text-white`}
                    >
                      {ticket.name || 'Entry Tier'}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${availability.isSoldOut ? 'bg-red-500/50' : availability.fill > 0.8 ? 'bg-amber-500/80' : 'bg-emerald-500/80'}`}
                      />
                      {availability.label}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[20px] font-black tracking-[-0.04em] text-white">
                      {Number(ticket.price || 0) === 0 ? 'Free' : formatINR(ticket.price)}
                    </div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
                      {Number(ticket.price || 0) === 0
                        ? freeTierLimitLabel
                        : limit > 0
                          ? `Limit ${limit}`
                          : 'Closed'}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
                  <div className="text-[11px] font-semibold text-white/40">
                    {isSelected ? 'Selected' : 'Select Quantity'}
                  </div>

                  {availability.isSoldOut ? (
                    <button
                      type="button"
                      onClick={() => handleNotifyMe(ticket)}
                      disabled={
                        waitlistState[ticket.id] === 'loading' ||
                        waitlistState[ticket.id] === 'joined'
                      }
                      className="rounded-xl border border-white/8 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/50 transition hover:border-white/15 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {waitlistState[ticket.id] === 'joined'
                        ? "You're on the list"
                        : waitlistState[ticket.id] === 'loading'
                          ? '...'
                          : 'Notify Me'}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-1 py-1 backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setQuantity(ticket, quantity - 1)}
                        disabled={quantity <= 0}
                        className="inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
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
                        className="inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div
                  className="absolute bottom-0 left-0 h-1 bg-white/10 transition-all duration-500"
                  style={{
                    width: `${Math.max(2, availability.fill * 100)}%`,
                    background: isSelected ? `rgba(${dominantColor}, 0.8)` : undefined,
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
                    ? 'Pick your tickets'
                    : 'Join the waitlist'}
              </div>
            </div>
            <div className="text-[17px] font-black text-white">
              {selectedTickets.length > 0
                ? formatINR(totalPrice)
                : tickets.length > 0
                  ? isFreeEntry
                    ? 'Free'
                    : formatINR(startingPrice)
                  : '--'}
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
            {selectedTickets.length > 0 ? 'Continue To Checkout' : primaryActionLabel}
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-5" glowColor={dominantColor}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15">
            <img src="/logo-circle.jpg" alt="The C1rcle" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/36">
              App Access
            </div>
            <div className="mt-1 text-[14px] font-semibold text-white">Download the app</div>
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
  );
}
