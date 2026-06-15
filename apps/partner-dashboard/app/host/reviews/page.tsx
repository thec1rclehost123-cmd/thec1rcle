'use client';

import dynamic from 'next/dynamic';

const ReviewsClient = dynamic(() => import('./PageClient'), { ssr: false });

export default function ReviewsPage() {
  return <ReviewsClient />;
}
