import { redirect } from 'next/navigation';
import PageClient from './PageClient';

export const metadata = {
  title: 'V2 Studio · C1RCLE Partners',
};

export default function Page() {
  // T21 feature-flag: the V2 partner slice is hidden by default; enabled via
  // NEXT_PUBLIC_V2_ENABLED=true for the one release during the V1→V2 switch.
  if (process.env.NEXT_PUBLIC_V2_ENABLED !== 'true') {
    redirect('/');
  }
  return <PageClient />;
}
