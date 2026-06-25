'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Building2,
  RefreshCw,
  Eye,
  Edit3,
  Loader2,
  ArrowLeft,
  BarChart3,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/ErrorState';
import { EVENT_LIFECYCLE } from '@c1rcle/core/events';
import { DashboardEventCard } from '@c1rcle/ui';
import { parseAsIST } from '@c1rcle/core/time';

interface SlotRequest {
  id: string;
  eventId: string;
  venueId: string;
  venueName: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  status: 'pending' | 'approved' | 'rejected' | 'counter_proposed' | 'needs_changes';
  notes?: string;
  clubResponse?: string;
  alternativeDate?: string;
  alternativeStartTime?: string;
  alternativeEndTime?: string;
  createdAt: string;
  respondedAt?: string;
  event?: {
    id: string;
    title: string;
    poster?: string;
    lifecycle: string;
  };
}

export default function HostSlotRequestsPage() {
  const { profile, user } = useDashboardAuth();
  const [requests, setRequests] = useState<SlotRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'pending' | 'approved' | 'needs_action' | 'denied' | 'all'
  >('pending');
  const [selectedRequest, setSelectedRequest] = useState<SlotRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hostId = profile?.activeMembership?.partnerId;

  useEffect(() => {
    if (hostId) {
      fetchRequests();
    }
  }, [hostId]);

  const fetchRequests = async () => {
    setLoading(true);
    setIsError(false);
    try {
      const token = user ? await user.getIdToken() : '';
      const res = await fetch(`/api/partners/hosts/slot-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      // Enrich with event details — deduplicate by eventId to avoid N+1 fetches
      const rawRequests: SlotRequest[] = data.requests || [];
      const uniqueEventIds = [...new Set(rawRequests.map((r) => r.eventId))];
      const eventMap: Record<string, SlotRequest['event']> = {};
      await Promise.all(
        uniqueEventIds.map(async (eventId) => {
          try {
            const eventRes = await fetch(`/api/events/${eventId}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const eventData = await eventRes.json();
            if (eventData.event) eventMap[eventId] = eventData.event;
          } catch {
            // leave eventMap[eventId] undefined; UI gracefully falls back
          }
        }),
      );
      const enrichedRequests = rawRequests.map((req) => ({
        ...req,
        event: eventMap[req.eventId],
      }));

      setRequests(enrichedRequests);
    } catch {
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const formatIndianDate = (value?: string, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      ...options,
    }).format(new Date(value));
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      submitted: {
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        icon: Clock,
        label: 'Pending Review',
      },
      approved: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        icon: CheckCircle2,
        label: 'Approved',
      },
      scheduled: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        icon: CheckCircle2,
        label: 'Approved',
      },
      needs_changes: {
        bg: 'bg-orange-50',
        text: 'text-orange-600',
        icon: Edit3,
        label: 'Changes Requested',
      },
      denied: {
        bg: 'bg-rose-50',
        text: 'text-rose-600',
        icon: XCircle,
        label: 'Denied',
      },
      pending: {
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        icon: Clock,
        label: 'Pending Review',
      },
      rejected: {
        bg: 'bg-rose-50',
        text: 'text-rose-600',
        icon: XCircle,
        label: 'Rejected',
      },
      counter_proposed: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        icon: MessageSquare,
        label: 'Counter Proposal',
      },
    };
    if (status === 'approved') return configs.approved;
    if (status === 'needs_changes') return configs.needs_changes;
    if (status === 'rejected') return configs.rejected;
    return configs[status] || configs.pending;
  };

  const pendingCount = requests.filter(
    (r) => r.event?.lifecycle === EVENT_LIFECYCLE.SUBMITTED,
  ).length;
  const approvedCount = requests.filter(
    (r) => r.event?.lifecycle === EVENT_LIFECYCLE.APPROVED,
  ).length;
  const needsActionCount = requests.filter(
    (r) => r.event?.lifecycle === EVENT_LIFECYCLE.NEEDS_CHANGES,
  ).length;
  const deniedCount = requests.filter((r) => r.event?.lifecycle === EVENT_LIFECYCLE.DENIED).length;

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const lc = r.event?.lifecycle;
      if (activeTab === 'pending')
        return lc === EVENT_LIFECYCLE.SUBMITTED || (!lc && r.status === 'pending');
      if (activeTab === 'approved')
        return lc === EVENT_LIFECYCLE.APPROVED || (!lc && r.status === 'approved');
      if (activeTab === 'needs_action')
        return lc === EVENT_LIFECYCLE.NEEDS_CHANGES || (!lc && r.status === 'needs_changes');
      if (activeTab === 'denied')
        return lc === EVENT_LIFECYCLE.DENIED || (!lc && r.status === 'rejected');
      return true; // 'all'
    });
  }, [requests, activeTab]);

  // Static color class maps — Tailwind purges dynamic interpolations like `text-${color}-600`
  const colorMap = {
    amber: {
      text: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: 'text-amber-500',
      ring: 'ring-amber-400',
    },
    emerald: {
      text: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: 'text-emerald-500',
      ring: 'ring-emerald-400',
    },
    orange: {
      text: 'text-orange-600',
      bg: 'bg-orange-50',
      icon: 'text-orange-500',
      ring: 'ring-orange-400',
    },
    rose: { text: 'text-rose-600', bg: 'bg-rose-50', icon: 'text-rose-500', ring: 'ring-rose-400' },
  } as const;

  const tabLabels: Record<string, string> = {
    pending: 'pending',
    approved: 'approved',
    needs_action: 'needs action',
    denied: 'denied',
    all: '',
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Link
            href="/host/partnerships"
            className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-secondary mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Venues
          </Link>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Slot Requests
          </h1>
          <p className="text-text-tertiary text-base font-medium mt-2">
            Track your event slot requests across all partner venues
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-5 py-3 bg-surface-elevated border border-border-default hover:border-border-strong text-text-secondary text-sm font-semibold rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards — click to filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            id: 'pending',
            label: 'Pending',
            count: pendingCount,
            color: 'amber' as const,
            Icon: Clock,
            ring: 'ring-amber-400',
          },
          {
            id: 'approved',
            label: 'Approval',
            count: approvedCount,
            color: 'emerald' as const,
            Icon: CheckCircle2,
            ring: 'ring-emerald-400',
          },
          {
            id: 'needs_action',
            label: 'Needs Action',
            count: needsActionCount,
            color: 'orange' as const,
            Icon: AlertCircle,
            ring: 'ring-orange-400',
          },
          {
            id: 'denied',
            label: 'Denied',
            count: deniedCount,
            color: 'rose' as const,
            Icon: XCircle,
            ring: 'ring-rose-400',
          },
        ].map(({ id, label, count, color, Icon, ring }) => (
          <button
            key={id}
            onClick={() => setActiveTab(activeTab === id ? 'all' : (id as any))}
            className={`w-full text-left bg-surface-elevated border rounded-2xl p-6 transition-all cursor-pointer ${
              activeTab === id
                ? `${ring} ring-2 border-transparent`
                : 'border-border-default hover:border-border-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
                  {label}
                </p>
                <p className={`text-3xl font-black mt-1 ${colorMap[color].text}`}>{count}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl ${colorMap[color].bg} flex items-center justify-center`}
              >
                <Icon className={`w-6 h-6 ${colorMap[color].icon}`} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load requests"
          message="We couldn't fetch your slot requests. Check your connection and try again."
          onRetry={fetchRequests}
        />
      ) : filteredRequests.length === 0 ? (
        <div className="bg-surface-elevated border border-border-default rounded-3xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">
            No {tabLabels[activeTab] || ''} requests
          </h3>
          <p className="text-text-tertiary text-sm max-w-xs mx-auto">
            {activeTab === 'pending'
              ? "You don't have any pending slot requests."
              : activeTab === 'approved'
                ? 'No approved requests yet. Keep submitting!'
                : activeTab === 'needs_action'
                  ? 'No action required on any requests.'
                  : activeTab === 'denied'
                    ? 'No denied requests.'
                    : 'Start by requesting a slot at one of your partner venues.'}
          </p>
          <Link
            href="/host/partnerships"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-text-primary rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            View Partner Venues
          </Link>
        </div>
      ) : (
        <motion.div
          key="grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
        >
          {filteredRequests.map((request, index) => {
            const lc = request.event?.lifecycle || request.status;
            const canEdit =
              lc === EVENT_LIFECYCLE.NEEDS_CHANGES ||
              lc === EVENT_LIFECYCLE.DENIED ||
              request.status === 'rejected' ||
              request.status === 'needs_changes';

            // Map SlotRequest → event shape DashboardEventCard expects
            const cardEvent = {
              id: request.eventId,
              title: request.event?.title || 'Untitled Event',
              venueName: request.venueName || 'Venue pending',
              venueId: request.venueId,
              startDate: request.requestedDate || '',
              startTime: request.requestedStartTime || '',
              date: request.requestedDate ? parseAsIST(request.requestedDate) : new Date(),
              hostName: (profile as any)?.displayName || 'Host',
              lifecycle: lc,
              status: lc,
              coverImage: request.event?.poster || null,
              poster: request.event?.poster || null,
              ticketsSold: 0,
              ticketsTotal: 0,
              stats: null,
            };

            const primaryAction = canEdit
              ? {
                  label: 'Edit & Resubmit',
                  href: `/host/create?id=${request.eventId}`,
                  icon: <Edit3 size={13} />,
                }
              : {
                  label: 'More Info',
                  href: `/host/events/${request.eventId}`,
                  icon: <BarChart3 size={13} />,
                };

            const secondaryActions = [
              {
                label: 'View Event',
                icon: <Eye size={16} />,
                href: `/host/events/${request.eventId}`,
              },
              ...(canEdit
                ? [
                    {
                      label: 'Edit & Resubmit',
                      icon: <Edit3 size={16} />,
                      href: `/host/create?id=${request.eventId}`,
                    },
                  ]
                : []),
            ];

            return (
              <div key={request.id} className="h-full w-full">
                <DashboardEventCard
                  event={cardEvent}
                  index={index}
                  role="host"
                  primaryAction={primaryAction}
                  secondaryActions={secondaryActions}
                  showStats={false}
                />
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
