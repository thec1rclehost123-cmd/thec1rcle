// @ts-nocheck
'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useState, useMemo, type ChangeEvent, type ComponentType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Building2,
  Users,
  Zap,
  Clock,
  ChevronRight,
  MapPin,
  Phone,
  ShieldCheck,
  Briefcase,
  Instagram,
  Activity,
  X,
  CircleDashed,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useToast } from '@/components/providers/ToastProvider';
import { apiGet, apiPost, getToken } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/queryKeys';

interface OnboardingRequestData {
  name?: string;
  email?: string;
  plan?: string;
  isVerified?: boolean;
  area?: string;
  city?: string;
  contactPerson?: string;
  phone?: string;
  instagram?: string;
  bio?: string;
  capacity?: string;
  role?: string;
}

interface OnboardingRequest {
  id: string;
  type: string;
  entityType?: string;
  status: string;
  submittedAt?: string;
  data?: OnboardingRequestData;
}

interface OnboardingListResponse {
  data?: OnboardingRequest[];
}

interface ModalConfig {
  action: string;
  title: string;
  message: string;
  label: string;
  type: string;
  inputLabel?: string;
  inputPlaceholder?: string;
}

export default function AdminApprovals() {
  const { user } = useAuth() as { user: any };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReq, setSelectedReq] = useState<OnboardingRequest | null>(null);
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [pendingPlan, setPendingPlan] = useState<string | undefined>(undefined);
  const [pendingVerified, setPendingVerified] = useState<boolean | undefined>(undefined);

  const [cursorStack, setCursorStack] = useState<Array<string | null>>([]);
  const [pageCursor, setPageCursor] = useState<string | null>(null);

  const buildUrl = (cursor: string | null) => {
    const params = new URLSearchParams({ collection: 'onboarding_requests', limit: '25' });
    if (cursor) params.set('cursor', cursor);
    return `/api/list?${params}`;
  };

  const { data, isLoading } = useQuery<{ data: OnboardingRequest[]; hasMore: boolean; nextCursor: string | null }>({
    queryKey: [...queryKeys.approvals.list(), pageCursor],
    queryFn: async () => {
      const token = await user.getIdToken();
      const json = await apiGet<{ data: OnboardingRequest[]; hasMore?: boolean; nextCursor?: string | null }>(buildUrl(pageCursor), token);
      const sorted = (json.data || []).sort(
        (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime(),
      );
      return { data: sorted, hasMore: json.hasMore ?? false, nextCursor: json.nextCursor ?? null };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const requests = data?.data ?? [];
  const hasMore = data?.hasMore ?? false;

  const actionMutation = useMutation({
    mutationFn: async ({ action, reason, evidence, changesMessage }: { action: string; reason: string; evidence: string; changesMessage?: string }) => {
      const token = await user.getIdToken();
      return apiPost('/api/actions', {
        action,
        targetId: selectedReq!.id,
        reason,
        evidence,
        params: {
          type: selectedReq!.type || 'onboarding_request',
          plan: pendingPlan ?? selectedReq!.data?.plan,
          isVerified: pendingVerified ?? selectedReq!.data?.isVerified,
          changesMessage,
        },
      }, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
      toast({ message: 'Action applied successfully.', type: 'success' });
      setSelectedReq(null);
      setModalConfig(null);
      setPendingPlan(undefined);
      setPendingVerified(undefined);
    },
    onError: (err: Error) => {
      toast({ message: err.message, type: 'error' });
    },
  });

  const handleAction = async (reason: string, targetId: string, inputValue: string, evidence: string) => {
    if (!modalConfig || !selectedReq) return;
    actionMutation.mutate({
      action: modalConfig.action,
      reason,
      evidence,
      changesMessage: inputValue || undefined,
    });
    throw new Error('Handled by mutation');
  };

  const filtered = useMemo(() => {
    return requests.filter((r: OnboardingRequest) => {
      const matchesSearch =
        r.data?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.data?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'all' || r.type === filter;
      const matchesEntity = entityFilter === 'all' || r.entityType === entityFilter;
      return matchesSearch && matchesFilter && matchesEntity;
    });
  }, [requests, searchTerm, filter, entityFilter]);

  const handleNextPage = () => {
    if (!hasMore || !data?.nextCursor) return;
    setCursorStack((prev) => [...prev, pageCursor]);
    setPageCursor(data.nextCursor);
  };

  const handlePrevPage = () => {
    if (cursorStack.length === 0) return;
    const newStack = [...cursorStack];
    const prevCursor = newStack.pop() ?? null;
    setCursorStack(newStack);
    setPageCursor(prevCursor);
  };

  if (isLoading) return <PageSkeleton sections={['header', 'kpi', 'table']} />;

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Pending Queue
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            Partner Applications
          </h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Review and verify new partner requests for the C1rcle community.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px] group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Search queue by name, email or reference tag..."
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-medium placeholder:text-zinc-600 text-white"
          />
        </div>
        <div className="flex gap-1.5 p-1 bg-black/40 rounded-lg border border-[#ffffff05]">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
          <FilterButton
            active={filter === 'venue'}
            onClick={() => setFilter('venue')}
            label="Venues"
            icon={Building2}
          />
          <FilterButton
            active={filter === 'host'}
            onClick={() => setFilter('host')}
            label="Hosts"
            icon={Users}
          />
          <FilterButton
            active={filter === 'promoter'}
            onClick={() => setFilter('promoter')}
            label="Promoters"
            icon={Zap}
          />
        </div>
        <div className="flex gap-1.5 p-1 bg-black/40 rounded-lg border border-[#ffffff05]">
          <FilterButton
            active={entityFilter === 'all'}
            onClick={() => setEntityFilter('all')}
            label="All Entities"
          />
          <FilterButton
            active={entityFilter === 'individual'}
            onClick={() => setEntityFilter('individual')}
            label="Individual"
            icon={Users}
          />
          <FilterButton
            active={entityFilter === 'business'}
            onClick={() => setEntityFilter('business')}
            label="Business"
            icon={Building2}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Partner Details
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Type
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 hidden sm:table-cell">
                    Entity
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Date
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Status
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffffff05]">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i: number) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-6">
                        <div className="h-4 bg-white/5 rounded-full w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <EmptyState
                        title="Queue clear"
                        description="No pending requests detected."
                        icon={<Clock className="h-8 w-8" />}
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((r: OnboardingRequest) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReq(r)}
                      className={`group cursor-pointer transition-colors ${selectedReq?.id === r.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-xs ${r.type === 'venue' ? 'bg-zinc-900 border border-white/5' : r.type === 'host' ? 'bg-white/5 border border-white/10' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}
                          >
                            {r.data?.name?.[0] || 'E'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {r.data?.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-medium truncate">
                              {r.data?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          {r.type}
                        </span>
                      </td>
                      <td className="px-6 py-5 hidden sm:table-cell">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${r.entityType === 'business' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
                        >
                          {r.entityType || 'Individual'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-[10px] font-mono-numbers text-zinc-500">
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'LEGACY'}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-white transition-colors" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            itemCount={filtered.length}
            hasMore={hasMore}
            loading={isLoading}
            onNext={handleNextPage}
            onPrev={handlePrevPage}
            canGoPrev={cursorStack.length > 0}
            label="request"
          />
        </div>

        <aside className="lg:col-span-4 h-fit">
          {selectedReq ? (
            <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-6 space-y-8 shadow-2xl relative">
                <button
                  onClick={() => setSelectedReq(null)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>

                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      Application Details
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${selectedReq.entityType === 'business' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
                      >
                        {selectedReq.entityType || 'Individual'}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${selectedReq.type === 'venue' ? 'bg-zinc-900 border-white/5 text-zinc-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
                      >
                        {selectedReq.type === 'venue'
                          ? `${selectedReq.data?.plan || 'STND'} Tier`
                          : selectedReq.type}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white">
                    {selectedReq.data?.name}
                  </h3>
                  <div className="space-y-2 pt-2">
                    <DetailItem
                      icon={MapPin}
                      label="Location"
                      value={`${selectedReq.data?.area}, ${selectedReq.data?.city}`}
                    />
                    <DetailItem
                      icon={Briefcase}
                      label="Contact Person"
                      value={selectedReq.data?.contactPerson}
                    />
                    <DetailItem icon={Phone} label="Phone Number" value={selectedReq.data?.phone} />
                    {selectedReq.data?.instagram && (
                      <DetailItem
                        icon={Instagram}
                        label="Instagram"
                        value={selectedReq.data?.instagram}
                      />
                    )}
                    {selectedReq.data?.bio && (
                      <DetailItem icon={Activity} label="About" value={selectedReq.data?.bio} />
                    )}
                    {selectedReq.data?.capacity && (
                      <DetailItem
                        icon={Users}
                        label="Capacity"
                        value={selectedReq.data?.capacity}
                      />
                    )}
                    {selectedReq.data?.role && (
                      <DetailItem icon={Zap} label="Role" value={selectedReq.data?.role} />
                    )}
                  </div>
                </div>

                {selectedReq.status === 'pending' || selectedReq.status === 'changes_requested' ? (
                  <div className="space-y-6 pt-6 border-t border-[#ffffff05]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                      Actions
                    </p>

                    <div className="space-y-3">
                      {selectedReq.status === 'pending' && (
                        <div className="space-y-4 p-4 rounded-lg bg-white/[0.02] border border-[#ffffff05]">
                          <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                            Account Setup
                          </h4>

                          {selectedReq.type === 'venue' && (
                            <div>
                              <label className="text-[9px] font-bold text-zinc-600 mb-1.5 block uppercase">
                                Membership Plan
                              </label>
                              <select
                                value={pendingPlan ?? selectedReq.data?.plan ?? 'basic'}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setPendingPlan(e.target.value)}
                                className="w-full bg-black/40 border border-[#ffffff08] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white/10"
                              >
                                <option value="basic">Basic Plan</option>
                                <option value="silver">Silver Plan</option>
                                <option value="gold">Gold Plan</option>
                                <option value="diamond">Diamond Plan</option>
                              </select>
                            </div>
                          )}

                          {selectedReq.type === 'host' && (
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-bold text-zinc-600 uppercase">
                                Identity Badge
                              </label>
                              <button
                                onClick={() => setPendingVerified((prev) => !(prev ?? selectedReq.data?.isVerified ?? true))}
                                className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${
                                  (pendingVerified ?? selectedReq.data?.isVerified ?? true)
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : 'bg-zinc-900 text-zinc-600 border-white/5'
                                }`}
                              >
                                {(pendingVerified ?? selectedReq.data?.isVerified ?? true) ? 'Verified' : 'Unverified'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() =>
                          setModalConfig({
                            action: 'ONBOARDING_APPROVE',
                            title: 'APPROVE APPLICATION',
                            message: `Create account and give access for ${selectedReq.data?.email}. Plan: ${pendingPlan || selectedReq.data?.plan || 'Standard'}.`,
                            label: 'CONFIRM APPROVAL',
                            type: 'info',
                          })
                        }
                        disabled={actionMutation.isPending}
                        className="w-full bg-emerald-600 text-white h-11 rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {actionMutation.isPending ? (
                          <CircleDashed className="w-4 h-4 animate-spin" />
                        ) : null}
                        Approve Partner
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              setModalConfig({
                                action: 'ONBOARDING_REQUEST_CHANGES',
                                title: 'REQUEST CHANGES',
                                message:
                                  'Ask the applicant to update their information before approval.',
                                label: 'SEND REQUEST',
                                type: 'warning',
                                inputLabel: 'Message to Partner',
                                inputPlaceholder: 'List what needs to be changed...',
                              })
                            }
                            disabled={actionMutation.isPending}
                            className="bg-white/5 border border-white/5 text-zinc-300 h-10 rounded-lg font-bold uppercase tracking-widest text-[9px] hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Ask for Changes
                          </button>
                          <button
                            onClick={() =>
                              setModalConfig({
                                action: 'ONBOARDING_REJECT',
                                title: 'REJECT APPLICATION',
                                message:
                                  'Permanently decline this application. This action cannot be undone.',
                                label: 'CONFIRM REJECT',
                                type: 'danger',
                                inputLabel: 'Reason for Rejection',
                                inputPlaceholder: 'Enter reason...',
                              })
                            }
                            disabled={actionMutation.isPending}
                            className="bg-iris/10 border border-iris/20 text-iris h-10 rounded-lg font-bold uppercase tracking-widest text-[9px] hover:bg-iris/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Reject
                          </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-6 border-t border-[#ffffff05]">
                    <div className="p-6 rounded-lg bg-white/[0.01] border border-[#ffffff05] text-center">
                      <ShieldCheck className="h-6 w-6 text-zinc-800 mx-auto mb-3" strokeWidth={1} />
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                        Application Processed
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-400 mt-1">
                        Reviewed by Admin
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
              <Clock className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                System monitoring pipeline
                <br />
                for ingestion spikes.
              </p>
            </div>
          )}
        </aside>
      </div>

      {modalConfig && (
        <AdminConfirmModal
          isOpen={!!modalConfig}
          onClose={() => setModalConfig(null)}
          onConfirm={handleAction}
          title={modalConfig.title}
          message={modalConfig.message}
          actionLabel={modalConfig.label}
          type={modalConfig.type}
          inputLabel={modalConfig.inputLabel as any}
          inputPlaceholder={modalConfig.inputPlaceholder as string | undefined}
        />
      )}
    </div>
  );
}

function FilterButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon?: ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
        active ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'
      }`}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending:
      'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
    approved:
      'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
    rejected: 'bg-iris/10 border-iris/20 text-iris shadow-[0_0_8px_rgba(244,74,34,0.2)]',
    changes_requested: 'bg-white/5 border-white/10 text-zinc-400',
  };
  const labels: Record<string, string> = {
    pending: 'Pending',
    approved: 'Verified',
    rejected: 'Declined',
    changes_requested: 'Needs Update',
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border ${configs[status] || 'bg-zinc-900 border-white/5 text-zinc-600'}`}
    >
      {labels[status] || status.replace(/_/g, ' ')}
    </span>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string; strokeWidth?: number }>; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-all group">
      <div className="h-9 w-9 min-w-[2.25rem] rounded-md bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 transition-colors">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">
          {label}
        </p>
        <p className="text-[11px] font-semibold text-zinc-300 truncate">{value || 'NOT_FOUND'}</p>
      </div>
    </div>
  );
}
