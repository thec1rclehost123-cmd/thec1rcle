'use client';

import { VenueLedgerPanel } from '@/components/finance/VenueLedgerPanel';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';

export default function VenueFinanceLedgerClient() {
  return (
    <VenuePageShell title="Ledger" subtitle="Complete transaction history for your venue">
      <VenueLedgerPanel />
    </VenuePageShell>
  );
}
