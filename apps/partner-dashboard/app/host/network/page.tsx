import { redirect } from 'next/navigation';

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((val) => params.append(key, val));
      } else {
        params.append(key, value);
      }
    }
  }
  const queryString = params.toString();
  redirect(`/host/partners${queryString ? `?${queryString}` : ''}`);
}
