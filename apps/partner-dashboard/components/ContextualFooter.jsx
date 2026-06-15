'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function ContextualFooter() {
  const pathname = usePathname();

  // Hide footer on host studio internal routes
  const isHostDashboard =
    pathname?.startsWith('/host') && !pathname.includes('%40') && !pathname.includes('@');

  if (isHostDashboard) return null;

  return <Footer />;
}
