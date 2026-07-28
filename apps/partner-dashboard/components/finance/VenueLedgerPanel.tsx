'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { BentoCard } from '@/components/ui/BentoCard';
import { LedgerTable } from '@/components/finance/LedgerTable';
import { VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import type {
  LedgerTransaction,
  SettlementStatus,
  TransactionCategory,
} from '@/lib/finance/definitions';

const PAGE_SIZE = 50;

export function VenueLedgerPanel() {
  const { profile, getIdToken } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId;
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [category, setCategory] = useState<TransactionCategory | ''>(
    (searchParams.get('category') || '') as TransactionCategory | '',
  );
  const [status, setStatus] = useState<SettlementStatus | ''>(
    (searchParams.get('status') || '') as SettlementStatus | '',
  );
  const cursorsByPage = useRef<Record<number, string | null>>({ 1: null });

  const resetPagination = useCallback(() => {
    cursorsByPage.current = { 1: null };
    setPage(1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      resetPagination();
      setAppliedSearch(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [resetPagination, search]);

  const fetchLedger = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    setError(false);
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      const cursor = cursorsByPage.current[page];
      const query = new URLSearchParams({
        venueId,
        limit: String(PAGE_SIZE),
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
        ...(cursor ? { cursor } : {}),
      });
      const response = await fetch(`/api/partners/venues/finance/ledger?${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Ledger API unavailable');
      const payload = await response.json();
      const nextTransactions = Array.isArray(payload.transactions) ? payload.transactions : [];
      const nextCursor = payload.pagination?.nextCursor || null;
      const nextHasMore = payload.pagination?.hasMore === true;
      setTransactions(nextTransactions);
      setHasMore(nextHasMore);
      if (nextHasMore && nextCursor) cursorsByPage.current[page + 1] = nextCursor;
    } catch {
      setError(true);
      setTransactions([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, category, getIdToken, page, status, venueId]);

  useEffect(() => {
    void fetchLedger();
  }, [fetchLedger]);

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
      const rows = transactions.map((transaction) => [
        `TR-${transaction.id}`,
        new Date(transaction.timestamp).toISOString(),
        transaction.amount,
        transaction.direction,
        transaction.category,
        transaction.status,
        `"${(transaction.description || '').replace(/"/g, '""')}"`,
        transaction.eventName || '',
        transaction.partnerName || '',
        transaction.paymentSource || '',
        transaction.settlementBatchId || '',
        transaction.processorFee || 0,
        transaction.platformFee || 0,
        transaction.netAmount || 0,
      ]);
      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ledger-${venueId}-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
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
          onRetry={() => void fetchLedger()}
          onExportCSV={handleExportCSV}
          onSearch={setSearch}
          onCategoryFilter={(nextCategory) => {
            resetPagination();
            setCategory(nextCategory);
          }}
          onStatusFilter={(nextStatus) => {
            resetPagination();
            setStatus(nextStatus);
          }}
          page={page}
          onPageChange={(nextPage) => {
            if (nextPage < page || (nextPage === page + 1 && hasMore)) setPage(nextPage);
          }}
          pageSize={PAGE_SIZE}
          hasNextPage={hasMore}
        />
      </BentoCard>
    </div>
  );
}
