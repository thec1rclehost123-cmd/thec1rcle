'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, FileText, Calendar, Info } from 'lucide-react';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { BentoCard } from '@/components/ui/BentoCard';
import { LedgerTable } from '@/components/finance/LedgerTable';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import type {
  LedgerTransaction,
  TransactionCategory,
  SettlementStatus,
} from '@/lib/finance/definitions';

const PAGE_SIZE = 50;

// ── Report types ──────────────────────────────────────────────────────────────

interface ReportType {
  id: string;
  title: string;
  description: string;
  available: boolean;
  extension: 'csv' | 'pdf';
  comingSoon?: boolean;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'ledger_csv',
    title: 'Full Ledger Export',
    description: 'All transactions for the selected period in CSV format.',
    available: true,
    extension: 'csv',
  },
  {
    id: 'revenue_summary',
    title: 'Revenue Summary',
    description: 'Gross, net, fees, refunds, and partner obligations by source.',
    available: true,
    extension: 'csv',
  },
  {
    id: 'payout_history',
    title: 'Payout History',
    description: 'All payouts with status, amounts, dates, and destinations.',
    available: true,
    extension: 'csv',
  },
  {
    id: 'partner_settlements',
    title: 'Partner Settlements',
    description: 'Host and promoter obligation breakdown and settlement status.',
    available: true,
    extension: 'csv',
  },
  {
    id: 'event_finance_summary',
    title: 'Event-Level Finance',
    description: 'Revenue, commissions, and fees per event.',
    available: true,
    extension: 'csv',
  },
  {
    id: 'fee_summary',
    title: 'Fee Summary',
    description: 'Processor and platform fees by event and date range.',
    available: true,
    extension: 'csv',
  },
  {
    id: 'monthly_statement',
    title: 'Monthly Statement PDF',
    description: 'Formatted statement with all financial activity — print-ready.',
    available: true,
    extension: 'pdf',
  },
  {
    id: 'annual_summary',
    title: 'Annual Finance Summary PDF',
    description: 'Year-end financial summary with tax-ready figures.',
    available: true,
    extension: 'pdf',
  },
];

// ── Ledger sub-tab ────────────────────────────────────────────────────────────

