'use client';

import { usePathname } from 'next/navigation';

// Tab routes that should switch instantly with no animation
const TAB_ROUTES = new Set(['/explore', '/hosts', '/tickets', '/app']);

export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTabRoute = TAB_ROUTES.has(pathname);

  if (isTabRoute) {
    // Tab routes: zero animation, instant switch (matches native-app feel)
    return <div className="relative w-full flex-1 flex flex-col">{children}</div>;
  }

  // Non-tab routes: CSS enter animation (opacity + translateY slideUp).
  // key={pathname} triggers a remount on navigation, restarting the animation.
  // The .route-enter keyframe is defined in globals.css.
  return (
    <div key={pathname} className="route-enter relative w-full flex-1 flex flex-col">
      {children}
    </div>
  );
}
