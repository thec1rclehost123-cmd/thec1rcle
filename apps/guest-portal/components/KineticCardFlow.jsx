'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { resolvePoster } from '@c1rcle/core/events';
import { formatEventDate } from '@c1rcle/core/time';
import { useRouter } from 'next/navigation';

const AUTO_SCROLL_PX_PER_SECOND = 42;
const MIN_CARD_WIDTH = 168;
const MAX_CARD_WIDTH = 330;
const SINGLE_CARD_MAX_WIDTH = 420;
const MIN_CARD_HEIGHT_RATIO = 1.42;
const MIN_COPIES = 3;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wrap(value, min, max) {
  const range = max - min;
  if (range <= 0) return min;
  return ((((value - min) % range) + range) % range) + min;
}

function getEventHref(event) {
  if (event?.href) return event.href;
  if (event?.slug) return `/event/${event.slug}`;
  if (event?.id) return `/event/${event.id}`;
  if (event?.handle) return `/event/${event.handle}`;
  return null;
}

function getVenueLabel(event) {
  return event?.venueName || event?.venue?.name || event?.venue || event?.location || 'Venue TBA';
}

function getDateLabel(event) {
  return formatEventDate(event?.startDate || event?.date || Date.now());
}

function buildRail(events, copies) {
  return Array.from({ length: events.length * copies }, (_, index) => ({
    event: events[index % events.length],
    key: `${events[index % events.length]?.id || 'event'}-${index}`,
  }));
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const updateWidth = (nextWidth) => {
      setWidth((current) => {
        if (Math.abs(current - nextWidth) < 1) return current;
        return nextWidth;
      });
    };

    updateWidth(node.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => updateWidth(node.getBoundingClientRect().width);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect?.width || node.getBoundingClientRect().width;
      updateWidth(nextWidth);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function EventCardFace({
  event,
  overlayOpacity,
  imageScale,
  imageFilter,
  accentOpacity,
  sheenOpacity,
}) {
  const poster = resolvePoster(event);
  const dateLabel = getDateLabel(event);
  const venueLabel = getVenueLabel(event);
  const isLive = event?.isLive;

  return (
    <>
      <motion.img
        src={poster}
        alt={event?.title || 'Featured event'}
        draggable="false"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          scale: imageScale,
          filter: imageFilter,
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,126,74,0.22),transparent_42%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/65" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/25 to-transparent" />
      <motion.div className="absolute inset-0 bg-[#040202]" style={{ opacity: overlayOpacity }} />
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.08)_18%,transparent_34%)]"
        style={{ opacity: sheenOpacity }}
      />
      <motion.div
        className="absolute inset-[1px] rounded-[27px] border border-[#ff6a3d]/80"
        style={{ opacity: accentOpacity }}
      />
      <motion.div
        className="absolute inset-x-8 bottom-0 h-24 rounded-full bg-[#ff6a3d] blur-3xl"
        style={{
          opacity: accentOpacity,
          className: cn(
            event.isLive ? 'text-green-400 fill-green-400' : 'text-slate-400 fill-slate-400',
          ),
        }}
      />

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-white/90 backdrop-blur-md">
        <span
          className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#ff5a2b] animate-pulse' : 'bg-[#ffd1c2]'}`}
        />
        {isLive ? 'Live' : 'C1RCLE Pick'}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-6">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#ff6a3d]">
          {dateLabel}
        </p>
        <h3 className="line-clamp-3 text-2xl font-black uppercase leading-[0.88] tracking-[-0.04em] text-white md:text-[2rem]">
          {event?.title || 'Untitled Event'}
        </h3>
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-white/72">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/90">
            •
          </span>
          <p className="truncate">{venueLabel}</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/58">
          <span>Featured Drop</span>
          <span className="text-[#ff9b7d]">Enter</span>
        </div>
      </div>
    </>
  );
}

function FlowCard({
  event,
  index,
  centerIndex,
  cardPitch,
  arcRadius,
  progress,
  cardWidth,
  cardHeight,
  centerYRatio,
  onOpen,
}) {
  const baseOffset = (index - centerIndex) * cardPitch;
  const maxAngle = Math.PI * 0.58;

  const theta = () => clamp((baseOffset - progress.get()) / arcRadius, -maxAngle, maxAngle);
  const focus = useTransform(() => {
    const angle = Math.abs(theta());
    return clamp(1 - angle / (maxAngle * 0.96), 0, 1);
  });

  const x = useTransform(() => Math.sin(theta()) * arcRadius);
  const y = useTransform(() => (1 - Math.cos(theta())) * cardHeight * 0.32);
  const z = useTransform(() => (Math.cos(theta()) - 1) * arcRadius * 1.25);
  const opacity = useTransform(focus, [0, 1], [0.2, 1]);
  const rotateY = useTransform(() => (-theta() * 180) / Math.PI);
  const rotateZ = useTransform(() => clamp(((theta() * 180) / Math.PI) * 0.08, -4.5, 4.5));
  const overlayOpacity = useTransform(focus, [0, 1], [0.48, 0.04]);
  const imageScale = useTransform(focus, [0, 1], [1.08, 1.02]);
  const imageBrightness = useTransform(focus, [0, 1], [0.62, 1]);
  const imageSaturate = useTransform(focus, [0, 1], [0.8, 1.06]);
  const accentOpacity = useTransform(focus, [0, 1], [0.06, 0.48]);
  const sheenOpacity = useTransform(focus, [0, 1], [0.08, 0.4]);
  const imageFilter = useMotionTemplate`brightness(${imageBrightness}) saturate(${imageSaturate})`;
  const shadowAlpha = useTransform(focus, [0, 1], [0.1, 0.34]);
  const shadow = useMotionTemplate`0 30px 80px rgba(0, 0, 0, ${shadowAlpha})`;
  const zIndex = useTransform(() => Math.round(120 + focus.get() * 180));

  return (
    <motion.button
      type="button"
      className="absolute left-1/2 top-1/2 overflow-hidden rounded-[28px] border border-white/10 bg-[#120907] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d]/80"
      style={{
        width: cardWidth,
        height: cardHeight,
        marginLeft: -cardWidth / 2,
        marginTop: -cardHeight / 2,
        top: `${centerYRatio * 100}%`,
        x,
        y,
        z,
        rotateY,
        rotateZ,
        opacity,
        zIndex,
        boxShadow: shadow,
        transformStyle: 'preserve-3d',
        transformOrigin: 'center 78%',
        willChange: 'transform',
      }}
      onClick={() => onOpen(event)}
      aria-label={event?.title ? `Open ${event.title}` : 'Open featured event'}
    >
      <EventCardFace
        event={event}
        overlayOpacity={overlayOpacity}
        imageScale={imageScale}
        imageFilter={imageFilter}
        accentOpacity={accentOpacity}
        sheenOpacity={sheenOpacity}
      />
    </motion.button>
  );
}

