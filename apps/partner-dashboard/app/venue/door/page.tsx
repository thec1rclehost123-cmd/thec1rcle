import { Suspense } from 'react';
import DoorPageClient from './PageClient';

export const metadata = { title: 'Door — Venue' };

export default function DoorPage() {
  return (
    <Suspense>
      <DoorPageClient />
    </Suspense>
  );
}
