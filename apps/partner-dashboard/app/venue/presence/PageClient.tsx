'use client';

import { Suspense } from 'react';
import { Globe, UtensilsCrossed, Layout } from 'lucide-react';
import { HubTabBar } from '@/components/shared/HubTabBar';
import { useHubTab } from '@/lib/hooks/useHubTab';
import { Skeleton } from '@/components/ui/Skeleton';

import VenuePresencePageClient from './VenuePresencePageClient';
import MenuPageClient from '../menu/PageClient';
import PresenceConfigEditor from '@/components/venue-management/PresenceConfigEditor';

const TABS = [
  { key: 'page', label: 'Venue Page', icon: Globe },
  { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { key: 'public', label: 'Public Page', icon: Layout },
];

function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'page':
      return <VenuePresencePageClient />;
    case 'menu':
      return <MenuPageClient />;
    case 'public':
      return <PresenceConfigEditor />;
    default:
      return <VenuePresencePageClient />;
  }
}

export default function PresencePageClient() {
  const { activeTab, setTab } = useHubTab('page');

  return (
    <div className="space-y-6">
      {/* Hub Header */}
      <div>
        <h1 className="v-text-title font-semibold" style={{ color: 'var(--v-text-primary)' }}>
          Presence
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
          How your venue appears publicly — page, menu, and identity.
        </p>
      </div>

      {/* Tab Bar */}
      <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />

      {/* Tab Content */}
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <TabContent activeTab={activeTab} />
      </Suspense>
    </div>
  );
}
