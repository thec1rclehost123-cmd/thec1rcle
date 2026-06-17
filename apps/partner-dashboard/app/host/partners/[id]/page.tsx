import { Suspense } from 'react';
import ProfilePageClient from './ProfilePageClient';

export const metadata = { title: 'Partner Profile' };

export default async function HostPartnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return (
    <Suspense>
      <ProfilePageClient id={resolvedParams.id} />
    </Suspense>
  );
}
