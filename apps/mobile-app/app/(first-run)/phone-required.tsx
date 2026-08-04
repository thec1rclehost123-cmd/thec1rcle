import { Redirect } from 'expo-router';

export default function PhoneRequiredRoute() {
  return <Redirect href={'/(auth)/phone?mode=link&returnTo=/' as any} />;
}
