import { Redirect } from 'expo-router';

/** Legacy deep link retained while account creation is owned by the unified login. */
export default function LegacySignupRedirect() {
  return <Redirect href="/(auth)/login" />;
}
