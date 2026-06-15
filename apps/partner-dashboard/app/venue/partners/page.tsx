import { Suspense } from 'react';
import PartnersPageClient from './PageClient';

export const metadata = { title: 'Partners — Venue' };

export default function PartnersPage() {
  return (
    <Suspense>
      <PartnersPageClient />
    </Suspense>
  );
}
