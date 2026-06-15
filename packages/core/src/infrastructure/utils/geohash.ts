/**
 * Lightweight Geohash Utility for Firestore Proximity Queries
 * Based on the Geohash algorithm (Base32 encoding of interleaved bits)
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision: number = 9): string {
  let minLat = -90,
    maxLat = 90;
  let minLng = -180,
    maxLng = 180;
  let geohash = '';
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    let mid;
    if (bit % 2 === 0) {
      mid = (minLng + maxLng) / 2;
      if (lng > mid) {
        ch |= 1 << (4 - (bit % 5));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      mid = (minLat + maxLat) / 2;
      if (lat > mid) {
        ch |= 1 << (4 - (bit % 5));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    bit++;
    if (bit % 5 === 0) {
      geohash += BASE32[ch];
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Calculates geohash range for a given precision to approximate a radius.
 * This is a simplified version suitable for 1km-50km ranges.
 */
export function getGeohashRange(lat: number, lng: number, radiusKm: number): [string, string] {
  // 1 char: 5000km x 5000km
  // 2 chars: 1250km x 625km
  // 3 chars: 156km x 156km
  // 4 chars: 39km x 19km
  // 5 chars: 4.9km x 4.9km
  // 6 chars: 1.2km x 0.6km

  let precision = 10;
  if (radiusKm > 2500) precision = 1;
  else if (radiusKm > 600) precision = 2;
  else if (radiusKm > 80) precision = 3;
  else if (radiusKm > 20) precision = 4;
  else if (radiusKm > 2) precision = 5;
  else precision = 6;

  const hash = encodeGeohash(lat, lng, precision);

  // Return the range [prefix, prefix + '~'] for Firestore range query
  return [hash, hash + '\uf8ff'];
}

/**
 * Calculates all 8 adjacent geohash cells plus the center cell.
 * This is used to solve the "edge case" where results are missed at grid boundaries.
 */
export function getNeighbors(lat: number, lng: number, radiusKm: number): [string, string][] {
  // Safety: Explicit cap to prevent Firestore cost explosion on accidental large inputs
  const safeRadius = Math.min(radiusKm, 50);

  // Determine precision based on radius
  let precision = 10;
  if (safeRadius > 2500) precision = 1;
  else if (safeRadius > 600) precision = 2;
  else if (safeRadius > 80) precision = 3;
  else if (safeRadius > 20) precision = 4;
  else if (safeRadius > 2) precision = 5;
  else precision = 6;

  // Approximate degree shifts for neighbors
  const latDiff = safeRadius / 111.12;
  const lngDiff = safeRadius / (111.12 * Math.cos(lat * (Math.PI / 180)));

  const centers = [
    [lat, lng],
    [lat + latDiff, lng],
    [lat - latDiff, lng],
    [lat, lng + lngDiff],
    [lat, lng - lngDiff],
    [lat + latDiff, lng + lngDiff],
    [lat + latDiff, lng - lngDiff],
    [lat - latDiff, lng + lngDiff],
    [lat - latDiff, lng - lngDiff],
  ];

  const ranges: [string, string][] = [];
  const seenHashes = new Set<string>();

  for (const [cLat, cLng] of centers) {
    const hash = encodeGeohash(cLat, cLng, precision);
    if (!seenHashes.has(hash)) {
      ranges.push([hash, hash + '\uf8ff']);
      seenHashes.add(hash);
    }
  }

  // ⚡ Optimization: Range Merging
  // Sort buy start geohash
  ranges.sort((a, b) => a[0].localeCompare(b[0]));

  const merged: [string, string][] = [];
  if (ranges.length > 0) {
    let current = ranges[0];
    for (let i = 1; i < ranges.length; i++) {
      const next = ranges[i];
      // If next start is before or at current end, merge
      if (next[0] <= current[1]) {
        current[1] = next[1] > current[1] ? next[1] : current[1];
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
  }

  return merged;
}

/**
 * Haversine formula to filter results precisely in memory
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
