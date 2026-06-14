import { redirect } from "next/navigation";

async function resolveParams(params) {
  return await params;
}

export default async function LegacyVenueMenuPage({ params }) {
  const resolved = await resolveParams(params);
  const slug = encodeURIComponent(String(resolved?.slug || ""));
  redirect(`/venue/${slug}/menu`);
}
