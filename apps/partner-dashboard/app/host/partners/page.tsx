import { Suspense } from 'react';
import HostPartnersPage from './PageClient';

export const metadata = { title: 'Partners — Host' };

export default function PartnersPage() {
  return (
    <Suspense>
      <HostPartnersPage />
    </Suspense>
  );
}
