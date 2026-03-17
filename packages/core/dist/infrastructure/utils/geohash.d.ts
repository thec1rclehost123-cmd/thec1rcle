/**
 * Lightweight Geohash Utility for Firestore Proximity Queries
 * Based on the Geohash algorithm (Base32 encoding of interleaved bits)
 */
export declare function encodeGeohash(lat: number, lng: number, precision?: number): string;
/**
 * Calculates geohash range for a given precision to approximate a radius.
 * This is a simplified version suitable for 1km-50km ranges.
 */
export declare function getGeohashRange(lat: number, lng: number, radiusKm: number): [string, string];
/**
 * Calculates all 8 adjacent geohash cells plus the center cell.
 * This is used to solve the "edge case" where results are missed at grid boundaries.
 */
export declare function getNeighbors(lat: number, lng: number, radiusKm: number): [string, string][];
/**
 * Haversine formula to filter results precisely in memory
 */
export declare function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
