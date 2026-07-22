'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Calendar, User, Shield, Globe } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';

interface AuditEntry {
  id: string;
  adminId: string;
  adminName?: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  ipAddress?: string;
  timestamp: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  nextCursor?: string;
  prevCursor?: string;
}

export default function AuditTrailPage() {
  const { user } = useAuth();

  const [action, setAction] = useState('');
  const [adminId, setAdminId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [limit] = useState(50);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams({ type: 'audit', limit: String(limit) });
    if (action) params.set('action', action);
    if (adminId) params.set('adminId', adminId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (cursor) params.set('cursor', cursor);
    return `/api/logs?${params.toString()}`;
  }, [action, adminId, from, to, cursor, limit]);

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit-trail', action, adminId, from, to, cursor, limit],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const res = await fetch(buildUrl(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json() as Promise<AuditResponse>;
    },
    enabled: !!user,
  });

  const entries = data?.entries ?? [];
  const nextCursor = data?.nextCursor;
  const prevCursor = data?.prevCursor;

  const columns = [
    {
      header: 'Timestamp',
      accessorKey: 'timestamp',
      cell: ({ getValue }: { getValue: () => string }) => (
        <span className="text-[11px] font-mono-numbers text-white">
          {new Date(getValue()).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Admin',
      accessorKey: 'adminName',
      cell: ({ row }: { row: { original: AuditEntry } }) => (
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.5} />
          <span className="text-[10px] font-bold text-zinc-300">
            {row.original.adminName || row.original.adminId}
          </span>
        </div>
      ),
    },
    {
      header: 'Action',
      accessorKey: 'action',
      cell: ({ getValue }: { getValue: () => string }) => (
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">
          {getValue()}
        </span>
      ),
    },
    {
      header: 'Target',
      accessorKey: 'targetType',
      cell: ({ row }: { row: { original: AuditEntry } }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            {row.original.targetType || '—'}
          </span>
          <span className="text-[9px] text-zinc-600 font-mono">
            {row.original.targetId?.slice(0, 12) || ''}
          </span>
        </div>
      ),
    },
    {
      header: 'Details',
      accessorKey: 'details',
      cell: ({ getValue }: { getValue: () => string }) => (
        <span className="text-[10px] text-zinc-500 truncate max-w-[200px] block">
          {getValue() || '—'}
        </span>
      ),
    },
    {
      header: 'IP',
      accessorKey: 'ipAddress',
      cell: ({ getValue }: { getValue: () => string }) => (
        <div className="flex items-center gap-1.5">
          <Globe className="h-3 w-3 text-zinc-600" strokeWidth={1.5} />
          <span className="text-[9px] font-mono text-zinc-500">{getValue() || '—'}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Audit Trail
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            Audit Trail Viewer
          </h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Filterable history of all administrative actions across the platform.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            Action Type
          </label>
          <select
            value={action}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setAction(e.target.value);
              setCursor(undefined);
            }}
            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/10 appearance-none cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="USER_BAN">User Ban</option>
            <option value="WARNING_ISSUE">Warning Issued</option>
            <option value="CONTENT_REMOVE">Content Removed</option>
            <option value="PROMOTER_SUSPEND">Promoter Suspended</option>
            <option value="DATABASE_CORRECTION">Database Correction</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            Admin Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Admin ID or email..."
              value={adminId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setAdminId(e.target.value);
                setCursor(undefined);
              }}
              className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            From Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" strokeWidth={1.5} />
            <input
              type="date"
              value={from}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFrom(e.target.value);
                setCursor(undefined);
              }}
              className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            To Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" strokeWidth={1.5} />
            <input
              type="date"
              value={to}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setTo(e.target.value);
                setCursor(undefined);
              }}
              className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/10"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {entries.length > 0 ? (
        <DataTable columns={columns} data={entries} loading={isLoading} />
      ) : (
        !isLoading && (
          <EmptyState
            icon={Filter}
            title="No Audit Entries"
            description="No matching audit records found for the current filters."
          />
        )
      )}

      {/* Pagination */}
      {(prevCursor || nextCursor) && (
        <Pagination
          onPrev={prevCursor ? () => setCursor(prevCursor) : undefined}
          onNext={nextCursor ? () => setCursor(nextCursor) : undefined}
          hasPrev={!!prevCursor}
          hasNext={!!nextCursor}
        />
      )}
    </div>
  );
}
