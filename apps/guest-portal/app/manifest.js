export default function manifest() {
    return {
        name: 'THE.C1RCLE',
        short_name: 'THE.C1RCLE',
        description: 'Discover Life Offline. The future of Indian nightlife.',
        start_url: '/',
        display: 'standalone',
        background_color: '#161616',
        theme_color: '#F44A22',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    };
}
