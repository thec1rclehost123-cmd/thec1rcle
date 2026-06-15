import { Suspense } from 'react';
import PageClient from './PageClient';

export const metadata = {
  title: 'Marketing — Venue',
};

export default function VenueMarketingPage() {
  return (
    <Suspense>
      <PageClient />
    </Suspense>
  );
}
