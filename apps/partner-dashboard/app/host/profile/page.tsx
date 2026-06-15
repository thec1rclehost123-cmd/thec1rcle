import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/host/settings?tab=profile');
}
