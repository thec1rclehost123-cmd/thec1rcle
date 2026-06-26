'use client';

import Image from 'next/image';
import ShimmerImage from '../ShimmerImage';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import TicketModal from './TicketModal';
import GuestlistModal from './GuestlistModal';
import LikeButton from './LikeButton';
import { formatEventDate, formatEventTime } from '@c1rcle/core/time';

const avatarPalette = ['#FDE047', '#F43F5E', '#A855F7', '#38BDF8', '#34D399', '#F97316'];
// 50-entry gender-assigned pool (35F + 15M = 7:3 ratio) for aesthetic social proof
const fallbackGuestPool = [
  { name: 'Ari', gender: 'female' },
  { name: 'Ira', gender: 'female' },
  { name: 'Nia', gender: 'female' },
  { name: 'Reva', gender: 'female' },
  { name: 'Luna', gender: 'female' },
  { name: 'Mira', gender: 'female' },
  { name: 'Sara', gender: 'female' },
  { name: 'Zara', gender: 'female' },
  { name: 'Anaya', gender: 'female' },
  { name: 'Isha', gender: 'female' },
  { name: 'Priya', gender: 'female' },
  { name: 'Meera', gender: 'female' },
  { name: 'Diya', gender: 'female' },
  { name: 'Kavya', gender: 'female' },
  { name: 'Anika', gender: 'female' },
  { name: 'Neha', gender: 'female' },
  { name: 'Tara', gender: 'female' },
  { name: 'Sia', gender: 'female' },
  { name: 'Rhea', gender: 'female' },
  { name: 'Noor', gender: 'female' },
  { name: 'Leila', gender: 'female' },
  { name: 'Alina', gender: 'female' },
  { name: 'Zoe', gender: 'female' },
  { name: 'Anya', gender: 'female' },
  { name: 'Mahi', gender: 'female' },
  { name: 'Riya', gender: 'female' },
  { name: 'Shreya', gender: 'female' },
  { name: 'Pooja', gender: 'female' },
  { name: 'Natasha', gender: 'female' },
  { name: 'Kamya', gender: 'female' },
  { name: 'Vanya', gender: 'female' },
  { name: 'Aisha', gender: 'female' },
  { name: 'Sana', gender: 'female' },
  { name: 'Raina', gender: 'female' },
  { name: 'Urvi', gender: 'female' },
  { name: 'Dev', gender: 'male' },
  { name: 'Vik', gender: 'male' },
  { name: 'Taj', gender: 'male' },
  { name: 'Noah', gender: 'male' },
  { name: 'Kian', gender: 'male' },
  { name: 'Aryan', gender: 'male' },
  { name: 'Rohan', gender: 'male' },
  { name: 'Jai', gender: 'male' },
  { name: 'Sai', gender: 'male' },
  { name: 'Zaid', gender: 'male' },
  { name: 'Nikhil', gender: 'male' },
  { name: 'Veer', gender: 'male' },
  { name: 'Dhruv', gender: 'male' },
  { name: 'Aadi', gender: 'male' },
  { name: 'Rehan', gender: 'male' },
];
const fallbackTickets = [
  { id: 'ga', name: 'General Admission', price: 899, quantity: 200 },
  { id: 'vip', name: 'VIP Booth', price: 3200, quantity: 12 },
  { id: 'crew', name: 'Creator Tables', price: 0, quantity: 0 },
];

// ── Icons ──
const CopyIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
    />
  </svg>
);

const WhatsappIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05.003C5.427.003.041 5.39.038 12.013c0 2.116.554 4.18 1.606 6.006L.002 24l6.142-1.611a11.78 11.78 0 005.904 1.57h.005c6.622 0 12.008-5.387 12.011-12.01.003-3.21-1.246-6.223-3.513-8.491z" />
  </svg>
);

const CrownIcon = () => (
  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M2 19l2-10 4 5 4-9 4 9 4-5 2 10H2z" />
  </svg>
);
const SparklesIcon = () => (
  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);
