'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchPublicHost } from '../../../features/discovery/publicDiscovery';
import { guestApiFetch } from '../../../lib/api/client';
import { useAuth } from '../../../components/providers/AuthProvider';
import {
  CheckCircle2,
  MapPin,
  ExternalLink,
  Instagram,
  Music,
  Play,
  ChevronRight,
} from 'lucide-react';
import { ShimmerImage } from '@c1rcle/ui';
import ProfileClient from '../../venue/[slug]/ProfileClient';
import HostFollowCta from '../../../components/profile/HostFollowCta';

function normalizeEventCard(event) {
  return {
    ...event,
    name: event.name || event.title,
    coverImage: event.coverImage || event.image || event.posterUrl,
    startDate: event.startDate || event.startAt,
  };
}

export default function HostPublicPageClient({ initialData = null, initialSlug = '' }) {
  const params = useParams();
  const slug = decodeURIComponent(String(params?.slug || initialSlug || ''));
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState(initialData?.host ? 'ready' : 'loading');
  const { user } = useAuth() || {};

  const hostId = data?.host?.id;

  useEffect(() => {
    if (status === 'ready' && hostId) {
      let visitorId = user?.uid;
      if (!visitorId && typeof window !== 'undefined') {
        visitorId = window.localStorage.getItem('c1rcle:visitor-session-id');
        if (!visitorId) {
          visitorId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          window.localStorage.setItem('c1rcle:visitor-session-id', visitorId);
        }
      }

      if (visitorId) {
        guestApiFetch('/analytics/host-click', {
          method: 'POST',
          body: { hostId, visitorId },
        }).catch((err) => console.error('[Analytics] Failed to track host click', err));
      }
    }
  }, [status, hostId, user?.uid]);

  useEffect(() => {
    let cancelled = false;

    if (initialData?.host && slug === initialSlug) {
      setData(initialData);
      setStatus('ready');
      return () => {
        cancelled = true;
      };
    }

    async function loadHost() {
      setStatus('loading');
      try {
        const nextData = await fetchPublicHost(slug);
        if (cancelled) return;
        setData(nextData);
        setStatus(nextData?.host ? 'ready' : 'missing');
      } catch (error) {
        if (!cancelled) {
          console.error('[HostPublicPage] Failed to load host', error);
          setStatus('error');
        }
      }
    }

    if (slug) {
      loadHost();
    } else {
      setStatus('missing');
    }

    return () => {
      cancelled = true;
    };
  }, [slug, initialData, initialSlug]);

  const host = data?.host || null;
  const posts = data?.posts || [];
  const highlights = data?.highlights || [];
  const stats = data?.stats || {};
  const upcomingEvents = useMemo(
    () => (data?.upcomingEvents || []).map(normalizeEventCard),
    [data],
  );
  const pastEvents = useMemo(
    () => (data?.pastEvents || []).map(normalizeEventCard).slice(0, 6),
    [data],
  );
  const hostProfile = useMemo(() => {
    if (!host) return null;
    return {
      ...host,
      photoURL: host.avatar || host.photoURL,
      coverURL: host.cover || host.coverURL,
      description: host.bio,
      genres: host.genres || [],
      styleTags: host.styleTags || [],
      videos: host.videos || [],
    };
  }, [host]);

  if (status === 'loading') {
    return <div className="min-h-screen animate-pulse bg-[#0A0A0A]" />;
  }

  if (status !== 'ready' || !hostProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6 text-center text-white">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">
            Host unavailable
          </p>
          <h1 className="mt-4 text-3xl font-black uppercase tracking-tight">
            We could not load this host profile.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white selection:bg-white selection:text-black">
      <div className="relative min-h-[70vh] w-full overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={hostProfile.coverURL || '/events/neon-nights.jpg'}
            alt={hostProfile.name || hostProfile.displayName || 'Host'}
            fill
            priority
            className="scale-105 object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/40 via-[#0A0A0A]/60 to-[#0A0A0A]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 via-transparent to-[#0A0A0A]/80" />
        </div>

        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 flex h-full items-end pb-16 pt-32">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-12 lg:px-24">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-12">
              <div className="relative flex-shrink-0">
                <div className="relative h-36 w-36 overflow-hidden rounded-3xl border-2 border-white/20 bg-black/40 shadow-2xl backdrop-blur-xl lg:h-48 lg:w-48">
                  <ShimmerImage
                    src={hostProfile.photoURL || '/events/holi-edit.svg'}
                    alt={hostProfile.name || hostProfile.displayName || 'Host'}
                    fill
                    className="object-cover"
                  />
                </div>
                {hostProfile.verified ? (
                  <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg">
                    <CheckCircle2 className="h-6 w-6 text-black" />
                  </div>
                ) : null}
              </div>

              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  {hostProfile.role ? (
                    <span className="rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">
                      {hostProfile.role}
                    </span>
                  ) : null}
                  {hostProfile.genres?.slice(0, 3)?.map((genre, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-orange/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange"
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-black uppercase tracking-tighter leading-[0.9] sm:text-5xl md:text-7xl lg:text-8xl">
                    {hostProfile.name || hostProfile.displayName}
                  </h1>
                  {hostProfile.tagline ? (
                    <p className="max-w-2xl text-xl font-medium text-white/50 md:text-2xl">
                      {hostProfile.tagline}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm font-bold uppercase tracking-widest text-white/50 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {hostProfile.neighborhood
                      ? `${hostProfile.neighborhood}, ${hostProfile.city}`
                      : hostProfile.city || hostProfile.location || 'India'}
                  </div>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="text-white/30">@{hostProfile.slug || slug}</span>
                </div>

                <HostFollowCta
                  hostProfile={hostProfile}
                  initialFollowersCount={stats.followersCount || 0}
                  upcomingCount={upcomingEvents.length}
                  totalCount={upcomingEvents.length + pastEvents.length}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {hostProfile.bio ? (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-12 lg:px-24">
            <p className="text-lg font-medium leading-relaxed text-white/70 md:text-xl">
              {hostProfile.bio}
            </p>
          </div>
        </section>
      ) : null}

      {hostProfile.styleTags?.length > 0 ? (
        <section className="pb-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12 lg:px-24">
            <div className="flex flex-wrap gap-3">
              {hostProfile.styleTags.map((tag, index) => (
                <span
                  key={index}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {upcomingEvents.length > 0 ? (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12 lg:px-24">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
                  Upcoming Events
                </h2>
                <p className="mt-2 text-sm font-medium text-white/40">Don't miss what's next</p>
              </div>
              <Link
                href="/explore"
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/40 transition-colors hover:text-white"
              >
                View All <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.slice(0, 6).map((event) => (
                <Link key={event.id} href={`/event/${event.id}`} className="group">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20">
                    <ShimmerImage
                      src={event.image || event.coverImage || '/events/neon-nights.jpg'}
                      alt={event.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-orange px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                          {new Intl.DateTimeFormat('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            timeZone: 'Asia/Kolkata',
                          }).format(new Date(event.startDate || event.startAt))}
                        </span>
                      </div>
                      <h3 className="mb-1 line-clamp-2 text-xl font-bold text-white">
                        {event.name}
                      </h3>
                      <p className="text-sm font-medium text-white/50">
                        {event.venueName || 'Venue TBA'}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hostProfile.videos?.length > 0 ? (
        <section className="border-t border-white/5 bg-white/[0.02] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12 lg:px-24">
            <div className="mb-10">
              <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
                Videos & Recaps
              </h2>
              <p className="mt-2 text-sm font-medium text-white/40">Aftermovies and performances</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hostProfile.videos.map((video, index) => (
                <a
                  key={index}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20">
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange/20 to-purple-600/20">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform group-hover:scale-110">
                        <Play className="ml-1 h-8 w-8 text-white" />
                      </div>
                    </div>
                    <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/80 backdrop-blur-sm">
                      {video.type}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-4">
                      <h4 className="text-sm font-bold text-white">{video.title}</h4>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <ProfileClient
        upcomingEvents={upcomingEvents}
        posts={posts}
        highlights={highlights}
        venue={hostProfile}
      />

      {pastEvents.length > 0 ? (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12 lg:px-24">
            <div className="mb-10">
              <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
                Past Events
              </h2>
              <p className="mt-2 text-sm font-medium text-white/40">
                A look back at previous experiences
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {pastEvents.map((event) => (
                <Link key={event.id} href={`/event/${event.id}`} className="group">
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    <ShimmerImage
                      src={event.image || event.coverImage || '/events/neon-nights.jpg'}
                      alt={event.name}
                      fill
                      className="object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                    />
                    <div className="absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/20" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12 lg:px-24">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {hostProfile.socialLinks?.instagram ? (
              <a
                href={`https://instagram.com/${hostProfile.socialLinks.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
              >
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            ) : null}
            {hostProfile.socialLinks?.soundcloud ? (
              <a
                href={hostProfile.socialLinks.soundcloud}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
              >
                <Music className="h-4 w-4" /> SoundCloud
              </a>
            ) : null}
            {hostProfile.website ? (
              <a
                href={hostProfile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" /> Website
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
