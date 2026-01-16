import { redirect } from "next/navigation";

/**
 * Short URL handler for promoter links
 * Redirects /e/[eventId]?ref=CODE to /event/[eventId]?ref=CODE
 * This allows promoters to share shorter, cleaner URLs
 */
export default function ShortEventRedirect({ params, searchParams }) {
    const { eventId } = params;
    const ref = searchParams?.ref;

    // Build the redirect URL preserving the ref parameter
    const redirectUrl = ref
        ? `/event/${eventId}?ref=${ref}`
        : `/event/${eventId}`;

    redirect(redirectUrl);
}

// Generate metadata for SEO (will show briefly before redirect)
export async function generateMetadata({ params }) {
    return {
        title: "Redirecting... | THE C1RCLE",
        robots: "noindex, nofollow"
    };
}
