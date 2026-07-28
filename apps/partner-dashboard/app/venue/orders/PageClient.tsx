'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { cn } from '@/lib/utils';
import { formatINRCompact } from '@/lib/utils/format';

type SourceFilter = 'all' | 'ticket' | 'rsvp';

type OrderRecord = {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  eventName: string;
  amount: number;
  ticketsCount: number;
  createdAt: string;
  status: string;
  source: 'ticket' | 'rsvp';
};

export default function VenueOrdersPageClient() {
  const { profile, user } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId;
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [eventId, setEventId] = useState('all');
  const [selectedRange, setSelectedRange] = useState('all');
  const cursorsByPage = useRef<Record<number, string | null>>({ 1: null });

  const resetPagination = useCallback(() => {
    cursorsByPage.current = { 1: null };
    setPage(1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      resetPagination();
      setAppliedQuery(query.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, resetPagination]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    switch (selectedRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        return { startDate: start.toISOString(), endDate: now.toISOString() };
      case '7d':
        start.setDate(now.getDate() - 7);
        return { startDate: start.toISOString(), endDate: now.toISOString() };
      case '30d':
        start.setDate(now.getDate() - 30);
        return { startDate: start.toISOString(), endDate: now.toISOString() };
      default:
        return { startDate: '', endDate: '' };
    }
  }, [selectedRange]);

  const eventsQuery = useQuery({
    queryKey: ['venue', venueId, 'events-list'],
    enabled: Boolean(venueId && user),
    queryFn: async () => {
      const token = await user!.getIdToken();
      const params = new URLSearchParams({ venueId: venueId!, limit: '100' });
      const response = await fetch(`/api/partners/venues/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    staleTime: 60_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['venue', venueId, 'orders', page, appliedQuery, eventId, selectedRange],
    enabled: Boolean(venueId && user),
    queryFn: async () => {
      const token = await user!.getIdToken();
      const params = new URLSearchParams({
        venueId: venueId!,
        limit: '20',
        ...(appliedQuery ? { q: appliedQuery } : {}),
        ...(eventId !== 'all' ? { eventId } : {}),
        ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
        ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
        ...(cursorsByPage.current[page] ? { cursor: cursorsByPage.current[page]! } : {}),
      });
      const response = await fetch(`/api/partners/venues/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    staleTime: 30_000,
  });

  const rawOrders = (ordersQuery.data?.orders || []) as OrderRecord[];
  const orders = useMemo(
    () => rawOrders.filter((order) => (source === 'all' ? true : order.source === source)),
    [rawOrders, source],
  );
  const pagination = ordersQuery.data?.pagination;

  useEffect(() => {
    const nextCursor = pagination?.nextCursor;
    if (pagination?.hasMore && nextCursor) cursorsByPage.current[page + 1] = nextCursor;
  }, [page, pagination?.hasMore, pagination?.nextCursor]);

  return (
    <VenuePageShell title="Orders" subtitle="Latest venue orders across all events.">
      <div className="mb-8 flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[var(--v-text-tertiary)] transition-colors group-focus-within:text-[var(--v-text-primary)]" />
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-full bg-[var(--v-elevated)] border border-[var(--v-border)] text-sm font-medium text-[var(--v-text-primary)] placeholder:text-[var(--v-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--v-border-strong)] transition-all shadow-sm"
              placeholder="Search attendee, email or order ID..."
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 items-center gap-2 rounded-full bg-[var(--v-elevated)] border border-[var(--v-border)] px-5 transition-all hover:border-[var(--v-border-strong)]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--v-text-tertiary)]">
                Event
              </span>
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  resetPagination();
                }}
                className="bg-transparent border-none text-[13px] font-bold text-[var(--v-text-primary)] outline-none min-w-[140px] cursor-pointer appearance-none"
              >
                <option value="all">All Events</option>
                {eventsQuery.data?.events?.map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex h-12 items-center gap-2 rounded-full bg-[var(--v-elevated)] border border-[var(--v-border)] px-5 transition-all hover:border-[var(--v-border-strong)]">
              <CalendarDays className="h-4 w-4 text-[var(--v-text-tertiary)]" />
              <select
                value={selectedRange}
                onChange={(e) => {
                  setSelectedRange(e.target.value);
                  resetPagination();
                }}
                className="bg-transparent border-none text-[13px] font-bold text-[var(--v-text-primary)] outline-none min-w-[110px] cursor-pointer appearance-none"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center p-1.5 rounded-full bg-[var(--v-elevated)] border border-[var(--v-border)] w-fit">
          {[
            { id: 'all', label: 'All Orders', icon: Filter },
            { id: 'ticket', label: 'Tickets', icon: null },
            { id: 'rsvp', label: 'RSVPs', icon: null },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setSource(btn.id as SourceFilter)}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-full text-[13px] font-bold transition-all',
                source === btn.id
                  ? 'bg-[var(--v-card)] text-[var(--v-text-primary)] shadow-lg border border-[var(--v-border-strong)]'
                  : 'text-[var(--v-text-tertiary)] hover:text-[var(--v-text-secondary)]',
              )}
            >
              {btn.icon && <btn.icon className="h-3.5 w-3.5" />}
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {ordersQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[28px] bg-[var(--v-elevated)]" />
          ))
        ) : orders.length === 0 ? (
          <div className="dashboard-empty-state min-h-[300px] rounded-[32px] border border-dashed border-[var(--v-border)] bg-[var(--v-card)]">
            <div className="text-center">
              <Search className="h-10 w-10 mx-auto mb-4 text-[var(--v-text-tertiary)] opacity-20" />
              <h3 className="text-lg font-semibold text-[var(--v-text-primary)]">
                No orders matched
              </h3>
              <p className="text-sm text-[var(--v-text-tertiary)]">
                Try adjusting your filters or search query.
              </p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="group relative overflow-hidden rounded-[28px] border border-[var(--v-border)] bg-[var(--v-card)] p-4 transition-all hover:border-[var(--v-border-strong)] hover:shadow-xl hover:-translate-y-0.5"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--v-border)] bg-[var(--v-elevated)] shadow-inner">
                  <span className="text-lg font-black text-[var(--v-text-primary)]">
                    {order.customerName.charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[17px] font-bold tracking-tight text-[var(--v-text-primary)]">
                      {order.customerName}
                    </h4>
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border transition-colors',
                        order.source === 'rsvp'
                          ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                          : 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                      )}
                    >
                      {order.source}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[13px] text-[var(--v-text-tertiary)] font-medium">
                    <span className="truncate">{order.eventName}</span>
                    <span className="h-1 w-1 rounded-full bg-[var(--v-border)]" />
                    <span className="whitespace-nowrap uppercase tracking-tighter">
                      {new Date(order.createdAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center md:items-end flex-row md:flex-col justify-between md:justify-center border-t md:border-t-0 border-[var(--v-border)] pt-4 md:pt-0">
                  <span className="text-[11px] font-black text-[var(--v-text-tertiary)] uppercase tracking-wider">
                    {order.orderNumber}
                  </span>
                  <div className="text-[22px] font-black tracking-tighter text-[var(--v-text-primary)] md:mt-1">
                    {formatINRCompact(order.amount)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {pagination && (pagination.hasMore || page > 1) ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="venue-utility-button disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="rounded-full border border-[var(--v-border)] bg-[var(--v-card)] px-4 py-2 text-sm font-semibold text-[var(--v-text-primary)]">
            {page}
          </div>
          <button
            type="button"
            onClick={() => {
              if (pagination.hasMore) setPage((current) => current + 1);
            }}
            disabled={!pagination.hasMore}
            className="venue-utility-button disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </VenuePageShell>
  );
}
