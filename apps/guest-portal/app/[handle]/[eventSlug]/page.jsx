import { notFound, redirect } from "next/navigation";
import { getEvent } from "../../../lib/server/eventStore";
import { PUBLIC_LIFECYCLE_STATES } from "@c1rcle/core/events";
import { getPromoterByUsername, getPromoterLinkByVanityAlias } from "../../../lib/server/promoterStore";

export async function generateMetadata({ params }) {
    const handle = decodeURIComponent(params.handle).toLowerCase();
    const slug = decodeURIComponent(params.eventSlug);

    const vanityLink = await getPromoterLinkByVanityAlias(handle, slug);
    if (vanityLink?.eventId) {
        const event = await getEvent(vanityLink.eventSlug || vanityLink.eventId);
        if (!event || !PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
            return { title: "Event Not Found | THE C1RCLE" };
        }

        const eventTitle = (event.title || event.name || "Event").toUpperCase();
        const description = event.summary || event.description || "Get your tickets now.";
        const image = event.image || event.poster || event.coverImage || "/logo-circle.jpg";
        return {
            title: `${eventTitle} | THE C1RCLE`,
            description,
            openGraph: {
                title: `THE.C1RCLE | ${eventTitle}`,
                description: `via @${handle} — ${description}`,
                images: [image],
                siteName: "THE.C1RCLE",
                type: "website",
            },
            twitter: {
                card: "summary_large_image",
                title: `THE.C1RCLE | ${eventTitle}`,
                description,
                images: [image],
            },
        };
    }

    const [promoter, event] = await Promise.all([
        getPromoterByUsername(handle),
        getEvent(slug)
    ]);

    if (!event || !PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
        return { title: "Event Not Found | THE C1RCLE" };
    }

    const eventTitle = (event.title || event.name || "Event").toUpperCase();
    const description = event.summary || event.description || "Get your tickets now.";
    const image = event.image || event.poster || event.coverImage || "/logo-circle.jpg";
    const promoterName = promoter?.displayName || promoter?.name || handle;

    return {
        title: `${eventTitle} | THE C1RCLE`,
        description,
        openGraph: {
            title: `THE.C1RCLE | ${eventTitle}`,
            description: promoter
                ? `via @${handle} — ${description}`
                : description,
            images: [image],
            siteName: "THE.C1RCLE",
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title: `THE.C1RCLE | ${eventTitle}`,
            description,
            images: [image],
        },
    };
}

export const revalidate = 120;

function buildRedirectQuery(searchParams) {
    if (!searchParams) return "";

    const entries = Object.entries(searchParams).flatMap(([key, value]) => {
        if (value == null) return [];
        if (Array.isArray(value)) return value.map(item => [key, item]);
        return [[key, value]];
    });

    if (entries.length === 0) return "";

    const query = new URLSearchParams();
    for (const [key, value] of entries) {
        query.append(key, String(value));
    }

    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
}

export default async function VanityEventPage({ params, searchParams }) {
    const handle = decodeURIComponent(params.handle).toLowerCase();
    const slug = decodeURIComponent(params.eventSlug);

    const vanityLink = await getPromoterLinkByVanityAlias(handle, slug);
    if (vanityLink?.eventId && vanityLink?.code) {
        redirect(`/event/${encodeURIComponent(vanityLink.eventSlug || vanityLink.eventId)}?ref=${encodeURIComponent(vanityLink.code)}`);
    }

    const [promoter, event] = await Promise.all([
        getPromoterByUsername(handle),
        getEvent(slug)
    ]);

    if (!event || !PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
        notFound();
    }

    const query = buildRedirectQuery(searchParams);
    redirect(`/event/${encodeURIComponent(event.id)}${query}`);
}
