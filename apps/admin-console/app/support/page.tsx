'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  User,
  ChevronRight,
  CheckCircle2,
  Mail,
  Calendar,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

interface Ticket {
  id: string;
  subject?: string;
  userEmail?: string;
  priority?: string;
  status?: string;
  message?: string;
  createdAt?: string;
}

export default function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSupport = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=support_tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { data: Ticket[] };
      setTickets(json.data || []);
    } catch (err) {
      console.error('Failed to fetch support tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchSupport();
  }, [user]);

  const columns = useMemo(
    () => [
      {
        header: 'Inquiry Subject',
        accessorKey: 'subject',
        cell: ({ row }: { row: { original: Ticket } }) => (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white tracking-tight uppercase">
              {row.original.subject || 'Support Message'}
            </span>
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest font-mono">
              ID: {row.original.id?.slice(-8).toUpperCase()}
            </span>
          </div>
        ),
      },
      {
        header: 'Customer',
        accessorKey: 'userEmail',
        cell: ({ getValue }: { getValue: () => string }) => (
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-zinc-700" strokeWidth={2} />
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest truncate max-w-[200px]">
              {getValue() || 'Anonymous'}
            </span>
          </div>
        ),
      },
      {
        header: 'Priority',
        accessorKey: 'priority',
        cell: ({ getValue }: { getValue: () => string }) => {
          const priority = getValue();
          return (
            <div
              className={`inline-flex items-center px-2 py-0.5 rounded border ${priority === 'high' ? 'bg-iris/10 text-iris border-iris/20' : 'bg-white/5 text-zinc-600 border-white/5'}`}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest">
                {priority || 'Normal'}
              </span>
            </div>
          );
        },
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue }: { getValue: () => string }) => {
          const status = getValue();
          const isOpen = status === 'open';
          return (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border ${isOpen ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
            >
              <div
                className={`h-1 w-1 rounded-full ${isOpen ? 'bg-amber-500' : 'bg-emerald-500'}`}
              />
              <span className="text-[9px] font-bold uppercase tracking-widest">
                {status?.toUpperCase() || 'RESOLVED'}
              </span>
            </div>
          );
        },
      },
      {
        header: '',
        id: 'actions',
        cell: ({ row }: { row: { original: Ticket } }) => (
          <div className="flex justify-end">
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setSelectedTicket(row.original);
                setIsDrawerOpen(true);
              }}
              className="p-2 hover:bg-white/5 rounded-lg text-zinc-600 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    return tickets.filter(
      (t: Ticket) =>
        t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [tickets, searchTerm]);

  const resolveTicket = async (): Promise<void> => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'SUPPORT_RESOLVE',
          targetId: selectedTicket!.id,
          params: { type: 'ticket' },
        }),
      });
      if (res.ok) {
        await fetchSupport();
        setIsDrawerOpen(false);
      }
    } catch (err) {
      console.error('Failed to resolve ticket', err);
    }
  };

  if (loading) return <PageSkeleton sections={['header', 'kpi', 'table']} />;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Concierge Desk
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Help Center</h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Review and resolve incoming customer inquiries and technical issues.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-5 py-2.5 bg-white/[0.02] border border-[#ffffff05] rounded-xl flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white leading-tight font-mono-numbers">
                {tickets.filter((t: Ticket) => t.status === 'open').length}
              </span>
              <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">
                Unresolved
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="relative group px-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
          <input
            type="text"
            placeholder="Look up messages by subject, email, or request ID..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white shadow-inner"
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          onRowClick={(row: Ticket) => {
            setSelectedTicket(row);
            setIsDrawerOpen(true);
          }}
        />
      </div>

      <ActionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Support Inquiry"
        subtitle="Customer Communications Ledger"
      >
        {selectedTicket && (
          <div className="space-y-8">
            <div
              className={`p-6 rounded-xl border ${selectedTicket.status === 'open' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Inquiry Lifecycle
                </span>
                <div
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${selectedTicket.status === 'open' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}
                >
                  {selectedTicket.status || 'Resolved'}
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white tracking-tight uppercase leading-snug">
                {selectedTicket.subject || 'Support Message'}
              </h3>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                Origin Details
              </h4>
              <div className="grid grid-cols-1 gap-px bg-[#ffffff08] border border-[#ffffff08] rounded-xl overflow-hidden shadow-inner font-mono">
                <div className="bg-obsidian-surface p-4 flex items-center gap-4">
                  <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                      Email Address
                    </span>
                    <span className="text-[11px] font-bold text-white uppercase">
                      {selectedTicket.userEmail || 'Anonymous'}
                    </span>
                  </div>
                </div>
                <div className="bg-obsidian-surface p-4 flex items-center gap-4 border-t border-[#ffffff05]">
                  <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                      Registry Date
                    </span>
                    <span className="text-[11px] font-bold text-white uppercase">
                      {selectedTicket.createdAt
                        ? new Date(selectedTicket.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                Message Content
              </h4>
              <div className="p-6 rounded-xl bg-white/[0.02] border border-[#ffffff05] shadow-inner font-mono">
                <p className="text-sm font-medium text-zinc-400 italic leading-relaxed uppercase tracking-tight">
                  &quot;{selectedTicket.message || 'No additional message body provided.'}&quot;
                </p>
              </div>
            </div>

            {selectedTicket.status === 'open' && (
              <div className="space-y-4 pt-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                  Resolution Protocol
                </h4>
                <button
                  onClick={resolveTicket}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all font-bold text-[11px] uppercase tracking-widest font-mono shadow-lg shadow-emerald-500/5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as Resolved
                </button>
              </div>
            )}
          </div>
        )}
      </ActionDrawer>
    </div>
  );
}