function LedgerSection() {
  const { profile, getIdToken } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId;
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState<TransactionCategory | ''>(
    (searchParams.get('category') || '') as any,
  );
  const [status, setStatus] = useState<SettlementStatus | ''>(
    (searchParams.get('status') || '') as any,
  );

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLedger = useCallback(
    async (opts?: {
      p?: number;
      q?: string;
      cat?: TransactionCategory | '';
      st?: SettlementStatus | '';
    }) => {
      if (!venueId) return;
      const p = opts?.p ?? page;
      const q = opts?.q ?? search;
      const cat = opts?.cat ?? category;
      const st = opts?.st ?? status;

      setLoading(true);
      setError(false);
      try {
        const token = typeof getIdToken === 'function' ? await getIdToken() : '';
        const qs = new URLSearchParams({
          venueId,
          page: String(p),
          limit: String(PAGE_SIZE),
          ...(q && { search: q }),
          ...(cat && { category: cat }),
          ...(st && { status: st }),
        });
        const res = await fetch(`/api/partners/venues/finance/ledger?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotalCount(data.pagination?.total || 0);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [venueId, page, search, category, status, getIdToken],
  );

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setPage(1);
      fetchLedger({ p: 1, q });
    }, 350);
  };

  const handleExportCSV = async () => {
    if (!transactions.length) return;
    setExporting(true);
    try {
      const headers = [
        'Transaction ID',
        'Date',
        'Amount (₹)',
        'Direction',
        'Category',
        'Status',
        'Description',
        'Event',
        'Partner',
        'Payment Source',
        'Settlement Batch',
        'Processor Fee (₹)',
        'Platform Fee (₹)',
        'Net Amount (₹)',
      ];
      const rows = transactions.map((tx) => [
        `TR-${tx.id}`,
        new Date(tx.timestamp).toISOString(),
        tx.amount,
        tx.direction,
        tx.category,
        tx.status,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        tx.eventName || '',
        tx.partnerName || '',
        tx.paymentSource || '',
        tx.settlementBatchId || '',
        tx.processorFee || 0,
        tx.platformFee || 0,
        tx.netAmount || 0,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${venueId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <VenueActionButton
          variant="secondary"
          onClick={handleExportCSV}
          disabled={exporting || loading || transactions.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </VenueActionButton>
      </div>
      <BentoCard padding="sm" empty={false}>
        <LedgerTable
          transactions={transactions}
          loading={loading}
          error={error}
          onRetry={() => fetchLedger()}
          onExportCSV={handleExportCSV}
          onSearch={handleSearch}
          onCategoryFilter={(cat) => {
            setCategory(cat);
            setPage(1);
            fetchLedger({ p: 1, cat });
          }}
          onStatusFilter={(st) => {
            setStatus(st);
            setPage(1);
            fetchLedger({ p: 1, st });
          }}
          totalCount={totalCount}
          page={page}
          onPageChange={(newPage) => {
            setPage(newPage);
            fetchLedger({ p: newPage });
          }}
          pageSize={PAGE_SIZE}
        />
      </BentoCard>
    </div>
  );
}

// ── Reports sub-tab ───────────────────────────────────────────────────────────

function ReportsSection() {
  const { profile, getIdToken } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId;

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (report: ReportType) => {
    if (!report.available || !venueId) return;
    setGenerating(report.id);
    try {
      if (report.extension === 'csv') {
        const token = typeof getIdToken === 'function' ? await getIdToken() : '';
        const qs = new URLSearchParams({ venueId, from: fromDate, to: toDate, limit: '200' });
        const res = await fetch(`/api/partners/venues/finance/ledger?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Export failed');
        const data = await res.json();
        const transactions = data.transactions || [];
        const headers = [
          'Transaction ID',
          'Date',
          'Amount (₹)',
          'Direction',
          'Category',
          'Status',
          'Description',
          'Event',
          'Partner',
          'Net Amount (₹)',
        ];
        const rows = transactions.map((tx: any) => [
          `TR-${tx.id}`,
          new Date(tx.timestamp).toISOString().slice(0, 10),
          tx.amount,
          tx.direction,
          tx.category,
          tx.status,
          `"${(tx.description || '').replace(/"/g, '""')}"`,
          tx.eventName || '',
          tx.partnerName || '',
          tx.netAmount || 0,
        ]);
        const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.id}-${venueId}-${fromDate}-${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (report.extension === 'pdf') {
        const token = typeof getIdToken === 'function' ? await getIdToken() : '';
        const qs = new URLSearchParams({
          venueId,
          from: fromDate,
          to: toDate,
          type: report.id,
        });
        const res = await fetch(`/api/partners/venues/finance/reports/pdf?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('PDF Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.id}-${venueId}-${fromDate}-${toDate}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Date range */}
      <BentoCard
        header={
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--v-text-muted)' }} />
            <span className="v-label">DATE RANGE</span>
          </div>
        }
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--v-text-muted)' }}
            >
              FROM
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate}
              className="px-4 py-2.5 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[var(--v-orange)]"
              style={{
                background: 'var(--v-elevated)',
                color: 'var(--v-text-primary)',
                border: '1px solid var(--v-border)',
              }}
            />
          </div>
          <div className="pt-5 text-[12px]" style={{ color: 'var(--v-text-muted)' }}>
            to
          </div>
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--v-text-muted)' }}
            >
              TO
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
              max={new Date().toISOString().slice(0, 10)}
              className="px-4 py-2.5 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[var(--v-orange)]"
              style={{
                background: 'var(--v-elevated)',
                color: 'var(--v-text-primary)',
                border: '1px solid var(--v-border)',
              }}
            />
          </div>
          <p className="pt-5 text-[12px]" style={{ color: 'var(--v-text-muted)' }}>
            {Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000)}{' '}
            days selected
          </p>
        </div>
      </BentoCard>

      {/* Report tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.map((report) => (
          <ReportTile
            key={report.id}
            report={report}
            isGenerating={generating === report.id}
            onGenerate={() => handleGenerate(report)}
          />
        ))}
      </div>
    </div>
  );
}

function ReportTile({
  report,
  isGenerating,
  onGenerate,
}: {
  report: ReportType;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div
      className="flex flex-col p-5 rounded-[var(--v-r-xl)]"
      style={{
        background: 'var(--v-card)',
        border: '1px solid var(--v-border)',
        opacity: report.comingSoon ? 0.7 : 1,
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background:
              report.extension === 'pdf' ? 'rgba(129,140,248,0.12)' : 'rgba(52,211,153,0.12)',
          }}
        >
          <FileText
            className="w-4 h-4"
            style={{ color: report.extension === 'pdf' ? '#818CF8' : '#34D399' }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
              {report.title}
            </p>
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{
                background:
                  report.extension === 'pdf' ? 'rgba(129,140,248,0.15)' : 'rgba(52,211,153,0.15)',
                color: report.extension === 'pdf' ? '#818CF8' : '#34D399',
              }}
            >
              {report.extension.toUpperCase()}
            </span>
            {report.comingSoon && (
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}
              >
                Soon
              </span>
            )}
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-muted)' }}>
            {report.description}
          </p>
        </div>
      </div>
      <button
        onClick={onGenerate}
        disabled={!report.available || isGenerating}
        className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: report.available ? 'var(--v-elevated)' : 'transparent',
          color: 'var(--v-text-secondary)',
          border: '1px solid var(--v-border)',
        }}
      >
        {isGenerating ? (
          <>Generating…</>
        ) : report.comingSoon ? (
          <>Coming Soon</>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            Download {report.extension.toUpperCase()}
          </>
        )}
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function RecordsClient() {
  const [sub, setSub] = useState<'ledger' | 'reports'>('ledger');

  return (
    <VenuePageShell
      title="Records"
      subtitle="Transaction ledger and downloadable financial reports"
    >
      {/* Sub-tab toggle */}
      <div
        className="flex p-1 rounded-xl gap-0.5 mb-6 w-fit"
        style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
      >
        {(['ledger', 'reports'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className="px-5 py-2 rounded-lg text-[13px] font-semibold capitalize transition-all"
            style={{
              background: sub === t ? 'var(--v-elevated)' : 'transparent',
              color: sub === t ? 'var(--v-text-primary)' : 'var(--v-text-tertiary)',
            }}
          >
            {t === 'ledger' ? 'Ledger' : 'Reports'}
          </button>
        ))}
      </div>

      {sub === 'ledger' ? <LedgerSection /> : <ReportsSection />}
    </VenuePageShell>
  );
}
