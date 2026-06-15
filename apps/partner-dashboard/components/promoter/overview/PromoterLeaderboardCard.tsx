'use client';

import { Trophy } from 'lucide-react';

export function PromoterLeaderboardCard({ position }: { position?: any }) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 flex flex-col min-h-[400px]">
      <h3 className="font-semibold text-text-primary text-sm tracking-wide mb-4 uppercase">
        Leaderboard
      </h3>
      <div className="flex-1 flex border-border-subtle border-dashed border-2 rounded-xl flex-col items-center justify-center text-center p-6 bg-surface-base/50">
        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-500 ring-4 ring-surface-base">
          <Trophy className="h-7 w-7" />
        </div>

        {position ? (
          <>
            <p className="text-text-secondary text-sm font-medium mb-1">CITY RANK</p>
            <div className="text-5xl font-black tabular-nums tracking-tighter text-text-primary">
              #{position.rank ?? '—'}
            </div>
            <p className="text-sm text-text-tertiary mt-3">
              Top {position.percentile ?? '—'}% of promoters
            </p>
          </>
        ) : (
          <>
            <h4 className="text-text-primary font-bold mb-1">Unranked</h4>
            <p className="text-sm text-text-tertiary">
              Close your first sale to enter the leaderboard.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
