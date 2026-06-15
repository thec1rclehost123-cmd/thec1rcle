'use client';

import { Suspense } from 'react';
import { Globe } from 'lucide-react';
import { HubTabBar } from '@/components/shared/HubTabBar';
import { useHubTab } from '@/lib/hooks/useHubTab';
import { Skeleton } from '@/components/ui/Skeleton';

import HostPresencePageClient from './HostPresencePageClient';

const TABS = [{ key: 'page', label: 'Your Page', icon: Globe }];

function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'page':
      return <HostPresencePageClient />;
    default:
      return <HostPresencePageClient />;
  }
}

export default function PresencePageClient() {
  const { activeTab, setTab } = useHubTab('page');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="v-text-title font-semibold" style={{ color: 'var(--v-text-primary)' }}>
          Presence
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
          How your profile appears publicly — page, identity, and reach.
        </p>
      </div>

      <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <TabContent activeTab={activeTab} />
      </Suspense>
    </div>
  );
}
