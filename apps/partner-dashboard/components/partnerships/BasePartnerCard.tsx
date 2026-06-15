'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Building2, UserCircle, Zap, Loader2 } from 'lucide-react';

export interface PartnerBaseInfo {
  id: string;
  type: 'host' | 'venue' | 'promoter';
  name: string;
  avatar?: string | null;
  isVerified?: boolean;
  eventsCount?: number;
  followersCount?: number;
  connectionStatus?: 'pending' | 'approved' | 'rejected' | 'blocked' | 'active' | null;
}

interface BasePartnerCardProps {
  partner: PartnerBaseInfo;
  onViewProfile: () => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  isActionLoading?: boolean;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
}

export function BasePartnerCard({
  partner,
  onViewProfile,
  onPrimaryAction,
  onSecondaryAction,
  isActionLoading,
  primaryActionLabel,
  secondaryActionLabel = 'Decline',
}: BasePartnerCardProps) {
  const isConnected =
    partner.connectionStatus === 'active' || partner.connectionStatus === 'approved';
  const isPending = partner.connectionStatus === 'pending';

  const defaultLabel = isConnected ? 'Connected' : isPending ? 'Pending' : 'Send Request';
  const label = primaryActionLabel || defaultLabel;

  const actionDisabled = onPrimaryAction ? isActionLoading || isConnected || isPending : false;

  const eventsLabel = compactNumber(partner.eventsCount || 0);
  const followersLabel = compactNumber(partner.followersCount || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#141417] shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onViewProfile}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onViewProfile();
          }
        }}
        className="relative block w-full aspect-[0.85] overflow-hidden text-left"
      >
        {partner.avatar ? (
          <img src={partner.avatar} alt={partner.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(255,96,55,0.35),transparent_35%),linear-gradient(160deg,#2b2f3a_0%,#1a1d24_38%,#0c0e12_100%)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black/25 text-[42px] font-black uppercase text-white/92 backdrop-blur-md">
              {partner.name?.slice(0, 1)}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.28)_50%,rgba(0,0,0,0.88)_100%)]" />
        <div className="absolute inset-[3px] rounded-[29px] border border-white/8 pointer-events-none" />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 top-3 rounded-[28px] shadow-[0_0_0_1px_rgba(83,150,255,0.55),0_0_28px_rgba(50,126,255,0.28),0_0_70px_rgba(48,174,255,0.18)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-5 right-5 top-5 flex items-start justify-between">
          <button
            type="button"
            onClick={onViewProfile}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/72 backdrop-blur-md transition-colors hover:text-white"
          >
            {partner.type}
          </button>
          {partner.isVerified && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/35 text-[#ff6438] backdrop-blur-md">
              <ShieldCheck className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="absolute inset-x-5 bottom-6 flex flex-col items-center text-center">
          <button type="button" onClick={onViewProfile} className="w-full">
            <h3 className="text-[22px] font-black uppercase tracking-tight text-white leading-[1.1]">
              {partner.name}
            </h3>
          </button>
          <div className="mt-2.5 flex items-center justify-center gap-2 text-[15px] font-bold text-white/90">
            <span>{eventsLabel} events</span>
            <span className="text-white/28">|</span>
            <span>{followersLabel} followers</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className={`grid gap-2 ${onSecondaryAction ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (onPrimaryAction && !actionDisabled) {
                onPrimaryAction();
                return;
              }
              onViewProfile();
            }}
            className={`inline-flex w-full h-10 shrink-0 items-center justify-center rounded-xl px-5 text-[12px] font-black transition-all ${
              actionDisabled
                ? 'border border-white/10 bg-white/5 text-white/40'
                : 'bg-[#f1ecdf] text-black shadow-[0_8px_20px_rgba(241,236,223,0.15)] hover:-translate-y-0.5'
            }`}
          >
            {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
          </button>

          {onSecondaryAction ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSecondaryAction();
              }}
              disabled={isActionLoading}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-[11px] font-black text-white/72 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function compactNumber(value: number) {
  if (!value) return '0';
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
