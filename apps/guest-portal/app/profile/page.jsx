import { redirect } from 'next/navigation';
import { getProfileEntryRedirect } from '../../lib/auth/guestRouteAccess';
import { getGuestBootstrapFromSession } from '../../lib/server/guestBootstrap';

export default async function Page() {
  const bootstrap = await getGuestBootstrapFromSession();
  redirect(getProfileEntryRedirect(bootstrap));
}
