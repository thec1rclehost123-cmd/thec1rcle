import PageClient from './PageClient';
import { redirect } from 'next/navigation';
import { getAuthPageRedirect, getReturnUrl } from '../../lib/auth/guestRouteAccess';
import { getGuestBootstrapFromSession } from '../../lib/server/guestBootstrap';

export default async function Page(props) {
  const searchParams = await props.searchParams;
  const returnUrl = getReturnUrl(searchParams);
  const bootstrap = await getGuestBootstrapFromSession();
  const redirectTarget = getAuthPageRedirect(bootstrap, returnUrl);

  if (redirectTarget) redirect(redirectTarget);
  return <PageClient {...props} />;
}
