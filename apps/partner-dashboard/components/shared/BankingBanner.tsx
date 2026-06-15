'use client';

import { Landmark, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

const PARTNER_PATHS: Record<string, string> = {
  venue: '/venue/finance/payouts',
  host: '/host/finance/payouts',
  promoter: '/promoter/payouts',
};

export function BankingBanner() {
  const { isApproved, profile } = useDashboardAuth();
  const partnerType = (profile?.activeMembership as any)?.type as string | undefined;

  if (!isApproved || !partnerType) return null;

  const targetPath = PARTNER_PATHS[partnerType];
  if (!targetPath) return null;

  // NOTE: This banner is a static reminder. The backend controls whether
  // bank account setup is complete. Once the partner sets up banking via
  // the sidebar Payout Settings page, this banner will no longer show
  // (the parent page should conditionally render it based on account status).

  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 xl:mx-10 mt-4 mb-0 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 flex items-center gap-4">
      <Landmark className="h-5 w-5 flex-shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold tracking-tight leading-snug text-amber-300">
          Set up your payout bank account
        </p>
        <p className="text-[11px] opacity-70 leading-snug mt-0.5 hidden sm:block text-amber-300/70">
          Add a bank account to receive payouts from your events.
        </p>
      </div>
      <Link
        href={targetPath}
        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest whitespace-nowrap text-amber-400 hover:text-amber-300 transition-colors"
      >
        Go to Payout Settings
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
