'use client';

import { useParams } from 'next/navigation';
import { PromoterHandleView } from '../../features/discovery/components/PromoterHandleView';
import { usePromoterProfile } from '../../features/discovery/hooks/usePromoterProfile';

export default function PromoterHandlePageClient() {
  const params = useParams();
  const handle = decodeURIComponent(String(params?.handle || '')).toLowerCase();
  const promoterProfile = usePromoterProfile(handle);
  return <PromoterHandleView handle={handle} {...promoterProfile} />;
}
