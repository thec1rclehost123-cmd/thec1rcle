'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Medal,
  Star,
  MapPin,
  ChevronDown,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

interface LeaderboardEntry {
  promoterId: string;
  displayName: string;
  avatarUrl: string | null;
  xpScore: number;
  rank: number;
}

export default function LeaderboardPageClient() {
  const { user, profile } = useDashboardAuth();
  const promoterId = profile?.activeMembership?.partnerId;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('All');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [timeframe, setTimeframe] = useState('all_time');
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);

  useEffect(() => {
    if (!promoterId) return;

    const fetchLeaderboard = async () => {
      try {
        const token = await user?.getIdToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const params = new URLSearchParams();
        if (city !== 'All') params.append('city', city);
        if (timeframe !== 'all_time') params.append('timeframe', timeframe);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        const res = await fetch(`/api/v1/partners/promoters/leaderboard${queryString}`, {
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
          setCurrentUserRank(data.currentUserRank || null);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [promoterId, user, city, timeframe]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-c1rcle-orange border-t-transparent" />
      </div>
    );
  }

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const getPodiumStyles = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          height: 'h-72 md:h-80',
          gradient: 'bg-gradient-to-br from-yellow-400 to-amber-600',
          accent: 'text-yellow-400',
          delay: 0.1,
        };
      case 2:
        return {
          height: 'h-60 md:h-68',
          gradient: 'bg-gradient-to-br from-slate-300 to-slate-500',
          accent: 'text-slate-300',
          delay: 0.2,
        };
      case 3:
        return {
          height: 'h-52 md:h-60',
          gradient: 'bg-gradient-to-br from-amber-700 to-amber-900',
          accent: 'text-amber-600',
          delay: 0.3,
        };
      default:
        return { height: 'h-0', gradient: '', accent: '', delay: 0 };
    }
  };

  // Reorder top 3 for visual podium: [2, 1, 3]
  const visualPodium = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="min-h-screen relative px-4 pt-0 pb-32 md:px-8">
      <style>{`
                @keyframes swing {
                    0%, 100% { transform: rotate(-5deg); }
                    50% { transform: rotate(5deg); }
                }
                .animate-swing {
                    animation: swing 6s ease-in-out infinite;
                    transform-origin: top center;
                }
            `}</style>

      {/* Clean Dark Background Effects - Constrained to Leaderboard Frame */}
      <div className="absolute -top-6 bottom-0 -left-4 -right-4 md:-top-8 md:-left-8 md:-right-8 pointer-events-none z-0 bg-[#0a0a0b] overflow-hidden">
        {/* Volumetric Stage Spotlights - Realistic & Static */}
        {/* Wide Left Red Spotlight */}
        <div className="absolute -top-10 -left-[10%] w-[60vw] h-[150vh] bg-gradient-to-b from-red-600/25 via-red-600/5 to-transparent blur-[120px] origin-top-left rotate-[35deg] mix-blend-screen pointer-events-none" />

        {/* Wide Right Blue Spotlight */}
        <div
          className="absolute -top-10 right-0 w-[80vw] h-[140vh] bg-gradient-to-b from-blue-600/25 via-blue-600/5 to-transparent blur-[100px] origin-top-right rotate-[-25deg] mix-blend-screen pointer-events-none"
          style={{ clipPath: 'polygon(70% 0, 100% 0, 100% 100%, 0% 100%)' }}
        />

        {/* Massive Atmospheric Disco Ball Background */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex flex-col items-center z-0 opacity-30 mix-blend-screen pointer-events-none blur-[12px]">
          <div className="relative w-[300px] h-[300px] md:w-[600px] md:h-[600px]">
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] z-10" />
            <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 shadow-[0_0_80px_rgba(255,255,255,0.1)]">
              <div
                className="w-[200%] h-full animate-[spin-bg_60s_linear_infinite]"
                style={{
                  backgroundImage: `
                                    linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
                                    linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px),
                                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 40%),
                                    radial-gradient(circle at 70% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)
                                `,
                  backgroundSize: '20px 20px, 20px 20px, 100% 100%, 100% 100%',
                }}
              />
            </div>
          </div>
        </div>

        {/* Ambient Club Glow - Removed */}

        <StarryDust />
      </div>

      <div className="mx-auto max-w-4xl relative z-10">
        {/* Header */}
        <div className="mb-20 md:mb-24 -mt-6 text-center">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3 leading-none"
          >
            PROMOTER LEADERBOARD
          </motion.h1>

          <div className="flex justify-center gap-4">
            {/* Timeframe Dropdown */}
            <div className="relative">
              <button
                onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-text-primary hover:bg-surface-tertiary transition-all shadow-sm"
              >
                <Calendar className="w-4 h-4 text-c1rcle-orange" />
                <span className="font-semibold text-sm tracking-wide">
                  {timeframe === 'month'
                    ? 'This Month'
                    : timeframe === 'week'
                      ? 'This Week'
                      : 'All Time'}
                </span>
                <ChevronDown className="w-4 h-4 text-text-tertiary ml-2" />
              </button>

              {timeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTimeDropdownOpen(false)} />
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-40 bg-surface-elevated border border-border-subtle rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 py-1 overflow-hidden backdrop-blur-xl">
                    {[
                      { id: 'week', label: 'This Week' },
                      { id: 'month', label: 'This Month' },
                      { id: 'all_time', label: 'All Time' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTimeframe(t.id);
                          setTimeDropdownOpen(false);
                          setLoading(true);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors ${timeframe === t.id ? 'text-c1rcle-orange-light bg-c1rcle-orange/10' : 'text-text-secondary'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* City Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-text-primary hover:bg-surface-tertiary transition-all shadow-sm"
              >
                <MapPin className="w-4 h-4 text-c1rcle-orange" />
                <span className="font-semibold text-sm tracking-wide">
                  {city === 'All' ? 'Global (All Cities)' : city}
                </span>
                <ChevronDown className="w-4 h-4 text-text-tertiary ml-2" />
              </button>

              {cityDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCityDropdownOpen(false)} />
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 bg-surface-elevated border border-border-subtle rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 py-1 overflow-hidden backdrop-blur-xl">
                    {['All', 'Pune', 'Mumbai', 'Goa', 'Bengaluru'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCity(c);
                          setCityDropdownOpen(false);
                          setLoading(true);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors ${city === c ? 'text-c1rcle-orange-light bg-c1rcle-orange/10' : 'text-text-secondary'}`}
                      >
                        {c === 'All' ? 'Global (All Cities)' : c}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Podium */}
        {visualPodium.length > 0 && (
          <div className="mb-16 flex items-end justify-center gap-4 md:gap-8 relative z-10">
            {visualPodium.map((promoter, i) => {
              const styles = getPodiumStyles(promoter.rank);
              const isFirst = promoter.rank === 1;

              return (
                <motion.div
                  key={promoter.promoterId}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: styles.delay, type: 'spring', stiffness: 100 }}
                  className={`flex flex-col items-center relative w-28 md:w-48 group z-10 ${styles.height}`}
                >
                  {/* Geometric Card Background */}
                  <div
                    className="absolute inset-0 w-full h-full bg-[#1a1a1a] shadow-2xl"
                    style={{ clipPath: 'polygon(0 8%, 100% 0, 100% 100%, 0% 100%)' }}
                  >
                    {/* Colored Header Area inside card */}
                    <div
                      className={`absolute top-0 w-full h-1/2 ${styles.gradient} opacity-80`}
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 85%)' }}
                    />
                  </div>

                  {/* Avatar (Breaking Out) */}
                  <div className="relative z-10 -mt-6 md:-mt-10">
                    <div
                      className={`h-20 w-20 md:h-28 md:w-28 overflow-hidden rounded-full border-4 border-[#1a1a1a] shadow-xl bg-surface-elevated`}
                    >
                      {promoter.avatarUrl ? (
                        <img
                          src={promoter.avatarUrl}
                          alt={promoter.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-surface-tertiary font-black text-3xl text-text-tertiary">
                          {promoter.displayName.charAt(0)}
                        </div>
                      )}
                    </div>
                    {/* Rank Badge */}
                    <div
                      className={`absolute -bottom-1 -right-1 flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full text-lg md:text-xl font-black bg-black border-2 border-[#1a1a1a] ${styles.accent} z-20 shadow-lg`}
                    >
                      {promoter.rank}
                    </div>
                    {/* Crown for #1 */}
                    {isFirst && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                        <Trophy className="h-8 w-8" fill="currentColor" />
                      </div>
                    )}
                  </div>

                  {/* Content inside card */}
                  <div className="relative z-10 w-full px-2 pt-6 pb-4 text-center mt-auto">
                    <h3
                      className={`font-black uppercase tracking-tighter truncate w-full mb-4 ${isFirst ? 'text-lg md:text-2xl text-white' : 'text-base md:text-xl text-white/90'}`}
                    >
                      {promoter.displayName.split(' ').length > 1
                        ? `${promoter.displayName.split(' ')[0]} ${promoter.displayName.split(' ')[promoter.displayName.split(' ').length - 1].charAt(0)}.`
                        : promoter.displayName}
                    </h3>

                    {/* 2-Column Stats Grid */}
                    <div className="flex justify-between items-end border-t border-white/10 pt-3 px-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] md:text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">
                          Tickets
                        </span>
                        <span className="text-xl md:text-2xl font-black text-white tracking-tighter">
                          {Math.floor(promoter.xpScore * 0.45) + (10 - (i % 10))}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] md:text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">
                          XP
                        </span>
                        <span
                          className={`text-xl md:text-3xl font-black tracking-tighter ${styles.accent}`}
                        >
                          {promoter.xpScore > 9999
                            ? (promoter.xpScore / 1000).toFixed(1) + 'k'
                            : promoter.xpScore.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* List View */}
        <div className="space-y-4 px-2 md:px-0">
          {rest.map((promoter, i) => {
            // Ligue 2 style distinct colors
            const colors = [
              'from-red-600 to-rose-700 text-red-50', // 4th
              'from-purple-700 to-violet-900 text-purple-50', // 5th
              'from-blue-600 to-indigo-800 text-blue-50', // 6th
              'from-[#1a1a1a] to-[#222] text-slate-300 border border-white/5', // 7th+
            ];
            const bgGradient = i < 3 ? colors[i] : colors[3];

            return (
              <motion.div
                key={promoter.promoterId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className={`relative flex items-center h-16 md:h-20 bg-gradient-to-r ${bgGradient} shadow-md ${promoter.promoterId === promoterId ? 'ring-2 ring-c1rcle-orange' : ''}`}
              >
                {/* Massive Rank Number on left */}
                <div className="absolute left-0 top-0 bottom-0 w-16 md:w-20 flex flex-col justify-center items-center border-r border-white/10 bg-black/30">
                  <span className="text-2xl md:text-4xl font-black tracking-tighter opacity-90">
                    {promoter.rank}
                  </span>
                </div>

                {/* Avatar breaking boundaries */}
                <div className="absolute left-[72px] md:left-[92px] -top-2 -bottom-2 flex items-center z-10">
                  <div className="h-[60px] w-[60px] md:h-20 md:w-20 rounded-full border-[3px] border-white/20 shadow-xl overflow-hidden bg-black/50 backdrop-blur-md">
                    {promoter.avatarUrl ? (
                      <img
                        src={promoter.avatarUrl}
                        alt={promoter.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-black text-xl md:text-2xl text-white/50">
                        {promoter.displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Name & Badges */}
                <div className="pl-[140px] md:pl-[180px] flex flex-col justify-center flex-1 h-full z-10 py-2">
                  <span
                    className={`font-black uppercase tracking-tighter text-lg md:text-2xl truncate ${promoter.promoterId === promoterId ? 'text-c1rcle-orange-light' : 'text-white'}`}
                  >
                    {promoter.displayName}
                  </span>
                  <span className="text-[9px] md:text-[10px] font-bold opacity-60 tracking-widest uppercase">
                    PROMOTER {promoter.promoterId === promoterId && ' (YOU)'}
                  </span>
                </div>

                {/* XP Score on right */}
                <div className="pr-4 md:pr-6 flex flex-col items-end justify-center h-full border-l border-white/10 bg-black/30 px-3 md:px-6">
                  <span className="text-xl md:text-3xl font-black tracking-tighter">
                    {promoter.xpScore > 9999
                      ? (promoter.xpScore / 1000).toFixed(1) + 'k'
                      : promoter.xpScore.toLocaleString()}
                  </span>
                  <span className="text-[8px] md:text-[9px] uppercase tracking-widest font-bold opacity-60 mt-1">
                    XP Score
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Sticky "Your Rank" if outside Top 20 */}
        {currentUserRank && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 z-50 md:w-96 rounded-2xl border border-c1rcle-orange/50 bg-[rgba(20,20,25,0.95)] px-6 py-4 shadow-[0_10px_40px_rgba(244,74,34,0.2)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-c1rcle-orange/20 text-xl font-black text-c1rcle-orange-light">
                  {currentUserRank.rank}
                </div>
                <div>
                  <p className="text-xs font-semibold text-c1rcle-orange/80 uppercase tracking-wider">
                    Your Rank
                  </p>
                  <p className="font-bold text-white">
                    {currentUserRank.xpScore.toLocaleString()} XP
                  </p>
                </div>
              </div>
              <Trophy className="h-8 w-8 text-white/10" />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function TicketIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

function StarryDust() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  if (!isClient) return null;

  // Create a starry dust effect matching the reference
  const dustParticles = Array.from({ length: 60 }).map((_, i) => {
    const style = {
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      opacity: Math.random() * 0.4 + 0.1, // Subtle opacity
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${10 + Math.random() * 10}s`, // Very slow float
    };
    // Very small dots, mostly 1px, some 2px
    const size = Math.random() > 0.8 ? 'w-1 h-1' : 'w-[2px] h-[2px]';
    return (
      <div
        key={i}
        className={`absolute ${size} bg-white rounded-full animate-float blur-[0.5px] drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]`}
        style={style}
      />
    );
  });

  return <div className="absolute inset-0 z-10 pointer-events-none">{dustParticles}</div>;
}
