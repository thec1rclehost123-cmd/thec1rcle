import PageClient from "./PageClient";
import { guestServerJson } from "../../../lib/api/server";
import { absoluteUrl, buildTitle, getSiteUrl, profileDescription } from "../../../features/seo/seoUtils";

async function resolveParams(params) {
    return await params;
}

async function loadHost(slug) {
    if (!slug) return null;
    const { response, data } = await guestServerJson(`/public/hosts/${encodeURIComponent(slug)}`, {
        forwardCookies: false,
        next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return data;
}

export async function generateMetadata({ params }) {
    const resolved = await resolveParams(params);
    const slug = decodeURIComponent(String(resolved?.slug || ""));
    const data = await loadHost(slug);
    const host = data?.host || null;

    if (!host) {
        return {
            title: "Host unavailable | THE.C1RCLE",
            description: "This C1RCLE host profile is unavailable.",
            alternates: { canonical: `${getSiteUrl()}/host/${encodeURIComponent(slug)}` },
        };
    }

    const title = host.name || host.displayName || "C1RCLE Host";
    const description = profileDescription(host, "Explore this C1RCLE host profile, events, and nightlife community.");
    const image = absoluteUrl(host.ogImage || host.cover || host.coverURL || host.avatar || host.photoURL);
    const canonical = `${getSiteUrl()}/host/${encodeURIComponent(host.slug || slug)}`;

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

export default async function HostPublicPage({ params }) {
    const resolved = await resolveParams(params);
    const slug = decodeURIComponent(String(resolved?.slug || ""));
    const data = await loadHost(slug);
    return <PageClient initialData={data} initialSlug={slug} />;
}
