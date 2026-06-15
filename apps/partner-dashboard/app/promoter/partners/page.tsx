import { Suspense } from 'react';
import PromoterPartnersClient from './PageClient';

export const metadata = { title: 'Partners — Promoter' };

export default function PromoterPartnersPage() {
  return (
    <Suspense>
      <PromoterPartnersClient />
    </Suspense>
  );
}
