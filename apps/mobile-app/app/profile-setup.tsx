import { Redirect } from 'expo-router';

/** Legacy route retained for old deep links. Identity is now a focused v2 step. */
export default function LegacyProfileSetupRedirect() {
  return <Redirect href={'/identity' as any} />;
}
