import { Redirect } from 'expo-router';

/** Legacy route retained for old deep links. The root coordinator owns the next stage. */
export default function LegacyOnboardingRedirect() {
  return <Redirect href="/" />;
}
