import TicketTypesClient from '@/components/event-detail/TicketTypesClient';

export const metadata = { title: 'Ticket Types — Venue' };

export default async function TicketTypesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketTypesClient eventId={id} />;
}
