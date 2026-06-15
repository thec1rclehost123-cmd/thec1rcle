import { PromoterAssignmentDetailClient } from '@/components/promoter/events/PromoterAssignmentDetailClient';

export const metadata = {
  title: 'Event Details | Promoter Dashboard',
  description: 'Your tracking links, guest list, and sales for this event.',
};

export default function PromoterAssignmentDetailPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  return <PromoterAssignmentDetailClient assignmentId={params.assignmentId} />;
}