function SingleFeaturedCard({ event, cardWidth, cardHeight, onOpen }) {
  return (
    <motion.button
      type="button"
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#120907] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d]/80"
      style={{
        width: cardWidth,
        height: cardHeight,
        boxShadow: '0 38px 110px rgba(0, 0, 0, 0.34)',
      }}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen(event)}
      aria-label={event?.title ? `Open ${event.title}` : 'Open featured event'}
    >
      <EventCardFace
        event={event}
        overlayOpacity={0.08}
        imageScale={1.03}
        imageFilter="brightness(1) saturate(1.04)"
        accentOpacity={0.28}
        sheenOpacity={0.24}
      />
    </motion.button>
  );
}

export default function KineticCardFlow({ events = [] }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const progress = useMotionValue(0);
  const containerWidth = useElementWidth(containerRef);

  const stageWidth = containerWidth || 1200;
  const isMobile = stageWidth < 768;
  const cardWidth = clamp(stageWidth * (isMobile ? 0.56 : 0.24), MIN_CARD_WIDTH, MAX_CARD_WIDTH);
  const cardHeight = Math.round(cardWidth * MIN_CARD_HEIGHT_RATIO);
  const cardPitch = cardWidth;
  const arcRadius = Math.max(
    stageWidth * (isMobile ? 0.54 : 0.48),
    cardWidth * (isMobile ? 1.7 : 1.95),
  );
  const stageHeight = Math.round(cardHeight + cardHeight * (isMobile ? 0.48 : 0.6));
  const centerYRatio = isMobile ? 0.43 : 0.4;
  const cycleWidth = Math.max(cardPitch * events.length, 1);
  const visibleSlots = Math.ceil((stageWidth + cardWidth * 2) / cardPitch);
  const copies = Math.max(
    MIN_COPIES,
    Math.ceil((visibleSlots + events.length * 2) / Math.max(events.length, 1)),
  );
  const rail = useMemo(() => buildRail(events, copies), [events, copies]);
  const centerIndex = Math.floor(rail.length / 2);

  useEffect(() => {
    progress.set(cycleWidth > 0 ? wrap(progress.get(), 0, cycleWidth) : 0);
  }, [cycleWidth, progress]);

  useAnimationFrame((_, delta) => {
    if (shouldReduceMotion || events.length < 2 || cycleWidth <= 0) return;
    const next = wrap(progress.get() + (AUTO_SCROLL_PX_PER_SECOND * delta) / 1000, 0, cycleWidth);
    progress.set(next);
  });

  const openEvent = (event) => {
    const href = getEventHref(event);
    if (href) router.push(href);
  };

  if (!events.length) return null;

  if (events.length === 1) {
    const staticWidth = clamp(
      stageWidth * (isMobile ? 0.84 : 0.32),
      MIN_CARD_WIDTH,
      SINGLE_CARD_MAX_WIDTH,
    );
    const staticHeight = Math.round(staticWidth * MIN_CARD_HEIGHT_RATIO);

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative mx-auto flex w-full items-center justify-center px-4',
          events[0]?.isLive ? 'text-green-400 fill-green-400' : 'text-slate-400 fill-slate-400',
        )}
        style={{ minHeight: staticHeight + 48 }}
      >
        <SingleFeaturedCard
          event={events[0]}
          cardWidth={staticWidth}
          cardHeight={staticHeight}
          onOpen={openEvent}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full select-none overflow-hidden"
      style={{
        height: stageHeight,
        perspective: '1800px',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,98,53,0.22),transparent_40%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[12%] h-[110%] w-[140%] -translate-x-1/2 rounded-[999px] border border-white/[0.05]" />
      <div className="pointer-events-none absolute left-1/2 top-[20%] h-[96%] w-[118%] -translate-x-1/2 rounded-[999px] border border-[#ff6a3d]/[0.08]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[400] w-24 bg-gradient-to-r from-[#050505] via-[#050505]/86 to-transparent md:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[400] w-24 bg-gradient-to-l from-[#050505] via-[#050505]/86 to-transparent md:w-40" />

      <div className="absolute inset-0">
        {rail.map(({ event, key }, index) => (
          <FlowCard
            key={key}
            event={event}
            index={index}
            centerIndex={centerIndex}
            cardPitch={cardPitch}
            arcRadius={arcRadius}
            progress={progress}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            centerYRatio={centerYRatio}
            onOpen={openEvent}
          />
        ))}
      </div>
    </div>
  );
}
