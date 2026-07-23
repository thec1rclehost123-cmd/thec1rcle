import { LegacyFirstRunRedirect } from '@/components/first-run/LegacyFirstRunRedirect';

/** Legacy route retained for old deep links. The root coordinator owns the next stage. */
export default function LegacyOnboardingRedirect() {
  return <LegacyFirstRunRedirect />;
}
