import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/venue/partners?tab=discover');
}
