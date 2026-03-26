import { listEvents } from "@/lib/server/eventStore";

export default async function sitemap() {
    const baseUrl = 'https://thec1rcle.com';

    // Core pages
    const routes = [
        '',
        '/explore',
        '/app',
        '/host',
        '/about',
        '/login',
        '/create',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: route === '' ? 1 : 0.8,
    }));

    // Dynamic event pages (live + scheduled)
    let eventRoutes = [];
    try {
        const events = await listEvents({ limit: 500 });
        eventRoutes = (events || []).map((event) => ({
            url: `${baseUrl}/event/${event.id}`,
            lastModified: new Date(event.updatedAt || event.createdAt || Date.now()),
            changeFrequency: 'weekly',
            priority: 0.7,
        }));
    } catch (e) {
        console.error('[sitemap] Failed to fetch events:', e.message);
    }

    return [...routes, ...eventRoutes];
}