const HeartIcon = () => (
  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
  </svg>
);
const PairIcon = () => (
  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const BadgeIcon = ({ type }) => {
  if (type === 'crown') return <CrownIcon />;
  if (type === 'sparkles') return <SparklesIcon />;
  if (type === 'heart') return <HeartIcon />;
  if (type === 'pair') return <PairIcon />;
  return null;
};

// ── Helpers ──
const initials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const buildHandle = (name, index) => {
  const safe = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `@${safe || `guest${index}`}`;
};

const guestStats = (index) =>
  `${20 + index} events · ${Math.max(3, 4 + index)} months on THE C1RCLE`;

const getCuratedAvatars = (users = [], targetCount = 10) => {
  const femaleTarget = Math.round(targetCount * 0.7);
  const maleTarget = targetCount - femaleTarget;
  const realFemales = users.filter((u) => u.gender === 'female');
  const realMales = users.filter((u) => u.gender === 'male' || !u.gender);
  const femaleSlots = realFemales.slice(0, femaleTarget);
  const femalePlaceholders =
    femaleSlots.length < femaleTarget
      ? fallbackGuestPool
          .filter((g) => g.gender === 'female' && !realFemales.some((u) => u.name === g.name))
          .slice(0, femaleTarget - femaleSlots.length)
          .map((g, i) => ({
            id: `ph-f-${i}`,
            name: g.name,
            gender: 'female',
            color: avatarPalette[i % avatarPalette.length],
            initials: g.name.slice(0, 2).toUpperCase(),
            photoURL: null,
          }))
      : [];
  const maleSlots = realMales.slice(0, maleTarget);
  const malePlaceholders =
    maleSlots.length < maleTarget
      ? fallbackGuestPool
          .filter((g) => g.gender === 'male' && !realMales.some((u) => u.name === g.name))
          .slice(0, maleTarget - maleSlots.length)
          .map((g, i) => ({
            id: `ph-m-${i}`,
            name: g.name,
            gender: 'male',
            color: avatarPalette[(i + 3) % avatarPalette.length],
            initials: g.name.slice(0, 2).toUpperCase(),
            photoURL: null,
          }))
      : [];
  return [...femaleSlots, ...femalePlaceholders, ...maleSlots, ...malePlaceholders];
};

const createGuestDirectory = (guests = []) => {
  if (guests?.length) {
    return guests.map((name, index) => ({
      id: `${name}-${index}`,
      name,
      gender: null,
      handle: buildHandle(name, index),
      stats: guestStats(index),
      color: avatarPalette[index % avatarPalette.length],
      initials: initials(name),
    }));
  }
  return fallbackGuestPool.map((guest, index) => ({
    id: `fp-${guest.name}-${index}`,
    name: guest.name,
    gender: guest.gender,
    handle: buildHandle(guest.name, index),
    stats: guestStats(index),
    color: avatarPalette[index % avatarPalette.length],
    initials: initials(guest.name),
  }));
};

// Returns tier-specific border, badge, and price styling
const getTierStyle = (ticket) => {
  const key = (ticket.name || ticket.id || '').toLowerCase();
  const qty = Number(ticket.quantity ?? 150);

  const avail =
    qty <= 0
      ? { label: 'SOLD OUT', chip: 'text-red-400 bg-red-500/10 border-red-500/20' }
      : qty < 35
        ? { label: 'FEW LEFT', chip: 'text-amber-400 bg-amber-500/10 border-amber-400/20' }
        : { label: 'AVAILABLE', chip: 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20' };

  if (qty <= 0)
    return {
      border: 'border-red-500/20 opacity-60',
      shadow: '',
      badge: null,
      priceColor: 'text-red-400 line-through',
      avail,
    };
  if (key.includes('vip') || key.includes('table'))
    return {
      border: 'border-yellow-500/40',
      shadow: 'shadow-[0_0_30px_rgba(234,179,8,0.08)]',
      badge: 'VIP',
      badgeIcon: 'crown',
      badgeStyle: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      priceColor: 'text-yellow-400',
      avail,
    };
  if (key.includes('crew') || key.includes('artist'))
    return {
      border: 'border-[#5D5FEF]/40',
      shadow: 'shadow-[0_0_30px_rgba(93,95,239,0.08)]',
      badge: 'Creator',
      badgeIcon: 'sparkles',
      badgeStyle: 'text-[#8B8DFF] bg-[#5D5FEF]/10 border-[#5D5FEF]/20',
      priceColor: 'text-[#8B8DFF]',
      avail,
    };
  if (key.includes('female') || key.includes('ladies'))
    return {
      border: 'border-rose-400/40',
      shadow: 'shadow-[0_0_20px_rgba(251,113,133,0.06)]',
      badge: 'Ladies',
      badgeIcon: 'heart',
      badgeStyle: 'text-rose-300 bg-rose-500/10 border-rose-400/20',
      priceColor: 'text-rose-300',
      avail,
    };
  if (key.includes('couple') || key.includes('pair'))
    return {
      border: 'border-pink-400/30',
      shadow: '',
      badge: 'Couple',
      badgeIcon: 'pair',
      badgeStyle: 'text-pink-300 bg-pink-500/10 border-pink-400/20',
      priceColor: 'text-pink-300',
      avail,
    };
  return { border: 'border-white/10', shadow: '', badge: null, priceColor: 'text-white', avail };
};

const SectionLabel = ({ children, className }) => (
  <p
    className={`mb-6 text-[10px] font-black uppercase tracking-[0.4em] ${className ?? 'text-white/40'}`}
  >
    {children}
  </p>
);

// ── Main Component ──
export default function EventDetailPage({
  event,
  host,
  interestedData = { count: 0, users: [] },
  guestlist = [],
  isPreview = false,
  onAction = () => {},
  user = null,
  profile = null,
  toast = () => {},
}) {
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const interestedUsers = useMemo(() => {
    if (interestedData.users?.length > 0) {
      return interestedData.users.map((u, i) => ({
        ...u,
        id: u.id || `int-${i}`,
        color: avatarPalette[i % avatarPalette.length],
        initials: u.initials || (u.name ? initials(u.name) : '??'),
      }));
    }
    const count = interestedData.count || event?.stats?.saves || 0;
    if (count === 0 && !isPreview) return [];
    return createGuestDirectory().map((u) => ({
      ...u,
      photoURL: isPreview ? 'placeholder' : null,
    }));
  }, [interestedData.users, interestedData.count, event?.stats?.saves, isPreview]);

  const previewInterested = useMemo(() => getCuratedAvatars(interestedUsers, 6), [interestedUsers]);
  const tickets = event?.tickets?.length ? event.tickets : isPreview ? fallbackTickets : [];

  const eventImage = useMemo(() => {
    if (event?.image && typeof event.image === 'string') return event.image;
    if (event?.poster && typeof event.poster === 'string') return event.poster;
    if (event?.posterUrl && typeof event.posterUrl === 'string') return event.posterUrl;
    if (event?.flyer && typeof event.flyer === 'string') return event.flyer;
    if (event?.flyerUrl && typeof event.flyerUrl === 'string') return event.flyerUrl;
    if (Array.isArray(event?.images) && event.images.length > 0) return event.images[0];
    if (Array.isArray(event?.gallery) && event.gallery.length > 0) return event.gallery[0];
    return null;
  }, [
    event?.image,
    event?.poster,
    event?.posterUrl,
    event?.flyer,
    event?.flyerUrl,
    event?.images,
    event?.gallery,
  ]);

  const startingPrice = useMemo(() => {
    const paid = tickets.filter((t) => Number(t.price) > 0);
    return paid.length === 0 ? 0 : Math.min(...paid.map((t) => Number(t.price)));
  }, [tickets]);

  const isFree = tickets.length > 0 && tickets.every((t) => Number(t.price) === 0);
  const interestedCount = interestedData.count || (isPreview ? 0 : event?.stats?.saves || 0);
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(event?.location || event?.venue || 'Pune, IN')}&z=14&ie=UTF8&iwloc=&output=embed`;
  const isTonight = useMemo(() => {
    if (!event?.startDate) return false;
    return new Date(event.startDate).toDateString() === new Date().toDateString();
  }, [event?.startDate]);
  const isLive = event?.lifecycle === 'live' || event?.status === 'live';

  // Vibe tags from real event data, not hardcoded
  const vibeTags = useMemo(
    () =>
      [
        ...(event?.genres || []),
        ...(event?.tags || []),
        event?.category || null,
        event?.dressCode ? `Dress: ${event.dressCode}` : null,
        event?.ageLimit || event?.ageRestriction || null,
      ].filter(Boolean),
    [
      event?.genres,
      event?.tags,
      event?.category,
      event?.dressCode,
      event?.ageLimit,
      event?.ageRestriction,
    ],
  );

  // Schedule timeline from real event data
  const scheduleEntries = useMemo(
    () =>
      [
        event?.doorsOpen ? { label: 'Doors Open', time: formatEventTime(event.doorsOpen) } : null,
        event?.startTime || event?.time
          ? { label: 'Event Starts', time: formatEventTime(event.startTime || event.time) }
          : null,
        event?.lastEntry ? { label: 'Last Entry', time: formatEventTime(event.lastEntry) } : null,
        event?.endTime ? { label: 'Event Ends', time: formatEventTime(event.endTime) } : null,
      ].filter(Boolean),
    [event?.doorsOpen, event?.startTime, event?.time, event?.lastEntry, event?.endTime],
  );

  const handleAction = (type, data = {}) => {
    if (isPreview) return;
    if (onAction) onAction(type, data);
  };

  useEffect(() => {
    handleAction('TRACK', { event: 'event_view', eventId: event?.id });
  }, [event?.id]);

  return (
    <div
      className={`relative isolate min-h-screen pb-32 text-white bg-black overflow-x-hidden ${isPreview ? 'preview-mode' : ''}`}
    >
      {/* Film grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ━━━ ZONE 1: CINEMATIC HERO ━━━ */}
      <section className="relative h-[100dvh] min-h-[620px] overflow-hidden flex flex-col">
        {/* Layer B: Blurred ambient color aura — behind everything */}
        {eventImage && (
          <div
            className="absolute inset-0 -z-10 overflow-hidden opacity-55"
            style={{
              maskImage:
                'linear-gradient(to bottom, transparent 5%, black 35%, black 65%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 5%, black 35%, black 65%, transparent 100%)',
            }}
          >
            <ShimmerImage
              src={eventImage}
              alt=""
              fill
              sizes="100vw"
              className="object-cover blur-[150px] saturate-[2.2] scale-[1.4]"
            />
          </div>
        )}

        {/* Layer A: Real poster with gradient mask and parallax */}
        {eventImage && (
          <div
            className="absolute inset-0"
            style={{
              maskImage: 'linear-gradient(to bottom, black 0%, black 38%, transparent 78%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 38%, transparent 78%)',
            }}
          >
            {/* Extended container so parallax shift doesn't expose bg at bottom */}
            <div
              className="absolute inset-x-0 top-0 bottom-[-30vh] will-change-transform"
              style={{ transform: `translateY(${scrollY * 0.3}px)` }}
            >
              <ShimmerImage
                src={eventImage}
                alt={event?.title || ''}
                fill
                priority
                sizes="100vw"
                className="object-cover object-top"
              />
            </div>
            {/* Text legibility: left-weighted vignette + bottom fade */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-black" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
          </div>
        )}

        {/* No poster fallback */}
        {!eventImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
        )}

        {/* Sticky Nav Pill */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-[60] px-4 pt-4 md:px-8 shrink-0"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-black/60 px-5 py-3 shadow-2xl backdrop-blur-3xl">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-white text-black font-black text-sm shrink-0">
                  C
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] hidden sm:block">
                  THE C1RCLE
                </span>
              </Link>
              {host && (
                <>
                  <div className="h-4 w-px bg-white/10 hidden sm:block" />
                  <div className="hidden sm:flex items-center gap-2.5">
                    {host.avatar && (
                      <Image
                        src={host.avatar}
                        alt={host.name || ''}
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    )}
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">
                      {host.name}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LikeButton
                eventId={event?.id}
                isLiked={isLiked}
                isPreview={isPreview}
                onLike={(val) => {
                  setIsLiked(val);
                  handleAction('LIKE', { val });
                }}
              />
              <button
                type="button"
                disabled={isPreview}
                onClick={() => handleAction('SHARE', { id: 'copy' })}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white hover:text-black disabled:opacity-40"
              >
                <CopyIcon />
              </button>
            </div>
          </div>
        </motion.header>

        {/* Hero content — anchored to bottom of section */}
        <div className="relative z-10 mt-auto px-6 pb-12 md:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            >
              {/* Status pill */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange/30 bg-orange/10 px-4 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-orange">
                    {isLive ? 'LIVE NOW' : isTonight ? 'TONIGHT' : event?.category || 'Event'}
                  </span>
                </span>
                {event?.isHighDemand && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                    SELLING FAST
                  </span>
                )}
              </div>

              {/* Event title */}
              <h1 className="text-[clamp(2.8rem,9vw,7.5rem)] font-display uppercase tracking-tighter text-white leading-[0.88] mb-5 max-w-4xl">
                {event?.title || 'Event Title'}
              </h1>

              {/* Date · Venue */}
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40 mb-10">
                {formatEventDate(event?.startDate)}
                {event?.startTime && <> &middot; {event.startTime}</>}
                {(event?.venue || event?.location) && (
                  <> &middot; {event?.venue || event?.location}</>
                )}
                {event?.city && <>, {event.city}</>}
              </p>

              {/* Social proof + CTA */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {(previewInterested.length > 0 || interestedCount > 0) && (
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                      {previewInterested.map((guest, i) => (
                        <div
                          key={i}
                          className="h-11 w-11 overflow-hidden rounded-full border-[2.5px] border-black bg-zinc-900 shrink-0"
                        >
                          {guest.photoURL && guest.photoURL !== 'placeholder' ? (
                            <Image
                              src={guest.photoURL}
                              alt={guest.name}
                              width={44}
                              height={44}
                              className="object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center text-[8px] font-black"
                              style={{ backgroundColor: guest.color }}
                            >
                              {guest.initials}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xl font-display text-white tracking-tighter">
                        {(interestedCount + 80).toLocaleString()}+
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                        People Going
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setTicketModalOpen(true)}
                  disabled={isPreview}
                  className="rounded-full bg-white px-10 py-4 text-[11px] font-black uppercase tracking-[0.4em] text-black transition-all hover:scale-105 active:scale-95 shadow-2xl disabled:opacity-50"
                >
                  {isFree ? 'Secure Spot' : 'Book Access'}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: scrollY < 60 ? 0.6 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5"
        >
          <div className="h-8 w-px bg-gradient-to-b from-white/50 to-transparent" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/30">
            Scroll
          </span>
        </motion.div>
      </section>

      {/* ━━━ ZONE 2: CONTENT GRID ━━━ */}
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
          {/* ── Left column ── */}
          <div className="space-y-8">
            {/* About */}
            {event?.description && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="rounded-[40px] border border-white/10 bg-white/[0.02] p-10"
              >
                <SectionLabel>About</SectionLabel>
                <div className="text-lg leading-relaxed text-white/60 font-medium whitespace-pre-wrap">
                  {event.description}
                </div>
                {event?.summary && event.summary !== event.description && (
                  <p className="mt-4 text-sm font-medium text-white/25 italic">{event.summary}</p>
                )}
              </motion.section>
            )}

            {/* Artist Lineup */}
            {event?.artists?.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="rounded-[40px] border border-white/10 bg-white/[0.02] p-10"
              >
                <SectionLabel>Lineup</SectionLabel>
                <div className="flex flex-wrap gap-3">
                  {event.artists.map((name, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 hover:border-white/20 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-white/60 shrink-0">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold uppercase tracking-wider text-white/70">
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Schedule Timeline */}
            {scheduleEntries.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-[40px] border border-white/10 bg-white/[0.02] p-10"
              >
                <SectionLabel>Schedule</SectionLabel>
                <div className="space-y-0">
                  {scheduleEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-5 py-4 border-b border-white/5 last:border-0"
                    >
                      <div className="h-2 w-2 rounded-full bg-orange shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 w-28 shrink-0">
                        {entry.label}
                      </p>
                      <p className="font-mono text-base text-white">{entry.time}</p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Vibe & Genre Tags */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="rounded-[40px] border border-white/10 bg-orange p-10 text-black"
            >
              <p className="mb-6 text-[10px] font-black uppercase tracking-[0.4em] text-black/40">
                Vibe
              </p>
              <div className="flex flex-wrap gap-2">
                {(vibeTags.length > 0 ? vibeTags : ['Intimate', 'Underground', 'High-Energy']).map(
                  (tag) => (
                    <span
                      key={tag}
                      className="px-4 py-2 rounded-xl bg-black/5 border border-black/10 text-[10px] font-black uppercase tracking-widest"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </motion.section>

            {/* Guestlist Preview */}
            {interestedUsers.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="rounded-[40px] border border-white/10 bg-black/40 p-10"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <SectionLabel>Guestlist</SectionLabel>
                    <h3 className="text-2xl font-display uppercase text-white -mt-4">
                      Who's Going
                    </h3>
                  </div>
                  <button
                    onClick={() => setGuestModalOpen(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                  >
                    View All
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {interestedUsers.slice(0, 6).map((guest) => (
                    <div
                      key={guest.id}
                      className="flex items-center gap-3 p-4 rounded-3xl border border-white/[0.05] bg-white/[0.02]"
                    >
                      <div
                        className="h-10 w-10 rounded-full shrink-0 overflow-hidden border border-white/10 flex items-center justify-center text-[10px] font-black text-black/70"
                        style={{ backgroundColor: guest.color }}
                      >
                        {guest.photoURL && guest.photoURL !== 'placeholder' ? (
                          <Image
                            src={guest.photoURL}
                            alt={guest.name}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          guest.initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white/60 truncate">{guest.name}</p>
                        <p className="text-[8px] uppercase tracking-widest text-white/20">
                          Verified
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Location & Map */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="rounded-[40px] border border-white/10 bg-white/[0.02] p-10"
            >
              <SectionLabel>Location</SectionLabel>
              <p className="text-3xl font-display uppercase tracking-tighter text-white leading-tight mb-2">
                {event?.location || event?.venue || 'TBA'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {event?.city && (
                  <span className="text-[10px] font-bold text-orange uppercase tracking-[0.15em]">
                    {event.city}
                  </span>
                )}
                {event?.ageLimit && (
                  <span className="text-[9px] font-black border border-white/10 px-2.5 py-1 rounded-md bg-white/5 text-white/50">
                    {event.ageLimit}
                  </span>
                )}
                {!event?.ageLimit && event?.ageRestriction && (
                  <span className="text-[9px] font-black border border-white/10 px-2.5 py-1 rounded-md bg-white/5 text-white/50">
                    {event.ageRestriction}
                  </span>
                )}
                {event?.dressCode && (
                  <span className="text-[9px] font-black border border-white/10 px-2.5 py-1 rounded-md bg-white/5 text-white/50">
                    DRESS: {event.dressCode.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-[24px] border border-white/10 h-52 pointer-events-none">
                <iframe
                  src={mapSrc}
                  className="w-full h-full grayscale opacity-60"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Event location"
                />
              </div>
              <div className="flex items-start justify-between mt-5 gap-4">
                {event?.mapsLink ? (
                  <a
                    href={event.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-black uppercase tracking-widest text-orange hover:opacity-75 transition-opacity"
                  >
                    Get Directions →
                  </a>
                ) : (
                  <span />
                )}
                {event?.arrivalInstructions && (
                  <p className="text-[11px] text-white/30 max-w-xs text-right leading-relaxed">
                    {event.arrivalInstructions}
                  </p>
                )}
              </div>
            </motion.section>
          </div>

          {/* ── Right sidebar: Ticket Tiers ── */}
          <aside>
            <div className="sticky top-6 rounded-[48px] border border-white/10 bg-black/70 p-8 shadow-2xl backdrop-blur-3xl">
              <h3 className="text-2xl font-display uppercase text-white mb-1">Tickets</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/25 mb-8">
                Select your access tier
              </p>

              <div className="space-y-3">
                {tickets.map((ticket, i) => {
                  const style = getTierStyle(ticket);
                  const qty = Number(ticket.quantity ?? 150);
                  const maxQty = Number(ticket.maxQuantity || ticket.capacity || 300);
                  const stockPct = maxQty > 0 ? Math.min(100, Math.round((qty / maxQty) * 100)) : 0;

                  return (
                    <button
                      key={i}
                      onClick={() => setTicketModalOpen(true)}
                      disabled={qty <= 0}
                      className={`w-full text-left group relative rounded-[28px] border ${style.border} ${style.shadow} bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.05] disabled:cursor-not-allowed overflow-hidden`}
                    >
                      {/* Top row: badges + price */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {style.badge && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${style.badgeStyle}`}
                            >
                              <BadgeIcon type={style.badgeIcon} />
                              {style.badge}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${style.avail.chip}`}
                          >
                            {style.avail.label}
                          </span>
                        </div>
                        <p
                          className={`text-2xl font-display tracking-tighter shrink-0 group-hover:scale-105 transition-transform ${style.priceColor}`}
                        >
                          {Number(ticket.price) === 0
                            ? 'Free'
                            : `₹${Number(ticket.price).toLocaleString('en-IN')}`}
                        </p>
                      </div>

                      {/* Tier name */}
                      <p className="text-sm font-black uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">
                        {ticket.name}
                      </p>

                      {/* Description snippet */}
                      {ticket.description && (
                        <p className="mt-1 text-[11px] text-white/25 line-clamp-1">
                          {ticket.description}
                        </p>
                      )}

                      {/* Stock bar */}
                      {qty > 0 && maxQty > 0 && (
                        <div className="mt-4 h-[2px] rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-white/25 transition-all duration-1000"
                            style={{ width: `${stockPct}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setTicketModalOpen(true)}
                disabled={isPreview}
                className="mt-8 w-full rounded-full bg-white py-5 text-[11px] font-black uppercase tracking-[0.5em] text-black hover:scale-[1.03] transition-all disabled:opacity-40"
              >
                Confirm Access
              </button>

              {/* Host info */}
              {host && (
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3">
                  {host.avatar && (
                    <Image
                      src={host.avatar}
                      alt={host.name || ''}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                  )}
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/20">
                      Hosted by
                    </p>
                    <p className="text-sm font-bold text-white/55">{host.name}</p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Modals */}
      <GuestlistModal
        open={guestModalOpen}
        guests={interestedUsers}
        onClose={() => setGuestModalOpen(false)}
        title="Guestlist"
        isPreview={isPreview}
      />
      <TicketModal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        tickets={tickets}
        eventId={event?.id}
        isPreview={isPreview}
        minTicketsPerOrder={event?.minTicketsPerOrder || 1}
        maxTicketsPerOrder={event?.maxTicketsPerOrder || 10}
        onPurchase={(data) => handleAction('BOOK', data)}
      />

      {/* ━━━ ZONE 3: STICKY BOTTOM BAR ━━━ */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6"
      >
        <div className="flex w-full max-w-2xl items-center justify-between gap-4 rounded-full border border-white/10 bg-black/80 px-6 py-4 shadow-2xl backdrop-blur-3xl">
          <div className="hidden sm:block">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/25 mb-0.5">
              From
            </p>
            <p className="text-xl font-display text-white">
              {isFree ? 'Free' : `₹${(startingPrice || 0).toLocaleString('en-IN')}`}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-1 sm:flex-none justify-end">
            <button
              type="button"
              disabled={isPreview}
              onClick={() => handleAction('SHARE', { id: 'whatsapp' })}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
              title="Share on WhatsApp"
            >
              <WhatsappIcon />
            </button>
            <button
              type="button"
              disabled={isPreview}
              onClick={() => (isFree ? handleAction('RSVP') : setTicketModalOpen(true))}
              className="flex items-center justify-center gap-3 rounded-full bg-white px-10 py-4 text-[11px] font-black uppercase tracking-[0.5em] text-black hover:scale-105 transition-all disabled:opacity-40"
            >
              <span>{isFree ? 'Secure Spot' : 'Book Now'}</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
