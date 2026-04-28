"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Instagram,
  MapPin,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  EventCountdown,
  GlassCard,
  MiniAvatar,
  SectionLabel,
} from "../EventDetailPrimitives";

export function EventOverviewColumn({
  aboutText,
  addressLabel,
  appUrl,
  crowdPeople,
  dateShort,
  descriptionParagraphs,
  displayTitle,
  dominantColor,
  event,
  goingLabel,
  hostAvatar,
  hostInstagram,
  hostName,
  hostUrl,
  interestedData,
  isDescriptionExpanded,
  noteLabel,
  noteValue,
  setIsDescriptionExpanded,
  tagline,
  timeShort,
  venueLabel,
}) {
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLabel)}`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(addressLabel)}&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="order-2 flex flex-col gap-2.5 sm:gap-3 lg:order-1">
      <GlassCard className="p-5 sm:p-6 lg:p-7" glowColor={dominantColor}>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.26em] text-white/60">
            <Sparkles className="h-3 w-3" />
            {event?.category || "Announcement"}
          </div>

          <h1 className="mt-4 max-w-4xl font-heading text-[clamp(1.75rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-tight text-white">
            {displayTitle}
          </h1>

          {tagline ? (
            <p className="mt-4 max-w-[58ch] text-[15px] leading-7 text-white/65 sm:text-[16px]">{tagline}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link href={hostUrl} className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 transition hover:border-white/20 hover:bg-white/[0.1]">
              <div className="h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-white/10">
                {hostAvatar ? (
                  <Image src={hostAvatar} alt={hostName} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/70">
                    {hostName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-white/82">{hostName}</div>
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

          {crowdPeople.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3.5 rounded-[22px] border border-white/10 bg-black/30 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">{goingLabel || "The line is forming"}</div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Verified interest on THE C1RCLE</div>
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
          ) : null}
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6" glowColor={dominantColor}>
        <SectionLabel>About the event</SectionLabel>

        <div className={`mt-4 space-y-3 ${!isDescriptionExpanded ? "line-clamp-4" : ""}`}>
          {(descriptionParagraphs.length ? descriptionParagraphs : [aboutText || "Details coming soon."]).map((paragraph) => (
            <p key={paragraph} className="text-[14px] leading-7 text-white/66">
              {paragraph}
            </p>
          ))}
        </div>

        {event?.artists?.length > 0 && isDescriptionExpanded ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <SectionLabel>Lineup</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.artists.map((artist, index) => (
                <span key={index} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-white/80">
                  {artist.name || artist}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {descriptionParagraphs.length > 2 ? (
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
        ) : null}

        <div
          className="mt-5 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3"
          style={{ boxShadow: `0 0 28px rgba(${dominantColor}, 0.08)` }}
        >
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">{noteLabel}</div>
          <div className="mt-2 text-[13px] leading-6 text-white/62">{noteValue}</div>
        </div>
      </GlassCard>

      {crowdPeople.length > 0 ? (
        <GlassCard className="p-5 sm:p-6" glowColor={dominantColor}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <SectionLabel className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Guestlist
              </SectionLabel>
              <div className="mt-3 text-[24px] font-black tracking-[-0.04em] text-white">Who&apos;s Going</div>
              <div className="mt-2 text-[13px] text-white/48">{goingLabel || "Community arrivals show up here first."}</div>
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
      ) : null}

      <EventCountdown event={event} dominantColor={dominantColor} />

      <section id="event-location">
        <GlassCard className="overflow-hidden" glowColor={dominantColor}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
            <div>
              <SectionLabel>Location</SectionLabel>
              <div className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white">{venueLabel}</div>
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
  );
}
