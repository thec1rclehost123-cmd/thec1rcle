import { redirect, notFound } from "next/navigation";
import { guestServerJson } from "../../../lib/api/server";

async function resolveParams(params) {
  return await params;
}

async function resolveLink(linkId) {
  if (!linkId) return null;
  const { response, data } = await guestServerJson(`/promoter-links/${encodeURIComponent(linkId)}`, {
    forwardCookies: false,
    next: { revalidate: 0 },
  });
  if (!response.ok) return null;
  return data?.link || null;
}

export default async function ReferPage({ params }) {
  const { linkId } = await resolveParams(params);
  if (!linkId) notFound();

  const link = await resolveLink(linkId);

  if (!link || !link.isActive || !link.eventId) {
    // Fallback: redirect to explore
    redirect("/explore");
  }

  // Build the redirect URL to the event with promoter code pre-filled.
  // Validate slug/id to prevent open-redirect via a tampered Firestore document.
  const rawTarget = link.eventSlug || link.eventId;
  const safeTarget = /^[a-zA-Z0-9_-]+$/.test(rawTarget || "") ? rawTarget : null;
  if (!safeTarget) redirect("/explore");

  const params_str = new URLSearchParams();
  if (link.code) params_str.set("ref", link.code);
  params_str.set("lid", linkId);

  redirect(`/e/${safeTarget}?${params_str.toString()}`);
}
