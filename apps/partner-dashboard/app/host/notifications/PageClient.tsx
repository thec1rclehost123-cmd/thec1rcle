'use client';

import { NotificationsPageClient } from '@/components/shared/NotificationsPageClient';

const TYPE_COLORS = {
  event: '#F44A22',
  payout: '#22c55e',
  team: '#3b82f6',
  alert: '#f59e0b',
  system: '#6b7280',
};

export default function HostNotificationsPageClient() {
  return (
    <NotificationsPageClient
      apiPath="/api/host/notifications"
      typeColors={TYPE_COLORS}
      emptyHint="You'll see event updates, team changes, and payout alerts here."
    />
  );
}
