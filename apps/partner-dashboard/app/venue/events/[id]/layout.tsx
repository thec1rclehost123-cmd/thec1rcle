import { ReactNode } from 'react';
import EventSubNav from '@/components/event-detail/EventSubNav';

export default function EventDetailLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <EventSubNav />
      {children}
    </div>
  );
}
