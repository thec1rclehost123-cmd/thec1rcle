'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Search,
  Ticket,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenueActionButton, VenuePageShell } from '@/components/venue-layout/VenuePageShell';

import { OverviewResponse, GuestsResponse } from '@/components/promoter/overview/types';

type AnalyticsResponse = { timeline?: any[]; overview?: any; [key: string]: any };
const PROMOTER_OVERVIEW_STALE_MS = 5 * 60 * 1000;
import { OrderRow } from '@/components/promoter/overview/OrderRow';
import { UpcomingEventCard } from '@/components/promoter/overview/UpcomingEventCard';
import {
  formatINR,
  formatCompactINR,
  formatDateTime,
  formatEventDate,
  getInitials,
  getOrderStatusTone,
} from '@/components/promoter/overview/utils';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const LazyOverviewChart = dynamic(() => import('@/components/promoter/overview/OverviewChart'), {
  ssr: false,
  loading: () => (
    <section
      className="rounded-[28px] p-5 md:p-6 min-h-[400px] flex items-center justify-center"
      style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="w-8 h-8 border-4 border-t-[#f46a3a] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
    </section>
  ),
});

export default function PromoterDashboardHome() {
  const { profile, user } = useDashboardAuth();
  const promoterId = profile?.activeMembership?.partnerId;
  const shouldReduceMotion = useReducedMotion();

  const [metric, setMetric] = useState<'clicks' | 'revenue'>('clicks');
  const [range, setRange] = useState<'1d' | '1w' | '1m' | 'all'>('1m');
  const [orderSearch, setOrderSearch] = useState('');

  const overviewQuery = useQuery<OverviewResponse>({
    queryKey: ['promoter', 'overview', promoterId],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const res = await fetch('/api/partners/promoters/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load promoter overview');
      return res.json();
    },
    enabled: !!promoterId && !!user,
    staleTime: PROMOTER_OVERVIEW_STALE_MS,
    refetchOnMount: false,
  });

  const analyticsQuery = useQuery<AnalyticsResponse>({
    queryKey: ['promoter', 'analytics', promoterId, range],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const res = await fetch(`/api/partners/promoters/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load promoter analytics');
      return res.json();
    },
    enabled: !!promoterId && !!user,
    staleTime: PROMOTER_OVERVIEW_STALE_MS,
    refetchOnMount: false,
  });

  const guestsQuery = useQuery<GuestsResponse>({
    queryKey: ['promoter', 'guests', promoterId],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const res = await fetch(`/api/partners/promoters/guests?promoterId=${promoterId}&limit=6`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load promoter guests');
      return res.json();
    },
    enabled: !!promoterId && !!user,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
  });

  const assignments = overviewQuery.data?.activeAssignments || [];
  const guestOrders = guestsQuery.data?.guests || [];
  const analyticsTimeline = analyticsQuery.data?.timeline || [];
  const analyticsOverview = analyticsQuery.data?.overview || {};

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    if (!query) return guestOrders;
    return guestOrders.filter((order) =>
      [order.guestName, order.eventTitle, order.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [guestOrders, orderSearch]);

  const pageError = overviewQuery.isError || analyticsQuery.isError || guestsQuery.isError;
  const loading = overviewQuery.isLoading || analyticsQuery.isLoading || guestsQuery.isLoading;

  const mp = (delay: number) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1], delay },
        };

  if (pageError) {
    return (
      <VenuePageShell
        title="Overview"
        actions={
          <Link href="/promoter/events">
            <VenueActionButton variant="primary">Open Events</VenueActionButton>
          </Link>
        }
      >
        <div
          className="rounded-[32px] px-8 py-16 flex flex-col items-center text-center gap-4"
          style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <div>
            <p className="text-[16px] font-semibold text-white">Failed to load overview</p>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              One or more promoter data feeds did not return successfully.
            </p>
          </div>
        </div>
      </VenuePageShell>
    );
  }

  return (
    <VenuePageShell
      title="Overview"
      actions={
        <>
          <Link href="/promoter/analytics">
            <VenueActionButton variant="secondary">
              <TrendingUp className="w-4 h-4" />
              Analytics
            </VenueActionButton>
          </Link>
          <Link href="/promoter/payouts">
            <VenueActionButton variant="primary">
              <Wallet className="w-4 h-4" />
              Withdraw {formatCompactINR(overviewQuery.data?.kpis?.commission)}
            </VenueActionButton>
          </Link>
        </>
      }
    >
      <motion.div {...mp(0)} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_370px] gap-5">
        <Suspense
          fallback={
            <section
              className="rounded-[28px] p-5 md:p-6 min-h-[400px] flex items-center justify-center"
              style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-8 h-8 border-4 border-t-[#f46a3a] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </section>
          }
        >
          <LazyOverviewChart
            metric={metric}
            setMetric={setMetric}
            range={range}
            setRange={setRange}
            analyticsTimeline={analyticsTimeline}
            analyticsOverview={analyticsOverview}
            loading={loading}
          />
        </Suspense>

        <section
          className="rounded-[28px] p-5 md:p-6 flex flex-col"
          style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-[18px] md:text-[20px] font-semibold text-white">Latest Orders</h2>
            <Link
              href="/promoter/guests"
              className="h-9 px-4 inline-flex items-center rounded-full text-[11px] font-black uppercase tracking-[0.18em]"
              style={{
                background: '#18191e',
                color: 'rgba(255,255,255,0.42)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              View More
            </Link>
          </div>

          <div
            className="mb-4 h-11 rounded-[18px] px-4 flex items-center gap-3"
            style={{ background: '#1a1b20', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <Search className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.28)' }} />
            <input
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search orders, customers, events..."
              className="w-full bg-transparent text-[13px] outline-none"
              style={{ color: '#fff' }}
            />
          </div>

          <div className="flex flex-col gap-3">
            {filteredOrders.slice(0, 4).map((order, index) => (
              <OrderRow key={order.id || index} order={order} />
            ))}

            {!loading && filteredOrders.length === 0 && (
              <div
                className="rounded-[22px] px-5 py-10 text-center"
                style={{ background: '#18191d', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  No matching orders found.
                </p>
              </div>
            )}

            {loading && (
              <>
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="h-[92px] rounded-[22px] animate-pulse"
                    style={{ background: '#18191d' }}
                  />
                ))}
              </>
            )}
          </div>
        </section>
      </motion.div>

      <motion.section
        {...mp(0.08)}
        className="rounded-[28px] p-5 md:p-6"
        style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-[18px] md:text-[20px] font-semibold text-white">Upcoming Events</h2>
          <Link
            href="/promoter/events"
            className="inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: '#f46a3a' }}
          >
            Open events <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {assignments.slice(0, 4).map((assignment, index) => (
            <UpcomingEventCard key={assignment.id || index} assignment={assignment} />
          ))}

          {!loading && assignments.length === 0 && (
            <div
              className="rounded-[24px] px-6 py-14 flex flex-col items-center text-center gap-3"
              style={{ background: '#18191d', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <CalendarDays className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.28)' }} />
              <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                No assigned events yet.
              </p>
            </div>
          )}

          {loading && (
            <div
              className="h-[144px] rounded-[24px] animate-pulse"
              style={{ background: '#18191d' }}
            />
          )}
        </div>
      </motion.section>
    </VenuePageShell>
  );
}
