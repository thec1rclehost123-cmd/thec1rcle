"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { AmbientDots } from "../features/events/EventDetailPrimitives";
import { EventCrowdModal } from "../features/events/components/EventCrowdModal";
import { EventOverviewColumn } from "../features/events/components/EventOverviewColumn";
import { EventStickyBar } from "../features/events/components/EventStickyBar";
import { EventTicketsSidebar } from "../features/events/components/EventTicketsSidebar";
import {
  buildHostUrl,
  buildPosterGradient,
  formatDisplayTitle,
  formatINR,
  parseParagraphs,
  resolveBackdropPoster,
  resolveEventImage,
  resolveInstagramProfile,
} from "../features/events/eventDetailUtils";
import { useEventTicketSelection } from "../features/events/hooks/useEventTicketSelection";
import { useDominantColor } from "../features/events/useDominantColor";

export default function EventDetail({
  event,
  host,
  interestedData = { count: 0, users: [] },
  onAction,
}) {
  const { user } = useAuth();

  const posterArtwork = useMemo(() => resolveBackdropPoster(event) || resolveEventImage(event), [event]);
  const eventImage = posterArtwork;
  const dominantColor = useDominantColor(eventImage);
  const {
    crowdModalOpen,
    crowdPeople,
    dateShort,
    entryLabel,
    getAvailability,
    getTierLimit,
    goingLabel,
    handleNotifyMe,
    handlePrimaryAction,
    isDescriptionExpanded,
    isFreeEntry,
    noteLabel,
    noteValue,
    primaryActionLabel,
    quantities,
    scheduleDate,
    scheduleDoorNote,
    selectedTickets,
    setCrowdModalOpen,
    setIsDescriptionExpanded,
    setQuantity,
    startingPrice,
    startsFree,
    stickySupportLabel,
    tagline,
    ticketLeadCopy,
    tickets,
    timeLabel,
    timeShort,
    totalFreeSelected,
    totalPrice,
    totalSelected,
    venueLabel,
    waitlistState,
  } = useEventTicketSelection({
    event,
    host,
    interestedData,
    onAction,
    user,
  });
  const addressLabel = event?.address || venueLabel;
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
  const description = event?.description || event?.summary || "";
  const descriptionParagraphs = parseParagraphs(description);
  const aboutText = event?.summary || descriptionParagraphs[0] || "";
  const startingPriceLabel = formatINR(startingPrice);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#0A0A0A] text-white"
      style={{ "--event-accent": dominantColor }}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-black" />
        <div
          className="absolute inset-0 opacity-100 mix-blend-screen"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, rgba(var(--event-accent), 0.9), transparent 85%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-80 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(var(--event-accent), 0.5), transparent 85%)`,
          }}
        />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px 256px" }} />
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

            <EventStickyBar
              dominantColor={dominantColor}
              isFreeEntry={isFreeEntry}
              onOpenGuestlist={() => setCrowdModalOpen(true)}
              onPrimaryAction={handlePrimaryAction}
              primaryActionLabel={primaryActionLabel}
              startsFree={startsFree}
              startingPriceLabel={startingPriceLabel}
              stickySupportLabel={stickySupportLabel}
              ticketsCount={tickets.length}
            />

            <div className="mt-2 grid items-start gap-2.5 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
              <EventOverviewColumn
                aboutText={aboutText}
                addressLabel={addressLabel}
                appUrl={appUrl}
                crowdPeople={crowdPeople}
                dateShort={dateShort}
                descriptionParagraphs={descriptionParagraphs}
                displayTitle={displayTitle}
                dominantColor={dominantColor}
                event={event}
                goingLabel={goingLabel}
                hostAvatar={hostAvatar}
                hostInstagram={hostInstagram}
                hostName={hostName}
                hostUrl={hostUrl}
                interestedData={interestedData}
                isDescriptionExpanded={isDescriptionExpanded}
                noteLabel={noteLabel}
                noteValue={noteValue}
                setIsDescriptionExpanded={setIsDescriptionExpanded}
                tagline={tagline}
                timeShort={timeShort}
                venueLabel={venueLabel}
              />

              <EventTicketsSidebar
                appUrl={appUrl}
                dateShort={dateShort}
                displayTitle={displayTitle}
                dominantColor={dominantColor}
                entryLabel={entryLabel}
                event={event}
                eventImage={eventImage}
                getAvailability={getAvailability}
                getTierLimit={getTierLimit}
                handleNotifyMe={handleNotifyMe}
                handlePrimaryAction={handlePrimaryAction}
                hostLabel={organizerLabel}
                isFreeEntry={isFreeEntry}
                posterGradient={posterGradient}
                primaryActionLabel={primaryActionLabel}
                quantities={quantities}
                selectedTickets={selectedTickets}
                setQuantity={setQuantity}
                startingPrice={startingPrice}
                ticketLeadCopy={ticketLeadCopy}
                tickets={tickets}
                totalFreeSelected={totalFreeSelected}
                totalPrice={totalPrice}
                totalSelected={totalSelected}
                waitlistState={waitlistState}
              />
            </div>
          </div>
        </div>
      </div>

      {crowdModalOpen ? (
        <EventCrowdModal
          crowdPeople={crowdPeople}
          dominantColor={dominantColor}
          interestedCount={interestedData?.count || 0}
          onClose={() => setCrowdModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
