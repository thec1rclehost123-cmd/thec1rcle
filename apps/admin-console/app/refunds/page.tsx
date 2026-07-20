'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Check,
  X,
  Clock,
  DollarSign,
  User,
  Shield,
  ArrowRight,
  CircleDashed,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import { Pagination } from '@/components/ui/Pagination';
import { apiGet, apiPost, getToken } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/queryKeys';

interface RefundRequest {
  id: string;
  orderId: string;
  eventId: string;
  eventName?: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'rejected';
  approvalType: 'auto' | 'single' | 'dual';
  approversRequired: number;
  approvers: Array<{ uid: string; name: string; at: string }>;
  createdAt: string;
  isPartial: boolean;
}

interface RefundListResponse {
  refunds: RefundRequest[];
  hasMore: boolean;
  nextCursor: string | null;
}

export default function RefundsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([]);
  const [pageCursors, setPageCursors] = useState<{ current: string | null; next: string | null }>({
    current: null,
    next: null,
  });

  const buildUrl = (cursor: string | null) => {
    const params = new URLSearchParams({ status: filter, limit: '25' });
    if (cursor) params.set('cursor', cursor);
    return `/api/admin/refunds?${params}`;
  };

  const { data, isLoading } = useQuery<RefundListResponse>({
    queryKey: [...queryKeys.refunds.list(filter), pageCursors.current],
    queryFn: async () => {
      const token = await getToken(user);
      return apiGet<RefundListResponse>(buildUrl(pageCursors.current), token);
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  const refundRequests = data?.refunds ?? [];
  const hasMore = data?.hasMore ?? false;
  const currentCursor = data?.nextCursor ?? null;

  const approveMutation = useMutation({
    mutationFn: async (refundId: string) => {
      const token = await getToken(user);
      return apiPost(`/api/admin/refunds/${refundId}/approve`, {}, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds.all });
      setIsDrawerOpen(false);
      setSelectedRefund(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ refundId, reason }: { refundId: string; reason: string }) => {
      const token = await getToken(user);
      return apiPost(`/api/admin/refunds/${refundId}/reject`, { reason }, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds.all });
      setIsDrawerOpen(false);
      setSelectedRefund(null);
    },
  });

  const handleNextPage = () => {
    if (!hasMore || !currentCursor) return;
    setCursorStack((prev) => [...prev, pageCursors.current]);
    setPageCursors({ current: currentCursor, next: null });
  };

  const handlePrevPage = () => {
    if (cursorStack.length === 0) return;
    const newStack = [...cursorStack];
    const prevCursor = newStack.pop() ?? null;
    setCursorStack(newStack);
    setPageCursors({ current: prevCursor, next: null });
  };

  const getStatusStyle = (status: string) => {
    const styles = {
      pending: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
      approved: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
      processing: 'bg-iris/10 border-iris/20 text-iris',
      completed: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
      failed: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
      rejected: 'bg-zinc-800 border-white/5 text-zinc-500',
    };
    return styles[status] || styles.pending;
  };

  const filteredRefunds = useMemo(() => {
    return refundRequests;
  }, [refundRequests]);

  const columns = [
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (val: number, row: RefundRequest) => (
        <div>
          <p className="text-sm font-bold text-white tracking-tight">
            ₹{(val ?? 0).toLocaleString()}
          </p>
          {row.isPartial && (
            <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">
              Partial
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      render: (val: string, row: RefundRequest) => (
        <div>
          <p className="text-sm font-semibold text-white truncate">
            {val || row.customerEmail || 'Anonymous'}
          </p>
          <p className="text-[10px] text-zinc-500 font-medium truncate uppercase tracking-tighter mt-0.5">
            {row.eventName}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val: string, row: RefundRequest) => (
        <div className="flex items-center gap-2">
          <div
            className={`h-1.5 w-1.5 rounded-full ${val === 'pending' ? 'bg-amber-500' : val === 'approved' || val === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          <span
            className={`text-[10px] font-bold uppercase tracking-widest ${val === 'pending' ? 'text-amber-500' : val === 'approved' || val === 'completed' ? 'text-emerald-500' : 'text-rose-500'}`}
          >
            {val}
          </span>
        </div>
      ),
    },
    {
      key: 'approversRequired',
      label: 'Verification',
      sortable: true,
      render: (val: number, row: RefundRequest) => (
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1.5">
            {[...Array(val)].map((_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border border-obsidian-surface flex items-center justify-center transition-colors ${
                  i < row.approvers.length
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                {i < row.approvers.length ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <User className="w-2.5 h-2.5" />
                )}
              </div>
            ))}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
            {row.approvers.length}/{val}
          </span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Timeline',
      sortable: true,
      render: (val: string) => (
        <div className="text-right">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            {val
              ? new Date(val).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-12 pb-24">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-iris" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">
              Financial Operations
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            Refund Processing
          </h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Review customer refund requests, authorize payments, and manage financial disputes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const headers = [
                'ID',
                'Order ID',
                'Event',
                'Customer',
                'Email',
                'Amount',
                'Status',
                'Date',
              ];
              const rows = filteredRefunds.map((r) => [
                r.id,
                r.orderId,
                r.eventName || 'N/A',
                r.customerName || 'N/A',
                r.customerEmail || 'N/A',
                r.amount,
                r.status,
                r.createdAt ? new Date(r.createdAt).toISOString() : 'N/A',
              ]);

              const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `refund_history_${new Date().toISOString().slice(0, 10)}.csv`;
              link.click();
            }}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
          >
            <ArrowRight className="w-4 h-4" />
            Export History
          </button>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.refunds.all });
              setPageCursors({ current: null, next: null });
              setCursorStack([]);
            }}
            disabled={isLoading}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
          <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
            <Clock className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">
              Awaiting Review
            </p>
            <p className="text-3xl font-light text-white tracking-tight font-mono-numbers">
              {refundRequests.filter((r) => r.status === 'pending').length}
            </p>
          </div>
        </div>
        <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
          <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
            <Shield className="h-5 w-5 text-iris" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">
              Verification Needed
            </p>
            <p className="text-3xl font-light text-white tracking-tight font-mono-numbers text-iris">
              {
                refundRequests.filter((r) => r.approvalType === 'dual' && r.status === 'pending')
                  .length
              }
            </p>
          </div>
        </div>
        <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
          <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
            <DollarSign className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">
              Total Payout Value
            </p>
            <p className="text-3xl font-light text-white tracking-tight font-mono-numbers">
              ₹
              {refundRequests
                .filter((r) => r.status === 'pending')
                .reduce((sum, r) => sum + r.amount, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['pending', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              filter === f
                ? 'bg-white text-black shadow-lg shadow-white/5'
                : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10'
            }`}
          >
            {f === 'pending' ? 'Active Requests' : 'Full History'}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredRefunds}
        searchPlaceholder="Search by Customer, Event or Order ID..."
        onRowClick={(request) => {
          setSelectedRefund(request);
          setIsDrawerOpen(true);
        }}
      />

      <Pagination
        itemCount={refundRequests.length}
        hasMore={hasMore}
        loading={isLoading}
        onNext={handleNextPage}
        onPrev={handlePrevPage}
        canGoPrev={cursorStack.length > 0}
        label="refund"
      />

      <ActionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`Refund Request`}
        subtitle={`Ref: ${selectedRefund?.orderId}`}
        footer={
          selectedRefund?.status === 'pending' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => selectedRefund && approveMutation.mutate(selectedRefund.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="h-12 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {approveMutation.isPending ? (
                  <CircleDashed className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve
              </button>
              <button
                onClick={() =>
                  selectedRefund &&
                  rejectMutation.mutate({
                    refundId: selectedRefund.id,
                    reason: 'Declined by administration.',
                  })
                }
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="h-12 rounded-xl bg-white/5 border border-white/10 text-zinc-500 text-[11px] font-bold uppercase tracking-widest hover:text-rose-500 hover:border-rose-500/20 hover:bg-rose-500/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          )
        }
      >
        <div className="space-y-8">
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center space-y-4">
            <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-white shadow-inner">
              <DollarSign className="h-10 w-10 text-emerald-500/50" />
            </div>
            <div>
              <h3 className="text-4xl font-bold tracking-tight text-white mb-1.5">
                ₹{selectedRefund?.amount.toLocaleString()}
              </h3>
              <div className="flex items-center gap-2 justify-center">
                <div
                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${getStatusStyle(selectedRefund?.status || 'pending')}`}
                >
                  {selectedRefund?.status}
                </div>
                {selectedRefund?.isPartial && (
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest">
                    Partial Refund
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                Request Reason
              </p>
              <p className="text-sm text-zinc-300 font-medium leading-relaxed italic">
                &quot;{selectedRefund?.reason}&quot;
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                  Customer Profile
                </p>
                <p className="text-sm font-semibold text-white">{selectedRefund?.customerName}</p>
                <p className="text-xs text-zinc-500">{selectedRefund?.customerEmail}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                  Event Context
                </p>
                <p className="text-sm font-semibold text-zinc-300">{selectedRefund?.eventName}</p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                  Governing Verifications
                </p>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  {selectedRefund?.approvers.length} / {selectedRefund?.approversRequired} Secured
                </span>
              </div>

              <div className="space-y-3">
                {selectedRefund?.approvers.length === 0 ? (
                  <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest italic pt-1 text-center">
                    No verifications recorded.
                  </p>
                ) : (
                  selectedRefund?.approvers.map((approver, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.5} />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-white uppercase tracking-tight">
                            {approver.name}
                          </p>
                          <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
                            {new Date(approver.at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <Shield className="h-3.5 w-3.5 text-zinc-800" />
                    </div>
                  ))
                )}

                {selectedRefund &&
                  selectedRefund.approvers.length < selectedRefund.approversRequired && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-white/5 bg-transparent">
                      <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-zinc-700" />
                      </div>
                      <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-[0.15em]">
                        Pending Authority Signature
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </ActionDrawer>
    </div>
  );
}
