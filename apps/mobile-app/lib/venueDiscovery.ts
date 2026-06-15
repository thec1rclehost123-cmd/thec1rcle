export interface Coordinates {
    latitude: number;
    longitude: number;
}

const KNOWN_VENUES: Record<string, Coordinates> = {
    "antisocial": { latitude: 19.0176, longitude: 72.8292 },
    "bluefrog": { latitude: 19.0069, longitude: 72.83 },
    "hard rock cafe": { latitude: 18.922, longitude: 72.8347 },
    "phoenix palladium": { latitude: 19.0001, longitude: 72.8315 },
    "high street phoenix": { latitude: 19.0001, longitude: 72.8318 },
    "tote on the turf": { latitude: 19.0315, longitude: 72.8476 },
    "hauz khas": { latitude: 28.5494, longitude: 77.2001 },
    "koramangala": { latitude: 12.9352, longitude: 77.6245 },
    "koregaon park": { latitude: 18.5362, longitude: 73.892 },
    "vagator": { latitude: 15.5965, longitude: 73.7442 },
    "anjuna": { latitude: 15.583, longitude: 73.741 },
};

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function normalizeCoordinateCandidate(value: unknown): Coordinates | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const record = value as Record<string, unknown>;
    const latitude =
        toFiniteNumber(record.latitude) ??
        toFiniteNumber(record.lat) ??
        toFiniteNumber(record._latitude);
    const longitude =
        toFiniteNumber(record.longitude) ??
        toFiniteNumber(record.lng) ??
        toFiniteNumber(record.lon) ??
        toFiniteNumber(record.long) ??
        toFiniteNumber(record._longitude);

    if (latitude === null || longitude === null) {
        return null;
    }

    return { latitude, longitude };
}

export function resolveVenueCoordinates(source: Record<string, unknown> | null | undefined): Coordinates | null {
    if (!source) {
        return null;
    }

    return (
        normalizeCoordinateCandidate(source.coordinates) ||
        normalizeCoordinateCandidate(source.location) ||
        normalizeCoordinateCandidate(source.geoPoint) ||
        normalizeCoordinateCandidate(source.geoLocation) ||
        normalizeCoordinateCandidate(source.mapLocation)
    );
}

export function findKnownVenueCoordinates(...parts: (string | undefined | null)[]): Coordinates | null {
    const haystack = parts
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" ")
        .toLowerCase();

    if (!haystack) {
        return null;
    }

    for (const [name, coords] of Object.entries(KNOWN_VENUES)) {
        if (haystack.includes(name)) {
            return coords;
        }
    }

    return null;
}

export function calculateDistanceKm(origin: Coordinates, target: Coordinates): number {
    const earthRadiusKm = 6371;
    const dLat = toRadians(target.latitude - origin.latitude);
    const dLon = toRadians(target.longitude - origin.longitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(origin.latitude)) *
            Math.cos(toRadians(target.latitude)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

export function formatDistance(distanceKm?: number | null): string | null {
    if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) {
        return null;
    }

    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m away`;
    }

    if (distanceKm < 10) {
        return `${distanceKm.toFixed(1)} km away`;
    }

    return `${Math.round(distanceKm)} km away`;
}

export function formatCompactCount(value?: number | null): string {
    if (!value || value <= 0) {
        return "0";
    }

    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    }

    return `${Math.round(value)}`;
}

export function getVenueDisplayName(venue: {
    displayName?: string;
    name?: string;
}): string {
    return venue.displayName || venue.name || "Venue";
}

export function getVenueLocationLabel(venue: {
    neighborhood?: string;
    area?: string;
    city?: string;
    address?: string;
}): string {
    return venue.neighborhood || venue.area || venue.city || venue.address || "";
}

export function normalizeVenueKey(value?: string | null): string {
    return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
