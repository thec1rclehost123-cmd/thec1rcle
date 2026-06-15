import EventAttendeesClient from '@/components/event-detail/EventAttendeesClient';

export const metadata = { title: 'Event Attendees — Venue' };

export default async function AttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventAttendeesClient eventId={id} />;
}
