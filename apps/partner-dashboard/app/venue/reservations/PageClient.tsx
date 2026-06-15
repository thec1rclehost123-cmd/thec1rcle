'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Mail,
  Phone,
  Search,
  Filter,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Utensils,
  Music,
  MessageSquare,
  IndianRupee,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { formatDate } from '@/lib/utils/format';

export default function ReservationsPage() {
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId;

  // Fetch reservations from the API
  const fetchReservations = useCallback(async () => {
    if (!venueId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/partners/venues/reservations?venueId=${venueId}`);
      if (!res.ok) throw new Error('Failed to fetch reservations');
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch (err: any) {
      console.error('[Reservations] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Approve or reject a reservation
  const handleAction = async (id: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(id);

    try {
      const res = await fetch(`/api/partners/venues/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update reservation');

      // Update local state immediately
      setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    } catch (err: any) {
      console.error('[Reservations] Action error:', err);
      // Show error state briefly
      setError(`Failed to ${newStatus} reservation`);
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredReservations = reservations.filter((r) => r.status === filter);

  const statusCounts = {
    pending: reservations.filter((r) => r.status === 'pending').length,
    approved: reservations.filter((r) => r.status === 'approved').length,
    rejected: reservations.filter((r) => r.status === 'rejected').length,
  };

  const totalGuests = (reservations as any).totalGuests ?? 0;
  const totalRevenue = (reservations as any).totalRevenue ?? 0;

  const formatTime = (time: string) => {
    if (!time) return '';
    return time;
  };

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-indigo-500/10 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-widest border border-indigo-500/20">
              Table Management
            </div>
          </div>
          <h1 className="text-4xl font-black text-text-primary tracking-tight flex items-center gap-4">
            <Calendar className="w-10 h-10" />
            Reservations
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReservations}
            disabled={loading}
            className="h-10 w-10 flex items-center justify-center bg-surface-elevated border border-border-default rounded-xl text-text-tertiary hover:text-text-secondary transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex p-1 bg-surface-secondary rounded-2xl border border-border-default">
            {(['pending', 'approved', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                  filter === s
                    ? 'bg-surface-elevated text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {s}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] ${filter === s ? 'bg-surface-secondary' : 'bg-transparent'}`}
                >
                  {statusCounts[s]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 font-medium"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-elevated p-6 rounded-3xl border border-border-subtle shadow-sm">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
            Total Requests
          </p>
          <p className="text-3xl font-black text-text-primary">{reservations.length}</p>
        </div>
        <div className="bg-surface-elevated p-6 rounded-3xl border border-border-subtle shadow-sm">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
            Pending Requests
          </p>
          <p className="text-3xl font-black text-indigo-600">{statusCounts.pending}</p>
        </div>
        <div className="bg-surface-elevated p-6 rounded-3xl border border-border-subtle shadow-sm">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
            Confirmed Guests
          </p>
          <p className="text-3xl font-black text-text-primary">{totalGuests}</p>
        </div>
        <div className="bg-surface-elevated p-6 rounded-3xl border border-border-subtle shadow-sm">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
            Revenue (Approved)
          </p>
          <div className="flex items-center gap-1">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
            <p className="text-3xl font-black text-emerald-600">
              {totalRevenue.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-surface-elevated rounded-[2.5rem] border border-border-subtle shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-text-placeholder animate-spin mx-auto" />
            <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">
              Loading reservations…
            </p>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-16 h-16 bg-surface-tertiary rounded-full flex items-center justify-center mx-auto">
              <Search className="w-6 h-6 text-text-placeholder" />
            </div>
            <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">
              No {filter} reservations
            </p>
            {filter === 'pending' && (
              <p className="text-text-placeholder text-xs max-w-sm mx-auto">
                When guests request a reservation via your venue page, they'll appear here for your
                approval.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-tertiary border-b border-border-subtle text-left">
                  <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                    Guest
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                    Type
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                    Date & Time
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                    Guests
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                    Amount
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredReservations.map((res) => (
                  <motion.tr
                    key={res.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-surface-tertiary/50 transition-all"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-secondary rounded-xl flex items-center justify-center text-text-tertiary font-black text-sm">
                          {res.guestName?.[0] || 'G'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-primary">
                            {res.guestName || 'Guest'}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {res.guestPhone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-text-placeholder" />
                                <span className="text-[10px] text-text-tertiary font-medium">
                                  {res.guestPhone}
                                </span>
                              </div>
                            )}
                          </div>
                          {res.specialRequests && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <MessageSquare className="w-3 h-3 text-amber-400" />
                              <span className="text-[10px] text-amber-600 font-medium italic truncate max-w-[200px]">
                                "{res.specialRequests}"
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        {res.bookingType === 'event' ? (
                          <>
                            <Music className="w-4 h-4 text-purple-400" />
                            <div>
                              <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
                                Event
                              </p>
                              {res.eventTitle && (
                                <p className="text-[10px] text-text-tertiary font-medium mt-0.5">
                                  {res.eventTitle}
                                </p>
                              )}
                              {res.tableName && (
                                <p className="text-[10px] text-text-tertiary font-medium">
                                  {res.tableName}
                                </p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <Utensils className="w-4 h-4 text-accent-primary" />
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                              Restaurant
                            </p>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-text-secondary">
                        <Calendar className="w-4 h-4 text-text-placeholder" />
                        {formatDate(res.date)}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-tertiary font-bold mt-1">
                        <Clock className="w-3 h-3 text-text-placeholder" />
                        {formatTime(res.time) || '—'}
                      </div>
                      <p className="text-[9px] text-text-placeholder mt-1">
                        {timeAgo(res.createdAt)}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                        <Users className="w-4 h-4 text-text-placeholder" />
                        {res.guests}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {res.totalAmount ? (
                        <div className="flex items-center gap-1 text-sm font-bold text-text-primary">
                          <IndianRupee className="w-3.5 h-3.5 text-text-tertiary" />
                          {res.totalAmount.toLocaleString('en-IN')}
                        </div>
                      ) : (
                        <span className="text-[10px] text-text-placeholder font-bold uppercase tracking-widest">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          res.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : res.status === 'rejected'
                              ? 'bg-red-50 text-red-600 border-red-100'
                              : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}
                      >
                        {res.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {res.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAction(res.id, 'approved')}
                            disabled={processingId === res.id}
                            className="h-10 px-4 bg-green-500 text-text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
                          >
                            {processingId === res.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(res.id, 'rejected')}
                            disabled={processingId === res.id}
                            className="h-10 px-4 bg-surface-elevated border border-border-default text-text-tertiary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button className="p-2 text-text-placeholder hover:text-text-secondary transition-colors">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
