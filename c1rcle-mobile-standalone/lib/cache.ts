// Offline caching service for events and tickets
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEYS = {
    events: "c1rcle_cached_events",
    featuredEvents: "c1rcle_cached_featured",
    userOrders: "c1rcle_cached_orders",
    lastSync: "c1rcle_last_sync",
};

// Maximum cache age in milliseconds (1 hour)
const MAX_CACHE_AGE = 60 * 60 * 1000;

interface CachedData<T> {
    data: T;
    timestamp: number;
}

// Save data to cache
export async function cacheData<T>(key: string, data: T): Promise<void> {
    try {
        const cached: CachedData<T> = {
            data,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
        console.error("Error caching data:", error);
    }
}

// Get data from cache
export async function getCachedData<T>(
    key: string,
    maxAge: number = MAX_CACHE_AGE
): Promise<{ data: T | null; isStale: boolean }> {
    try {
        const cached = await AsyncStorage.getItem(key);
        if (!cached) {
            return { data: null, isStale: true };
        }

        const parsed: CachedData<T> = JSON.parse(cached);
        const age = Date.now() - parsed.timestamp;
        const isStale = age > maxAge;

        return { data: parsed.data, isStale };
    } catch (error) {
        console.error("Error getting cached data:", error);
        return { data: null, isStale: true };
    }
}

// Clear specific cache
export async function clearCache(key: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(key);
    } catch (error) {
        console.error("Error clearing cache:", error);
    }
}

// Clear all caches
export async function clearAllCaches(): Promise<void> {
    try {
        const keys = Object.values(CACHE_KEYS);
        await AsyncStorage.multiRemove(keys);
    } catch (error) {
        console.error("Error clearing all caches:", error);
    }
}

// Cache events
export async function cacheEvents(events: any[]): Promise<void> {
    await cacheData(CACHE_KEYS.events, events);
}

// Get cached events
export async function getCachedEvents(): Promise<{
    data: any[] | null;
    isStale: boolean;
}> {
    return getCachedData<any[]>(CACHE_KEYS.events);
}

// Cache featured events
export async function cacheFeaturedEvents(events: any[]): Promise<void> {
    await cacheData(CACHE_KEYS.featuredEvents, events);
}

// Get cached featured events
export async function getCachedFeaturedEvents(): Promise<{
    data: any[] | null;
    isStale: boolean;
}> {
    return getCachedData<any[]>(CACHE_KEYS.featuredEvents);
}

// Cache user orders
export async function cacheUserOrders(orders: any[]): Promise<void> {
    await cacheData(CACHE_KEYS.userOrders, orders);
}

// Get cached user orders
export async function getCachedUserOrders(): Promise<{
    data: any[] | null;
    isStale: boolean;
}> {
    return getCachedData<any[]>(CACHE_KEYS.userOrders);
}

// Check if we have any cached data (for offline indicator)
export async function hasOfflineData(): Promise<boolean> {
    const { data: events } = await getCachedEvents();
    return events !== null && events.length > 0;
}

// Get last sync time
export async function getLastSyncTime(): Promise<Date | null> {
    try {
        const timestamp = await AsyncStorage.getItem(CACHE_KEYS.lastSync);
        if (timestamp) {
            return new Date(parseInt(timestamp, 10));
        }
        return null;
    } catch {
        return null;
    }
}

// Update last sync time
export async function updateLastSyncTime(): Promise<void> {
    try {
        await AsyncStorage.setItem(CACHE_KEYS.lastSync, Date.now().toString());
    } catch (error) {
        console.error("Error updating last sync time:", error);
    }
}
