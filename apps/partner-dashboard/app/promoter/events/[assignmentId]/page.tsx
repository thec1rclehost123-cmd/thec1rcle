import { PromoterAssignmentDetailClient } from '@/components/promoter/events/PromoterAssignmentDetailClient';

export const metadata = {
  title: 'Event Details | Promoter Dashboard',
  description: 'Your tracking links, guest list, and sales for this event.',
};

export default async function PromoterAssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  return <PromoterAssignmentDetailClient assignmentId={assignmentId} />;
}
