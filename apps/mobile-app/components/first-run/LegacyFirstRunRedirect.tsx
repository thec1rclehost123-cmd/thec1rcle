import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { trackFirstRun } from '@/lib/firstRunAnalytics';

export function LegacyFirstRunRedirect() {
  useEffect(() => {
    trackFirstRun('first_run_legacy_redirected', {
      source: 'legacy_deep_link',
      outcome: 'success',
    });
  }, []);

  return <Redirect href="/" />;
}
