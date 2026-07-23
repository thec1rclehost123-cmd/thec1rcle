import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { trackFirstRun } from '@/lib/firstRunAnalytics';

/** Compatibility route for old links; account entry is Apple, Google, or phone. */
export default function LegacySignupRedirect() {
  useEffect(() => {
    trackFirstRun('first_run_legacy_redirected', {
      stage: 'login',
      source: 'legacy_deep_link',
    });
  }, []);
  return <Redirect href="/(auth)/login" />;
}
