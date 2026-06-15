'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import CtaLayer from './CtaLayer';
import { saveIntent } from '../../lib/utils/intentStore';
import { followHost, getHostFollowStatus, unfollowHost } from '../../features/social/api/socialApi';

/**
 * HostFollowCta — client component that owns follow state for a host profile.
 * Renders the stats row + CtaLayer with live follow toggle and optimistic count update.
 * Replaces the static stats block + bare <CtaLayer> in HostPublicPage (server component).
 */
export default function HostFollowCta({
  hostProfile,
  initialFollowersCount = 0,
  upcomingCount = 0,
  totalCount = 0,
}) {
  const { user } = useAuth() || {};
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [isLoading, setIsLoading] = useState(false);

  // Check current follow status on mount (client-side only — auth not available server-side)
  useEffect(() => {
    if (!user || !hostProfile?.id) return;
    getHostFollowStatus(hostProfile.id)
      .then(setIsFollowing)
      .catch(() => {});
  }, [user, hostProfile?.id]);

  const handleFollow = async () => {
    if (isLoading) return;
    if (!user) {
      saveIntent('FOLLOW_HOST', null, { targetId: hostProfile.id, targetType: 'host' });
      window.dispatchEvent(
        new CustomEvent('OPEN_AUTH_MODAL', { detail: { intent: 'FOLLOW_HOST' } }),
      );
      return;
    }

    // Optimistic update
    const newStatus = !isFollowing;
    setIsFollowing(newStatus);
    setFollowersCount((prev) => (newStatus ? prev + 1 : Math.max(0, prev - 1)));
    setIsLoading(true);

    try {
      if (newStatus) {
        await followHost(hostProfile.id);
      } else {
        await unfollowHost(hostProfile.id);
      }
    } catch {
      setIsFollowing(!newStatus);
      setFollowersCount((prev) => (!newStatus ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-12 w-full">
      {/* Stats Row */}
      <div className="flex gap-10 pt-4">
        <div className="text-center">
          <p className="text-3xl md:text-4xl font-black">
            {followersCount.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">
            Followers
          </p>
        </div>
        <div className="text-center">
          <p className="text-3xl md:text-4xl font-black">{upcomingCount}</p>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">
            Upcoming
          </p>
        </div>
        <div className="text-center">
          <p className="text-3xl md:text-4xl font-black">{totalCount}</p>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">
            Total Events
          </p>
        </div>
      </div>
      <CtaLayer venue={hostProfile} isFollowing={isFollowing} onFollow={handleFollow} />
    </div>
  );
}
