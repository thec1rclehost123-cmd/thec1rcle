export default function sitemap() {
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

    return [...routes];
}
