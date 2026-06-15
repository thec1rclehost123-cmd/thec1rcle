'use client';

import type { ComponentType } from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { EVENT_LIFECYCLE } from '@c1rcle/core/events';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { ErrorState } from '@/components/ui/ErrorState';
import { GuestPortalEventPreview } from '@/components/wizard/GuestPortalEventPreview';

interface SlotRequest {
  id: string;
  eventId: string;
  hostId: string;
  hostName: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  notes?: string;
  createdAt: string;
}

interface EventRequest {
  id: string;
  title: string;
  hostName: string;
  hostId: string;
  lifecycle: string;
  startDate: string;
  startTime: string;
  endTime: string;
  category: string;
  capacity: number;
  tickets: any[];
  image?: string;
  createdAt: string;
  venueName?: string;
  venue?: string;
  slotRequest?: SlotRequest;
}

type ActiveTab = 'pending' | 'all';
type ModalType = 'approve' | 'reject' | 'changes' | null;

export default function VenueEventRequestsPage() {
  const { profile, user } = useDashboardAuth();
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');
  const [actionNotes, setActionNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionModal, setActionModal] = useState<{
    type: ModalType;
    request: EventRequest | null;
  }>({ type: null, request: null });
  const [previewRequest, setPreviewRequest] = useState<EventRequest | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const venueId = profile?.activeMembership?.partnerId;

  useEffect(() => {
    if (venueId) fetchRequests();
  }, [venueId, activeTab]);

  const getHeaders = async (): Promise<Record<string, string>> => {
    const token = user ? await user.getIdToken() : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchRequests = async () => {
    setLoading(true);
    setError(false);
    try {
      const headers = await getHeaders();

      const [slotsRes, submittedRes] = await Promise.all([
        fetch(`/api/slots?venueId=${venueId}${activeTab === 'pending' ? '&status=pending' : ''}`, {
          headers,
        }),
        fetch(`/api/events?venueId=${venueId}&lifecycle=${EVENT_LIFECYCLE.SUBMITTED}`, {
          headers,
        }),
      ]);

      const slotsData = await slotsRes.json();
      const submittedData = await submittedRes.json();
      const slotRequests = Array.isArray(slotsData)
        ? slotsData
        : Array.isArray(slotsData?.requests)
          ? slotsData.requests
          : [];
      const submittedEvents = Array.isArray(submittedData)
        ? submittedData
        : Array.isArray(submittedData?.events)
          ? submittedData.events
          : [];

      const eventRequestsFromSlots: EventRequest[] = await Promise.all(
        slotRequests.map(async (slot: SlotRequest) => {
          try {
            const eventRes = await fetch(`/api/events/${slot.eventId}`, { headers });
            const eventData = await eventRes.json();
            if (!eventData.event) return null;

            return {
              ...eventData.event,
              slotRequest: slot,
            };
          } catch {
            return null;
          }
        }),
      );

      const slotEventIds = new Set(
        eventRequestsFromSlots.filter(Boolean).map((request) => request!.id),
      );

      const eventRequestsFromSubmitted = submittedEvents
        .filter((event: any) => !slotEventIds.has(event.id))
        .map((event: any) => ({
          ...event,
          lifecycle: event.lifecycle,
        }));

      setRequests([...eventRequestsFromSlots.filter(Boolean), ...eventRequestsFromSubmitted]);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const handleAction = async (action: 'approve' | 'reject' | 'suggest') => {
    if (!actionModal.request) return;

    setProcessing(true);
    try {
      const headers = await getHeaders();
      const slotId = actionModal.request.slotRequest?.id;
      const eventId = actionModal.request.id;

      if (slotId) {
        const res = await fetch(`/api/slots/${slotId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(headers as Record<string, string>),
          },
          body: JSON.stringify({
            action,
            notes: actionNotes,
            actor: {
              uid: profile?.uid,
              role: profile?.activeMembership?.role || 'venue',
              name: profile?.displayName,
              partnerId: profile?.activeMembership?.partnerId,
            },
            venueId: profile?.activeMembership?.partnerId,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Action failed on slot request');
        }
      }

      if (action === 'approve' || action === 'reject') {
        if (
          action === 'reject' ||
          (action === 'approve' && actionModal.request.lifecycle === EVENT_LIFECYCLE.SUBMITTED)
        ) {
          const eventAction = action === 'approve' ? 'approve' : 'deny';
          const res = await fetch(`/api/events/${eventId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({
              action: eventAction,
              notes: actionNotes,
              actor: {
                uid: profile?.uid,
                role: profile?.activeMembership?.role || 'venue',
                name: profile?.displayName,
                partnerId: profile?.activeMembership?.partnerId,
              },
              venueId: profile?.activeMembership?.partnerId,
            }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || data.message || 'Failed to update event status');
          }
        }
      }

      await fetchRequests();
      setActionModal({ type: null, request: null });
      setActionNotes('');
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const formatIndianDate = (value?: string, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      ...options,
    }).format(new Date(value));
  };

  const toTitleCase = (value?: string) => {
    if (!value) return '';
    return value
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getDisplayTitle = (request: EventRequest) => toTitleCase(request.title || 'Untitled Event');
  const getDisplayHost = (request: EventRequest) => toTitleCase(request.hostName || 'Unknown Host');
  const getDisplayCategory = (request: EventRequest) => toTitleCase(request.category || 'Event');
  const getRequestedDate = (request: EventRequest) =>
    request.slotRequest?.requestedDate || request.startDate;
  const getRequestedStartTime = (request: EventRequest) =>
    request.slotRequest?.requestedStartTime || request.startTime;
  const getRequestedEndTime = (request: EventRequest) =>
    request.slotRequest?.requestedEndTime || request.endTime;
  const getDateParts = (request: EventRequest) => {
    const value = getRequestedDate(request);
    if (!value) {
      return { day: '--', month: '---', weekday: '', full: '' };
    }

    return {
      day: formatIndianDate(value, { day: '2-digit' }),
      month: formatIndianDate(value, { month: 'short' }).toUpperCase(),
      weekday: formatIndianDate(value, { weekday: 'long' }),
      full: formatIndianDate(value, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    };
  };

  const getScheduleLabel = (request: EventRequest) => {
    const start = getRequestedStartTime(request);
    const end = getRequestedEndTime(request);
    const formatTime = (value?: string) => {
      if (!value) return '';
      const [rawHour = '0', rawMinute = '00'] = String(value).split(':');
      const hour = Number(rawHour);
      const minute = Number(rawMinute);
      if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const normalizedHour = hour % 12 || 12;
      return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
    };

    const formattedStart = formatTime(start);
    const formattedEnd = formatTime(end);
    return formattedStart && formattedEnd
      ? `${formattedStart} – ${formattedEnd}`
      : formattedStart || formattedEnd || 'Time TBA';
  };

  const getHostInitial = (request: EventRequest) =>
    getDisplayHost(request).charAt(0).toUpperCase() || 'H';

  const getRequestStatus = (request: EventRequest) => {
    if (request.lifecycle === EVENT_LIFECYCLE.SUBMITTED) {
      return {
        label: 'Reviewing Content',
        bg: 'bg-white/8 border border-white/10 backdrop-blur-xl',
        text: 'text-white/90',
        dot: 'bg-sky-400',
        icon: ShieldCheck,
      };
    }

    const status = request.slotRequest?.status || 'pending';
    const config: Record<
      string,
      { label: string; bg: string; text: string; dot: string; icon: any }
    > = {
      pending: {
        label: 'Pending Review',
        bg: 'bg-white/8 border border-white/10 backdrop-blur-xl',
        text: 'text-white/90',
        dot: 'bg-amber-400',
        icon: Clock,
      },
      approved: {
        label: 'Approved',
        bg: 'bg-white/8 border border-white/10 backdrop-blur-xl',
        text: 'text-white/90',
        dot: 'bg-emerald-400',
        icon: CheckCircle2,
      },
      rejected: {
        label: 'Rejected',
        bg: 'bg-white/8 border border-white/10 backdrop-blur-xl',
        text: 'text-white/90',
        dot: 'bg-rose-400',
        icon: XCircle,
      },
      modified: {
        label: 'Changes Suggested',
        bg: 'bg-white/8 border border-white/10 backdrop-blur-xl',
        text: 'text-white/90',
        dot: 'bg-blue-400',
        icon: MessageSquare,
      },
      [EVENT_LIFECYCLE.DENIED]: {
        label: 'Rejected',
        bg: 'bg-white/8 border border-white/10 backdrop-blur-xl',
        text: 'text-white/90',
        dot: 'bg-rose-400',
        icon: XCircle,
      },
    };

    return config[status] || config.pending;
  };

  const pendingCount = requests.filter((request) => {
    const status = request.slotRequest?.status || 'pending';
    return status === 'pending' || request.lifecycle === EVENT_LIFECYCLE.SUBMITTED;
  }).length;
  const approvedCount = requests.filter(
    (request) => request.slotRequest?.status === 'approved',
  ).length;
  const rejectedCount = requests.filter((request) => {
    const status = request.slotRequest?.status;
    return status === 'rejected' || request.lifecycle === EVENT_LIFECYCLE.DENIED;
  }).length;

  return (
    <div className="space-y-5 pb-14 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link
            href="/venue/events"
            className="mb-2 inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Slot Requests
          </h1>
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Pending" value={pendingCount} icon={Clock} accent="amber" />
        <MetricCard label="Approved" value={approvedCount} icon={CheckCircle2} accent="emerald" />
        <MetricCard label="Rejected" value={rejectedCount} icon={XCircle} accent="rose" />
      </div>

      <div className="flex items-center gap-2 p-1 bg-surface-secondary rounded-xl w-fit overflow-x-auto max-w-full scrollbar-hide">
        {[
          { id: 'pending', label: 'Pending' },
          { id: 'all', label: 'All Requests' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-surface-elevated text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="relative overflow-hidden rounded-[30px] border border-white/5 bg-[linear-gradient(180deg,rgba(35,35,40,0.98),rgba(24,24,28,0.98))] p-3.5"
            >
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.08),transparent)]" />
              <div className="relative space-y-4">
                <div className="aspect-[16/10] rounded-[24px] bg-white/[0.04]" />
                <div className="h-6 w-2/3 rounded-xl bg-white/[0.05]" />
                <div className="h-20 rounded-[20px] bg-white/[0.04]" />
                <div className="h-14 rounded-[20px] bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load requests"
          message="We couldn't fetch your slot requests. Check your connection and try again."
          onRetry={fetchRequests}
        />
      ) : requests.length === 0 ? (
        <div className="relative overflow-hidden rounded-[34px] border border-white/5 bg-[linear-gradient(180deg,rgba(34,34,38,0.98),rgba(21,21,25,0.98))] p-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_60%)]">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04]">
              <Calendar className="h-7 w-7 text-white/75" />
              <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-amber-300/80" />
            </div>
          </div>
          <h3 className="mb-2 text-xl font-black tracking-[-0.03em] text-text-primary">
            No {activeTab === 'pending' ? 'pending ' : ''}requests
          </h3>
          <p className="mx-auto max-w-sm text-sm leading-6 text-text-tertiary">
            {activeTab === 'pending'
              ? 'All event slot requests have been reviewed.'
              : 'Partner hosts have not requested any slots yet.'}
          </p>
          <Link
            href="/venue/partnerships"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-white/[0.08]"
          >
            Share your venue link
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {requests.map((request) => {
            const statusConfig = getRequestStatus(request);
            const isActionable =
              request.slotRequest?.status === 'pending' ||
              request.lifecycle === EVENT_LIFECYCLE.SUBMITTED;

            return (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative rounded-[30px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
              >
                {request.image ? (
                  <div
                    className="pointer-events-none absolute -inset-[10px] rounded-[38px] opacity-75 blur-3xl saturate-[1.6]"
                    style={{
                      backgroundImage: `url(${request.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                ) : (
                  <div className="pointer-events-none absolute -inset-[10px] rounded-[38px] bg-[radial-gradient(circle_at_center,rgba(203,132,255,0.34),transparent_62%)] blur-3xl opacity-100" />
                )}
                <div className="relative overflow-hidden rounded-[30px] border border-white/[0.04] bg-[linear-gradient(180deg,rgba(38,38,42,0.98),rgba(24,24,28,0.98))] p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.3),0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
                  {request.image ? (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[30px] opacity-95"
                      style={{
                        backgroundImage: `url(${request.image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'saturate(1.7) brightness(1.2)',
                      }}
                    />
                  ) : (
                    <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(244,196,255,0.98),rgba(214,144,255,0.94))] opacity-100 shadow-[0_0_22px_rgba(210,138,255,0.75),0_0_48px_rgba(182,97,255,0.42)]" />
                  )}
                  <div className="pointer-events-none absolute inset-[2px] rounded-[28px] bg-[linear-gradient(180deg,rgba(38,38,42,0.985),rgba(24,24,28,0.985))]" />
                  {request.image && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
                      <img
                        src={request.image}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.15] blur-[72px] saturate-150"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,20,0.58)_0%,rgba(18,18,20,0.88)_46%,rgba(18,18,20,0.98)_100%)]" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_70%)]" />
                  <div className="relative flex h-full flex-col">
                    <div className="relative overflow-hidden rounded-[24px] bg-black/30">
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                          {statusConfig.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewRequest(request)}
                          className="inline-flex h-9 items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-black/35 px-2.5 text-xs font-bold text-white/90 backdrop-blur-md transition-all duration-300 hover:w-[108px] hover:bg-black/50"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[72px]">
                            Preview
                          </span>
                        </button>
                      </div>
                      <div className="aspect-[16/10] w-full">
                        {request.image ? (
                          <img
                            src={request.image}
                            alt={getDisplayTitle(request)}
                            className="h-full w-full object-cover transition-transform duration-[6000ms] ease-out group-hover:scale-[1.06]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-surface-secondary">
                            <Calendar className="h-8 w-8 text-text-tertiary" />
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_80%,transparent_40%,rgba(0,0,0,0.95)_100%)]" />
                      <div className="absolute inset-x-4 bottom-4">
                        <div className="text-[24px] font-black leading-[1.05] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] line-clamp-1">
                          {getDisplayTitle(request)}
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-3.5 flex flex-1 flex-col">
                      <div className="mb-1.5 flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0">
                          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,#a78bfa,#ec4899,#f97316,#a78bfa)] transition-transform duration-[8000ms] group-hover:rotate-[360deg]" />
                          <div className="absolute inset-[2px] flex items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-white">
                            {getHostInitial(request)}
                          </div>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="line-clamp-1 text-[20px] font-black tracking-[-0.03em] text-text-primary">
                              {getDisplayHost(request)}
                            </h3>
                            {request.slotRequest?.notes ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedNotes((current) => ({
                                    ...current,
                                    [request.id]: !current[request.id],
                                  }))
                                }
                                className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-text-tertiary transition hover:bg-white/[0.08] hover:text-text-primary"
                                aria-label={
                                  expandedNotes[request.id] ? 'Hide host note' : 'Show host note'
                                }
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.8)]" />
                              </button>
                            ) : null}
                          </div>
                          <p className="text-[11px] font-medium text-text-tertiary">
                            Host · Event submission
                          </p>
                        </div>
                      </div>

                      {request.slotRequest?.notes && expandedNotes[request.id] ? (
                        <div className="mb-2 rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3">
                          <p className="text-sm italic leading-6 text-text-secondary">
                            {request.slotRequest.notes}
                          </p>
                        </div>
                      ) : null}

                      <div className="grid gap-2">
                        <div className="rounded-[22px] bg-black/18 p-4">
                          <div className="grid grid-cols-[auto_1px_minmax(0,1fr)] items-center gap-4">
                            <div className="min-w-[64px] text-center">
                              <div className="text-[52px] font-black leading-none text-text-primary">
                                {getDateParts(request).day}
                              </div>
                              <div className="mt-1 text-[11px] font-black uppercase tracking-[0.3em] text-text-tertiary">
                                {getDateParts(request).month}
                              </div>
                            </div>
                            <div className="h-14 w-px bg-white/10" />
                            <div className="min-w-0">
                              <div className="text-[25px] font-black leading-tight text-text-primary">
                                {getScheduleLabel(request)}
                              </div>
                              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] text-text-tertiary">
                                {getDateParts(request).weekday}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4">
                            <div className="relative h-1 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                                style={{ width: '100%' }}
                              />
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950/90 px-2 py-0.5 text-[11px] font-medium text-text-tertiary">
                                {request.capacity || 0} spots
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3.5">
                        {isActionable ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setActionModal({ type: 'approve', request })}
                              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500/95 px-4 py-3 text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] transition duration-300 hover:scale-[1.02] hover:bg-emerald-500 active:scale-[0.97]"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <div className="text-sm font-black">Accept</div>
                            </button>
                            <button
                              onClick={() => setActionModal({ type: 'changes', request })}
                              className="flex items-center justify-center gap-2 rounded-full border border-amber-400/40 px-4 py-3 text-amber-300 transition duration-300 hover:border-amber-300/70 hover:bg-amber-500/8 active:scale-[0.97]"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <div className="text-sm font-black text-yellow-200">Suggest</div>
                            </button>
                            <button
                              onClick={() => setActionModal({ type: 'reject', request })}
                              className="flex items-center justify-center gap-2 rounded-full border border-rose-400/40 px-4 py-3 text-rose-300 transition duration-300 hover:bg-rose-500/8 active:scale-[0.97]"
                            >
                              <XCircle className="h-4 w-4" />
                              <div className="text-sm font-black text-rose-300">Reject</div>
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-sm text-text-secondary">
                            This request has already been reviewed.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {previewRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border-subtle bg-zinc-900 px-6 py-4">
                <button
                  onClick={() => setPreviewRequest(null)}
                  className="flex items-center gap-2 text-text-primary hover:text-text-placeholder"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span className="text-[11px] font-bold uppercase">Back to Slot Requests</span>
                </button>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-bold uppercase text-text-primary/40">
                    Preview Mode
                  </span>
                  <button
                    onClick={() => setPreviewRequest(null)}
                    aria-label="Close preview"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-text-primary/70 transition hover:bg-white/5 hover:text-text-primary"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <GuestPortalEventPreview
                  event={{
                    ...previewRequest,
                    title: getDisplayTitle(previewRequest),
                    id: previewRequest.id,
                    venue: previewRequest.venueName || previewRequest.venue,
                    location: previewRequest.venueName || previewRequest.venue,
                    poster: previewRequest.image,
                    coverImage: previewRequest.image,
                  }}
                  host={{
                    name: getDisplayHost(previewRequest),
                  }}
                  onBack={() => setPreviewRequest(null)}
                  backLabel="Back to Slot Requests"
                />
              </div>
            </div>
          </motion.div>
        )}
        {actionModal.type && actionModal.request && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setActionModal({ type: null, request: null })}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-surface-elevated border border-border-default rounded-3xl p-6 max-w-md w-full shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-text-primary mb-2">
                {actionModal.type === 'approve' && 'Approve Event'}
                {actionModal.type === 'reject' && 'Reject Event'}
                {actionModal.type === 'changes' && 'Suggest Changes'}
              </h3>
              <p className="text-sm text-text-tertiary mb-6">
                {actionModal.type === 'approve' &&
                  'This confirms the slot and approves the event for publication.'}
                {actionModal.type === 'reject' &&
                  'The host will be notified and can request a different slot.'}
                {actionModal.type === 'changes' &&
                  'Suggest edits, alternate timings, or missing details before approval.'}
              </p>

              <div className="p-4 rounded-2xl bg-surface-secondary border border-border-subtle mb-4">
                <p className="text-base font-semibold text-text-primary">
                  {getDisplayTitle(actionModal.request)}
                </p>
                <p className="text-sm text-text-tertiary mt-1">
                  {actionModal.request.slotRequest?.requestedDate || actionModal.request.startDate}{' '}
                  •{' '}
                  {actionModal.request.slotRequest?.requestedStartTime ||
                    actionModal.request.startTime}
                </p>
              </div>

              <textarea
                value={actionNotes}
                onChange={(event) => setActionNotes(event.target.value)}
                placeholder={
                  actionModal.type === 'approve'
                    ? 'Add a note for the host (optional)...'
                    : 'Tell the host what needs to change...'
                }
                rows={4}
                className="w-full px-4 py-3 rounded-2xl bg-surface-secondary border border-border-subtle text-sm text-text-primary resize-none focus:outline-none focus:border-border-strong transition-all mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setActionModal({ type: null, request: null })}
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-secondary hover:bg-surface-tertiary text-text-secondary text-sm font-semibold transition-colors"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleAction(actionModal.type === 'changes' ? 'suggest' : actionModal.type!)
                  }
                  disabled={processing || (actionModal.type !== 'approve' && !actionNotes.trim())}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    actionModal.type === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : actionModal.type === 'reject'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {processing
                    ? 'Processing...'
                    : actionModal.type === 'approve'
                      ? 'Approve'
                      : actionModal.type === 'reject'
                        ? 'Reject'
                        : 'Send'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  accent: 'amber' | 'emerald' | 'rose';
}) {
  const spring = useSpring(0, { stiffness: 180, damping: 24 });
  const rounded = useTransform(spring, (latest) => Math.round(latest).toString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const config = {
    amber: {
      glow: 'bg-amber-400/12',
      iconBg: 'bg-amber-500/10',
      iconText: 'text-amber-400',
      text: 'text-amber-400',
      shadow: '0 0 20px rgba(245,158,11,0.18)',
    },
    emerald: {
      glow: 'bg-emerald-400/12',
      iconBg: 'bg-emerald-500/10',
      iconText: 'text-emerald-400',
      text: 'text-emerald-400',
      shadow: '0 0 20px rgba(16,185,129,0.18)',
    },
    rose: {
      glow: 'bg-rose-400/12',
      iconBg: 'bg-rose-500/10',
      iconText: 'text-rose-400',
      text: 'text-rose-400',
      shadow: '0 0 20px rgba(244,63,94,0.18)',
    },
  }[accent];

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/[0.04] bg-[linear-gradient(180deg,rgba(34,34,38,0.98),rgba(26,26,30,0.98))] p-6 shadow-[0_4px_16px_rgba(0,0,0,0.3),0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl ${config.glow}`}
      />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary">{label}</p>
          <motion.p
            className={`mt-1 text-3xl font-black ${config.text}`}
            style={{ textShadow: config.shadow }}
          >
            {rounded}
          </motion.p>
          <div className="mt-3">
            <MetricSparkline accent={accent} value={value} />
          </div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.iconBg}`}>
          <Icon className={`h-6 w-6 ${config.iconText}`} />
        </div>
      </div>
    </div>
  );
}

function MetricSparkline({
  accent,
  value,
}: {
  accent: 'amber' | 'emerald' | 'rose';
  value: number;
}) {
  const colors = {
    amber: '#f59e0b',
    emerald: '#10b981',
    rose: '#f43f5e',
  };
  const color = colors[accent];
  const values = [0.34, 0.52, 0.41, 0.67, 0.58, 0.74, 0.7].map((point) =>
    Math.max(4, point * Math.max(value, 6)),
  );
  const width = 52;
  const height = 18;
  const max = Math.max(...values, 1);
  const path = values
    .map((point, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (point / max) * height;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={52} height={18} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
