import { redirect } from 'next/navigation';

function buildLoginRedirect(searchParams = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined) params.append(key, String(entry));
      });
      continue;
    }
    if (value !== undefined) params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

export default function Page({ searchParams }) {
  redirect(buildLoginRedirect(searchParams));
}
