import PageClient from "./PageClient";
import { guestServerJson } from "../../../lib/api/server";
import { absoluteUrl, buildTitle, getSiteUrl, profileDescription } from "../../../features/seo/seoUtils";

async function resolveParams(params) {
    return await params;
}

async function loadVenue(slug) {
    if (!slug) return null;
    const { response, data } = await guestServerJson(`/public/venues/${encodeURIComponent(slug)}`, {
        forwardCookies: false,
        next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return data;
}

export async function generateMetadata({ params }) {
    const resolved = await resolveParams(params);
    const slug = decodeURIComponent(String(resolved?.slug || ""));
    const data = await loadVenue(slug);
    const venue = data?.venue || null;

    if (!venue) {
        return {
            title: "Venue unavailable | THE.C1RCLE",
            description: "This C1RCLE venue profile is unavailable.",
            alternates: { canonical: `${getSiteUrl()}/venue/${encodeURIComponent(slug)}` },
        };
    }

    const title = venue.name || venue.displayName || "C1RCLE Venue";
    const description = profileDescription(venue, "Explore this C1RCLE venue profile, events, and nightlife context.");
    const image = absoluteUrl(venue.ogImage || venue.cover || venue.coverURL || venue.image || venue.photoURL);
    const canonical = `${getSiteUrl()}/venue/${encodeURIComponent(venue.slug || slug)}`;

    return {
        title: buildTitle(title),
        description,
        alternates: { canonical },
        openGraph: {
            title,
            description,
            url: canonical,
            images: [{ url: image, width: 1200, height: 630, alt: title }],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image],
        },
    };
}

export default async function VenuePublicPage({ params }) {
    const resolved = await resolveParams(params);
    const slug = decodeURIComponent(String(resolved?.slug || ""));
    const data = await loadVenue(slug);
    return <PageClient initialData={data} initialSlug={slug} />;
}
