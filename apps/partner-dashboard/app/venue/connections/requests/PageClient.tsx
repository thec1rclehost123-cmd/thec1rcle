'use client';

import { useState, useCallback, useEffect } from 'react';
import { UserCircle, Clock, X, Loader2, Zap, Send } from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { formatRelativeDate } from '@/lib/utils/format';
import { motion, AnimatePresence } from 'framer-motion';

export default function VenueConnectionsPage() {
  const { profile, user } = useDashboardAuth();
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const venueId = profile?.activeMembership?.partnerId;
  const venueName = profile?.displayName;

  const fetchData = useCallback(async () => {
    if (!venueId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/discovery?action=list&partnerId=${venueId}&role=venue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setConnections(data.connections || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [venueId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (connectionId: string, action: 'approve' | 'reject', type: string) => {
    setProcessingRequest(connectionId);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/discovery', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          connectionId,
          action,
          type,
          role: 'venue',
          partnerId: venueId,
          partnerName: venueName,
        }),
      });
      if (!res.ok) throw new Error('Failed to process request');
      await fetchData();
    } catch (err: any) {
      console.error(`Failed to ${action} request:`, err);
      alert(err.message || `Failed to ${action} request`);
    } finally {
      setProcessingRequest(null);
    }
  };

  const allPending = connections
    .filter((c: any) => c.status === 'pending')
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Incoming = host/promoter sent the request to the venue (venue should approve)
  // Outgoing = venue sent the request to the host (host should approve)
  const incoming = allPending.filter((c: any) => c.initiatedBy !== 'venue');
  const outgoing = allPending.filter((c: any) => c.initiatedBy === 'venue');

  const isEmpty = incoming.length === 0 && outgoing.length === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div className="min-h-[600px] max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-body-sm font-semibold text-text-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-tertiary" />
              Pending Connection Requests
            </h3>
            <span className="text-label text-text-tertiary bg-surface-secondary px-2 py-1 rounded-md">
              {incoming.length} Incoming
            </span>
          </div>

          {error && (
            <div className="flex flex-col items-center justify-center py-16 rounded-[40px] border border-red-500/20 bg-red-500/5 gap-4 text-center">
              <p className="text-[16px] font-black text-text-primary">Failed to load requests</p>
              <button
                onClick={fetchData}
                className="h-11 px-8 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-primary text-[13px] font-black uppercase tracking-widest hover:bg-surface-elevated transition-all"
              >
                Retry
              </button>
            </div>
          )}

          {!error && (
            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="p-20 flex justify-center">
                  <Loader2 className="w-8 h-8 text-text-placeholder animate-spin" />
                </div>
              ) : isEmpty ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-24 bg-surface-secondary dark:bg-[#0D0D0F] border-2 border-dashed border-border-default rounded-[3rem] flex flex-col items-center text-center px-10"
                >
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
                    <Clock className="w-8 h-8 text-orange-500" />
                  </div>
                  <h4 className="text-2xl font-black text-text-primary uppercase tracking-tight">
                    Quiet for now
                  </h4>
                  <p className="text-body-sm text-text-secondary mt-2 max-w-xs">
                    Incoming partnership requests from hosts and promoters will appear here.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-8">
                  {/* Incoming requests — venue must approve these */}
                  {incoming.length > 0 && (
                    <div className="space-y-4">
                      {incoming.map((request: any) => (
                        <motion.div
                          key={request.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group relative overflow-hidden bg-surface-secondary dark:bg-[#121216] border border-border-subtle p-6 rounded-[2rem]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-2xl bg-surface-tertiary border border-border-subtle flex items-center justify-center text-2xl font-black text-text-primary shadow-xl">
                                {(request.otherName?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-text-primary tracking-tight">
                                  {request.otherName || 'Unknown'}
                                </h3>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-500">
                                    {request.type === 'promoter_connection' ? (
                                      <Zap className="w-3.5 h-3.5" />
                                    ) : (
                                      <UserCircle className="w-3.5 h-3.5" />
                                    )}
                                    {request.type === 'promoter_connection' ? 'Promoter' : 'Host'}
                                  </span>
                                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                    •
                                  </span>
                                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                    {formatRelativeDate(request.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleAction(request.id, 'approve', request.type)}
                                disabled={!!processingRequest}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                              >
                                {processingRequest === request.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Approve'
                                )}
                              </button>
                              <button
                                onClick={() => handleAction(request.id, 'reject', request.type)}
                                disabled={!!processingRequest}
                                className="h-12 w-12 rounded-xl bg-surface-tertiary border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {request.message && (
                            <div className="mt-5 p-4 bg-surface-tertiary/50 rounded-2xl border border-border-subtle">
                              <p className="text-[13px] text-text-secondary italic">
                                "{request.message}"
                              </p>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Outgoing requests — venue sent these, awaiting host approval */}
                  {outgoing.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-text-tertiary px-2 flex items-center gap-2">
                        <Send className="w-3.5 h-3.5" />
                        Sent · Awaiting host approval
                      </p>
                      {outgoing.map((request: any) => (
                        <motion.div
                          key={request.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group relative overflow-hidden bg-surface-secondary dark:bg-[#121216] border border-border-subtle p-6 rounded-[2rem] opacity-80"
                        >
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-2xl bg-surface-tertiary border border-border-subtle flex items-center justify-center text-2xl font-black text-text-primary shadow-xl">
                                {(request.otherName?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-text-primary tracking-tight">
                                  {request.otherName || 'Unknown'}
                                </h3>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-500">
                                    {request.type === 'promoter_connection' ? (
                                      <Zap className="w-3.5 h-3.5" />
                                    ) : (
                                      <UserCircle className="w-3.5 h-3.5" />
                                    )}
                                    {request.type === 'promoter_connection' ? 'Promoter' : 'Host'}
                                  </span>
                                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                    •
                                  </span>
                                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                    {formatRelativeDate(request.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                                Awaiting approval
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
