'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Building2,
  User,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { apiGet, getToken } from '@/lib/api/client';

interface KycStepStatus {
  [stepId: string]: string;
}

interface KycRequest {
  id: string;
  uid: string;
  status?: string;
  kycOverallStatus?: string;
  kycStepStatus?: KycStepStatus;
  entityType?: string;
  data?: {
    name?: string;
    email?: string;
  };
  updatedAt?: string;
  createdAt?: string;
}

interface KycStatusMetaValue {
  label: string;
  color: string;
  bg: string;
}

const KYC_STATUS_META: Record<string, KycStatusMetaValue> = {
  not_started: { label: 'Not started', color: 'text-zinc-500', bg: 'bg-zinc-900 border-white/5' },
  in_progress: { label: 'In progress', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  partially_submitted: { label: 'Partial submit', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  fully_submitted: { label: 'Under review', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  partially_approved: { label: 'Partly approved', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  fully_verified: { label: 'Fully verified', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  action_required: { label: 'Action required', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

const PAGE_SIZE = 25;

function KycStatusBadge({ status }: { status: string }) {
  const meta = KYC_STATUS_META[status] || KYC_STATUS_META['not_started'];
  return (
    <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border ${meta.bg} ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export default function KycReviewQueue() {
  const { user } = useAuth() as { user: any };
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(0);

  const { data: requests, isLoading } = useQuery<KycRequest[]>({
    queryKey: ['kyc', 'requests'],
    queryFn: async () => {
      const token = await getToken(user);
      const json = await apiGet('/api/list?collection=onboarding_requests&limit=200', token);
      const relevant = (json.data || []).filter(
        (r: KycRequest) => r.status === 'approved' || r.kycOverallStatus,
      );
      return relevant.sort((a: KycRequest, b: KycRequest) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
        const bDate = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!requests) return [];
    return requests.filter((r: KycRequest) => {
      const kycStatus = r.kycOverallStatus || 'not_started';
      const matchesSearch =
        r.data?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.data?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.uid?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || kycStatus === statusFilter;
      const matchesEntity = entityFilter === 'all' || (r.entityType || 'individual') === entityFilter;
      return matchesSearch && matchesStatus && matchesEntity;
    });
  }, [requests, searchTerm, statusFilter, entityFilter]);

  const needsReview = useMemo(
    () => filtered.filter((r: KycRequest) =>
      ['fully_submitted', 'action_required', 'partially_submitted'].includes(r.kycOverallStatus ?? ''),
    ).length,
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage((p) => p + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage((p) => p - 1);
  };

  if (isLoading) return <PageSkeleton sections={['header', 'table']} />;

  return (
    <div className="space-y-10 pb-24">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-indigo-400" strokeWidth={1.5} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">
            KYC Review
          </span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
          Verification Queue
        </h1>
        <p className="text-sm text-zinc-500 font-medium">
          Review KYC documents and bank accounts submitted by approved partners.
          {needsReview > 0 && (
            <span className="ml-2 text-amber-400 font-bold">
              {needsReview} need{needsReview === 1 ? 's' : ''} review.
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px] group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Search by name, email or UID..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 text-white placeholder:text-zinc-600 font-medium"
          />
        </div>

        <div className="flex gap-1 p-1 bg-black/40 rounded-lg border border-[#ffffff05]">
          {[
            'all',
            'fully_submitted',
            'partially_submitted',
            'action_required',
            'partially_approved',
            'fully_verified',
          ].map((s: string) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              {s === 'all' ? 'All' : KYC_STATUS_META[s]?.label || s}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 bg-black/40 rounded-lg border border-[#ffffff05]">
          {[
            { value: 'all', label: 'All' },
            { value: 'individual', label: 'Individual', Icon: User },
            { value: 'business', label: 'Business', Icon: Building2 },
          ].map(({ value, label, Icon }: { value: string; label: string; Icon?: React.ComponentType<{ className?: string }> }) => (
            <button
              key={value}
              onClick={() => setEntityFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${entityFilter === value ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="No KYC Submissions"
          description="No KYC submissions match the current filter."
        />
      ) : (
        <>
          <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Partner</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 hidden sm:table-cell">Entity</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">KYC Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 hidden md:table-cell">Steps</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 hidden lg:table-cell">Updated</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffffff05]">
                {paged.map((r: KycRequest) => {
                  const kycStatus = r.kycOverallStatus || 'not_started';
                  const stepStatus = r.kycStepStatus || {};
                  const stepSequence =
                    r.entityType === 'business'
                      ? ['kyc_business', 'kyc_signatory', 'bank_setup']
                      : ['kyc_identity', 'bank_setup'];
                  const approvedCount = stepSequence.filter((s: string) => stepStatus[s] === 'approved').length;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/kyc-review/${r.uid}`)}
                      className="group cursor-pointer hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-white font-bold text-xs">
                            {r.data?.name?.[0] || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{r.data?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-zinc-500 font-medium truncate">{r.data?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 hidden sm:table-cell">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${r.entityType === 'business' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
                        >
                          {r.entityType || 'Individual'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <KycStatusBadge status={kycStatus} />
                      </td>
                      <td className="px-6 py-5 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          {stepSequence.map((s: string) => {
                            const st = stepStatus[s] || 'not_started';
                            if (st === 'approved')
                              return <CheckCircle2 key={s} className="h-3.5 w-3.5 text-emerald-500" />;
                            if (st === 'needs_resubmission')
                              return <AlertCircle key={s} className="h-3.5 w-3.5 text-red-400" />;
                            if (st === 'submitted' || st === 'under_review')
                              return <Clock key={s} className="h-3.5 w-3.5 text-amber-400" />;
                            return <Circle key={s} className="h-3.5 w-3.5 text-zinc-700" />;
                          })}
                          <span className="text-[10px] text-zinc-600 ml-1">{approvedCount}/{stepSequence.length}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 hidden lg:table-cell">
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-white transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            itemCount={paged.length}
            hasMore={currentPage < totalPages - 1}
            loading={false}
            onNext={handleNextPage}
            onPrev={handlePrevPage}
            canGoPrev={currentPage > 0}
            label="submission"
          />
        </>
      )}
    </div>
  );
}
