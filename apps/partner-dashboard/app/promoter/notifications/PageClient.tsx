'use client';

import { NotificationsPageClient } from '@/components/shared/NotificationsPageClient';

const TYPE_COLORS = {
  event: '#F44A22',
  payout: '#22c55e',
  commission: '#22c55e',
  link: '#a78bfa',
  alert: '#f59e0b',
  system: '#6b7280',
};

export default function PromoterNotificationsPageClient() {
  return (
    <NotificationsPageClient
      apiPath="/api/promoter/notifications"
      typeColors={TYPE_COLORS}
      emptyHint="You'll see event updates, payout alerts, and commission activity here."
    />
  );
}
