'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardAuth } from '../../components/providers/DashboardAuthProvider';

export default function CreatePageRedirect() {
  const router = useRouter();
  const { loading, profile, user } = useDashboardAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?next=%2Fcreate');
      return;
    }

    const partnerType = profile?.activeMembership?.partnerType;
    if (partnerType === 'venue' || partnerType === 'club') {
      router.replace('/venue/create');
      return;
    }
    if (partnerType === 'host') {
      router.replace('/host/create');
      return;
    }
    router.replace('/promoter/events');
  }, [loading, profile, router, user]);

  return (
    <main
      className="grid min-h-screen place-items-center bg-white text-black dark:bg-black dark:text-white"
      aria-live="polite"
    >
      <p className="text-xs font-black uppercase tracking-[0.3em]">Opening event studio…</p>
    </main>
  );
}
