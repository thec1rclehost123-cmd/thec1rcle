import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(__dirname, '..');

function source(relativePath: string) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('web dashboard remediation contracts', () => {
  it('wraps each partner dashboard surface in the global error boundary', () => {
    for (const layout of [
      'app/venue/layout.tsx',
      'app/host/layout.tsx',
      'app/promoter/layout.tsx',
    ]) {
      const content = source(layout);
      expect(content).toContain("from '@/components/GlobalErrorBoundary'");
      expect(content).toContain('<GlobalErrorBoundary>');
    }
  });

  it('preserves dirty host event information during background refetches', () => {
    const content = source('app/host/events/[id]/PageClient.tsx');
    expect(content).toContain('const [eventInfoDirty, setEventInfoDirty] = useState(false)');
    expect(content).toContain('if (!event || eventInfoDirty) return');
    expect(content).toContain('setEventInfoDirty(true)');
    expect(content).toContain('setEventInfoDirty(false)');
  });

  it('keys host page management loading by a primitive host id', () => {
    const content = source('app/host/page-management/PageClient.tsx');
    expect(content).toContain("const hostId = profile?.activeMembership?.partnerId || ''");
    expect(content).toContain('}, [hostId]);');
    expect(content).not.toContain('}, [profile]);');
  });

  it('does not force-refresh the venue event Firebase token', () => {
    const content = source('app/venue/events/[id]/PageClient.tsx');
    expect(content).toContain('await user.getIdToken()');
    expect(content).not.toContain('await user.getIdToken(true)');
  });

  it('uses cancellable React Query reads for promoter race-prone pages', () => {
    for (const page of [
      'app/promoter/events/PageClient.tsx',
      'app/promoter/guests/PageClient.tsx',
    ]) {
      const content = source(page);
      expect(content).toContain('useQuery');
      expect(content).toContain('queryFn: async ({ signal })');
      expect(content).toContain('signal');
    }
  });

  it('uses React Query for the listed venue and host read surfaces', () => {
    for (const page of [
      'app/venue/door/sell/PageClient.tsx',
      'app/venue/finance/PageClient.tsx',
      'app/venue/finance/payouts/PageClient.tsx',
      'app/host/calendar/PageClient.tsx',
      'app/host/finance/PageClient.tsx',
      'app/host/ops/PageClient.tsx',
    ]) {
      const content = source(page);
      expect(content).toContain('useQuery');
      expect(content).toContain('queryFn: async ({ signal })');
    }
  });

  it('memoizes host finance reconstruction arrays', () => {
    const content = source('app/host/finance/PageClient.tsx');
    for (const name of ['balanceRows', 'settingsRows', 'bankAccounts', 'payoutRows']) {
      expect(content).toMatch(new RegExp(`const ${name} = useMemo`));
    }
  });

  it('polls promoter guests and host ops through React Query only', () => {
    const promoterGuests = source('app/promoter/guests/PageClient.tsx');
    const hostOps = source('app/host/ops/PageClient.tsx');
    expect(promoterGuests).toContain('refetchInterval: autoRefresh ? 30_000 : false');
    expect(hostOps).toContain('refetchInterval: 30_000');
    expect(promoterGuests).not.toContain('setInterval(');
    expect(hostOps).not.toContain('setInterval(');
  });
});
