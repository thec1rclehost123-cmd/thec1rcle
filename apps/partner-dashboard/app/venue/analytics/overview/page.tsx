import { redirect } from 'next/navigation';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const eventId = (await searchParams).eventId;
  const selectedEventId = Array.isArray(eventId) ? eventId[0] : eventId;
  redirect(
    selectedEventId
      ? `/venue/analytics?tab=overview&eventId=${encodeURIComponent(selectedEventId)}`
      : '/venue/analytics?tab=overview',
  );
}
