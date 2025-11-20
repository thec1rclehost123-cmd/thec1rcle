"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import EventGrid from "../../components/EventGrid";
import { useAuth } from "../../components/providers/AuthProvider";
import { fetchEventsByIds } from "../../lib/firebase/eventsClient";

const StatPill = ({ label, value }) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-center">
    <p className="text-xs uppercase tracking-[0.4em] text-white/40">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
  </div>
);

export default function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const [likedEvents, setLikedEvents] = useState([]);
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const likedKey = useMemo(() => (profile?.likedEvents || []).join("|"), [profile?.likedEvents]);
  const attendingKey = useMemo(() => (profile?.attendedEvents || []).join("|"), [profile?.attendedEvents]);

  useEffect(() => {
    if (!profile?.uid) {
      setLikedEvents([]);
      setAttendingEvents([]);
      return;
    }
    let mounted = true;
    const load = async () => {
      setFetching(true);
      setFetchError("");
      try {
        const [liked, attending] = await Promise.all([
          fetchEventsByIds(profile?.likedEvents || []),
          fetchEventsByIds(profile?.attendedEvents || [])
        ]);
        if (mounted) {
          setLikedEvents(liked);
          setAttendingEvents(attending);
        }
      } catch (error) {
        if (mounted) setFetchError(error?.message || "Unable to load your events.");
      } finally {
        if (mounted) setFetching(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [profile?.uid, likedKey, attendingKey]);

  if (loading) {
    return (
      <section className="px-4 pb-32 pt-12 text-center sm:px-6">
        <p className="text-sm text-white/70">Loading your profile...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="px-4 pb-32 pt-12 text-center sm:px-6">
        <div className="mx-auto max-w-xl space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-white/40">Account</p>
          <h1 className="text-4xl font-display uppercase tracking-[0.3em]">Login Required</h1>
          <p className="text-white/60">Sign in to manage RSVPs, view liked events, and personalize your drop preferences.</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/login" className="rounded-full bg-white px-6 py-3 text-xs uppercase tracking-[0.35em] text-black">
              Login
            </Link>
            <Link
              href="/explore"
              className="rounded-full border border-white/30 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white/80"
            >
              Browse
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const displayName = profile?.displayName || user.email?.split("@")[0] || "Member";
  const initials = displayName
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="px-4 pb-24 pt-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="glass-panel rounded-[40px] border border-white/10 bg-black/60 p-8 text-white shadow-glow">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-white/10 to-white/5 text-2xl font-semibold uppercase">
              {profile?.photoURL ? (
                <Image src={profile.photoURL} alt={displayName} fill className="object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 space-y-2 text-left">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Member</p>
              <h1 className="text-4xl font-display uppercase tracking-[0.2em]">{displayName}</h1>
              <p className="text-white/60">{user.email}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/explore"
                className="rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white/80 hover:text-white"
              >
                Explore
              </Link>
              <Link
                href="/create"
                className="rounded-full bg-white px-6 py-3 text-xs uppercase tracking-[0.35em] text-black"
              >
                Create Event
              </Link>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatPill label="Liked Events" value={profile?.likedEvents?.length || 0} />
            <StatPill label="RSVPs" value={profile?.attendedEvents?.length || 0} />
            <StatPill label="Status" value="Active" />
          </div>
        </div>

        {fetchError && <p className="text-center text-sm text-red-300">{fetchError}</p>}
        {fetching && <p className="text-center text-sm text-white/70">Fetching your events...</p>}

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-heading uppercase tracking-[0.3em] text-white">RSVPs</h2>
              <Link href="/explore" className="text-xs uppercase tracking-[0.4em] text-white/60">
                Discover more
              </Link>
            </div>
            {attendingEvents.length ? (
              <div className="mt-6">
                <EventGrid events={attendingEvents} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/60">Save a spot on an event to see it here.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-heading uppercase tracking-[0.3em] text-white">Liked</h2>
              <Link href="/explore" className="text-xs uppercase tracking-[0.4em] text-white/60">
                Explore drops
              </Link>
            </div>
            {likedEvents.length ? (
              <div className="mt-6">
                <EventGrid events={likedEvents} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/60">Tap the heart on an event to curate your vibe.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
