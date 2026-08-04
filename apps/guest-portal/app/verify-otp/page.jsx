import { redirect } from 'next/navigation';

export default async function VerifyOtpCompatibilityPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === 'string' ? params.next : '';
  const signupUrl = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';

  redirect(signupUrl);
}
