'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Link as LinkIcon, DollarSign, Users } from 'lucide-react';
import Link from 'next/link';
import { PromoterLinksPanel } from './PromoterLinksPanel';
import { PromoterSalesPanel } from './PromoterSalesPanel';
import { PromoterGuestListPanel } from './PromoterGuestListPanel';

import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

export function PromoterAssignmentDetailClient({ assignmentId }: { assignmentId: string }) {
  const [activeTab, setActiveTab] = useState<'links' | 'sales' | 'guests'>('links');
  const { user } = useDashboardAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['promoter', 'event', assignmentId],
    queryFn: async () => {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/partners/promoters/events/${assignmentId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Failed to fetch event detail');
      return res.json();
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-6 animate-pulse">
        <div className="flex items-center gap-4 py-6 border-b border-border-subtle mb-6">
          <div className="h-10 w-10 bg-surface-tertiary rounded-xl"></div>
          <div className="flex flex-col gap-2">
            <div className="h-8 w-64 bg-surface-tertiary rounded-md"></div>
            <div className="h-4 w-48 bg-surface-tertiary rounded-md"></div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-b border-border-subtle pb-0 mb-6 w-full">
          <div className="h-10 w-24 bg-surface-tertiary rounded-t-lg mx-2"></div>
          <div className="h-10 w-24 bg-surface-tertiary rounded-t-lg mx-2"></div>
          <div className="h-10 w-24 bg-surface-tertiary rounded-t-lg mx-2"></div>
        </div>
        <div className="h-96 w-full bg-surface-elevated rounded-2xl border border-border-subtle"></div>
      </div>
    );
  }

  if (error || !data?.assignment) {
    return (
      <div className="w-full flex justify-center py-20 p-8 border border-red-500/20 rounded-2xl bg-red-500/5 mt-4">
        <div className="text-center text-red-500">
          <p className="font-bold mb-1">Failed to Load</p>
          <p className="text-sm opacity-80">We couldn't find this assignment workspace.</p>
        </div>
      </div>
    );
  }

  const { assignment } = data;

  return (
    <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header / Sub-nav Area */}
      <div className="flex items-center gap-4 py-6 border-b border-border-subtle bg-background/80 backdrop-blur-xl sticky top-0 z-20 w-full mb-6">
        <Link
          href="/promoter/events"
          className="p-2 border border-border-subtle hover:bg-surface-elevated rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-text-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-xs text-text-primary tracking-tight font-bold">
              {assignment.event?.name ?? 'Unnamed Event'}
            </h1>
            <span className="inline-flex items-center bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
              {assignment.status}
            </span>
          </div>
          <p className="text-text-tertiary text-sm mt-0.5 font-medium flex items-center">
            {assignment.event?.date
              ? new Date(assignment.event.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}{' '}
            • {assignment.event?.venue ?? '—'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-border-subtle pb-0 custom-scrollbar overflow-x-auto w-full mb-6">
        <button
          onClick={() => setActiveTab('links')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide uppercase transition-all whitespace-nowrap border-b-2 ${
            activeTab === 'links'
              ? 'text-emerald-500 border-emerald-500'
              : 'text-text-secondary border-transparent hover:text-text-primary'
          }`}
        >
          <LinkIcon className="h-4 w-4" />
          Links
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide uppercase transition-all whitespace-nowrap border-b-2 ${
            activeTab === 'sales'
              ? 'text-emerald-500 border-emerald-500'
              : 'text-text-secondary border-transparent hover:text-text-primary'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Sales
        </button>
        {(assignment.guestlist?.allowance ?? 0) > 0 && (
          <button
            onClick={() => setActiveTab('guests')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide uppercase transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'guests'
                ? 'text-emerald-500 border-emerald-500'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            <Users className="h-4 w-4" />
            Guest List
          </button>
        )}
      </div>

      {/* Panel Rendering Content */}
      <div className="w-full">
        {activeTab === 'links' && <PromoterLinksPanel links={assignment.links} />}
        {activeTab === 'sales' && (
          <PromoterSalesPanel stats={assignment.stats} commissionRate={assignment.commissionRate} />
        )}
        {activeTab === 'guests' && <PromoterGuestListPanel guestlist={assignment.guestlist} />}
      </div>
    </div>
  );
}
