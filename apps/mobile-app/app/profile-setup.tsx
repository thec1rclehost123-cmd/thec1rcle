import { LegacyFirstRunRedirect } from '@/components/first-run/LegacyFirstRunRedirect';

/** Legacy route retained for old deep links. The coordinator applies rollout flags. */
export default function LegacyProfileSetupRedirect() {
  return <LegacyFirstRunRedirect />;
}
