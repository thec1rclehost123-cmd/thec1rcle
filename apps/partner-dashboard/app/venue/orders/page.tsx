import { Suspense } from 'react';
import PageClient from './PageClient';

export const metadata = {
  title: 'Orders — Venue',
};

export default function VenueOrdersPage() {
  return (
    <Suspense>
      <PageClient />
    </Suspense>
  );
}
