import { redirect } from 'next/navigation';

export default async function EventPluralAliasPage({ params }) {
  const { id } = await params;
  redirect(`/event/${encodeURIComponent(id)}`);
}
