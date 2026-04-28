"use client";

import Link from "next/link";

export function PromoterHandleView({
  bio,
  city,
  events,
  handle,
  initials,
  name,
  promoter,
  status,
  tonightEvents,
  upcomingEvents,
}) {
  if (status === "loading") {
    return <div className="min-h-screen animate-pulse bg-[#050508]" />;
  }

  if (status !== "ready" || !promoter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] px-6 text-center text-white">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-violet-400">Promoter unavailable</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight">We could not find this promoter.</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-24 pt-16">
        <div className="mb-14 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-3xl font-black text-white shadow-2xl shadow-violet-900/50">
              {initials}
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#050508]">
              <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <h1 className="mb-1 text-4xl font-black tracking-tight">{name}</h1>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-widest text-violet-400">
            @{handle} · {city}
          </p>
          {bio ? <p className="mt-1 max-w-sm text-[14px] leading-relaxed text-white/50">{bio}</p> : null}

          <div className="mt-8 flex w-full items-center justify-center gap-8 border-t border-white/[0.06] pt-8">
            <StatPill label="Events" value={promoter.eventsCount || events.length || "—"} />
            <div className="h-8 w-px bg-white/10" />
            <StatPill label="Guests Brought" value={formatNum(promoter.totalGuests || promoter.guestsCount)} />
            <div className="h-8 w-px bg-white/10" />
            <StatPill label="City" value={city} />
          </div>
        </div>

        {tonightEvents.length > 0 ? (
          <Section label="Tonight">
            {tonightEvents.map((event) => (
              <EventCard key={event.id} event={event} handle={handle} highlight />
            ))}
          </Section>
        ) : null}

        {upcomingEvents.length > 0 ? (
          <Section label={tonightEvents.length > 0 ? "Upcoming" : "Events"}>
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} handle={handle} />
            ))}
          </Section>
        ) : null}

        {events.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/20">No active events</p>
            <p className="mt-2 text-xs text-white/10">Check back soon</p>
          </div>
        ) : null}

        <div className="mt-20 text-center">
          <Link href="/explore" className="text-[10px] font-black uppercase tracking-[0.25em] text-white/20 transition-colors hover:text-white/40">
            Powered by THE C1RCLE
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl font-black text-white">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{label}</span>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="mb-12">
      <div className="mb-6 flex items-center gap-4">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">{label}</span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function EventCard({ event, handle, highlight = false }) {
  const title = event.title || event.name || "Untitled Event";
  const slug = event.slug || event.id;
  const venue = event.venueName || event.venue?.name || event.location || null;
  const date = formatEventDate(event.startDate);
  const href = event.promoterLinkUrl || (event.promoterLinkCode ? `/${handle}/${slug}?ref=${encodeURIComponent(event.promoterLinkCode)}` : `/${handle}/${slug}`);
  const poster = event.image || event.poster || event.coverImage || null;

  return (
    <Link href={href} className="group block">
      <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${highlight
        ? "border-violet-500/30 bg-violet-950/30 hover:border-violet-400/50"
        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
        }`}>
        <div className="flex gap-0">
          {poster ? (
            <div className="w-28 flex-shrink-0">
              <img src={poster} alt={title} className="min-h-[96px] h-full w-full object-cover" />
            </div>
          ) : null}

          <div className="flex min-h-[96px] flex-1 flex-col justify-between p-4">
            <div>
              {highlight ? (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                  Tonight
                </span>
              ) : null}
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white">{title}</h3>
              {venue ? <p className="mt-0.5 truncate text-[11px] font-medium text-white/40">{venue}</p> : null}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/40">{date}</span>
              <div className="flex items-center gap-2">
                {event.priceLabel ? <span className="text-[11px] font-bold text-white/60">{event.priceLabel}</span> : null}
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 transition-colors group-hover:text-violet-300">
                  Get In →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatEventDate(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
  } catch {
    return "";
  }
}

function formatNum(value) {
  if (!value) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}
