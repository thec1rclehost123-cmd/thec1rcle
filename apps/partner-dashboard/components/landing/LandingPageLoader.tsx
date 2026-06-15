'use client';

import dynamic from 'next/dynamic';

const LandingPage = dynamic(() => import('./LandingPage'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100vh', background: '#0A0A0B' }} />,
});

export default function LandingPageLoader() {
  return <LandingPage />;
}
