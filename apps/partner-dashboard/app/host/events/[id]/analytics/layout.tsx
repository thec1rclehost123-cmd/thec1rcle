import { ReactNode } from 'react';

export const metadata = {
  title: 'Event Analytics — Host',
  description: 'View detailed analytics and performance metrics for this event.',
};

export default function EventAnalyticsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
