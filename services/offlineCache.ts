/**
 * Offline Cache Service
 * Provides persistent local storage for mobile apps using Capacitor Preferences.
 * Falls back to localStorage for web platform.
 */

import { Preferences } from '@capacitor/preferences';
import { isNative } from '../utils/platform';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    version: number;
}

// Increment when cache structure changes to invalidate old data
const CACHE_VERSION = 1;

// Cache key prefixes
const CACHE_KEYS = {
    SCHEDULE: 'cache_schedule',
    WEEKLY_PLAN: 'cache_weekly_plan',
    PROFILES: 'cache_profiles',
    HOUSEHOLD: 'cache_household',
    GROCERY: 'cache_grocery',
    USER_SETTINGS: 'cache_user_settings',
    SUBSCRIPTION: 'cache_subscription',
    SYNC_QUEUE: 'sync_queue',
} as const;

// Max age defaults (in milliseconds)
const MAX_AGE = {
    SHORT: 5 * 60 * 1000,        // 5 minutes (subscription, credits)
    MEDIUM: 60 * 60 * 1000,      // 1 hour (household settings)
    LONG: 24 * 60 * 60 * 1000,   // 24 hours (profiles, preferences)
    INFINITE: Infinity,          // Until explicitly invalidated (current plan)
} as const;

export { CACHE_KEYS, MAX_AGE };

/**
 * Core cache operations
 */
export const offlineCache = {
    /**
     * Store data in cache with timestamp
     */
    async set<T>(key: string, data: T): Promise<void> {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            version: CACHE_VERSION,
        };

        const value = JSON.stringify(entry);

        if (isNative()) {
            await Preferences.set({ key, value });
        } else {
            localStorage.setItem(key, value);
        }
    },

    /**
     * Retrieve data from cache
     * @param key - Cache key
     * @param maxAgeMs - Optional max age in milliseconds. If expired, returns null
     */
    async get<T>(key: string, maxAgeMs?: number): Promise<T | null> {
        let raw: string | null;

        if (isNative()) {
            const result = await Preferences.get({ key });
            raw = result.value;
        } else {
            raw = localStorage.getItem(key);
        }

        if (!raw) return null;

        try {
            const entry: CacheEntry<T> = JSON.parse(raw);

            // Check version compatibility
            if (entry.version !== CACHE_VERSION) {
                console.log(`[Cache] Version mismatch for ${key}, invalidating`);
                await this.remove(key);
                return null;
            }

            // Check staleness
            if (maxAgeMs && Date.now() - entry.timestamp > maxAgeMs) {
                console.log(`[Cache] Data stale for ${key} (age: ${Date.now() - entry.timestamp}ms)`);
                return null; // Return null but don't delete - stale data is still useful as fallback
            }

            return entry.data;
        } catch (e) {
            console.error(`[Cache] Parse error for ${key}:`, e);
            await this.remove(key);
            return null;
        }
    },

    /**
     * Get data even if stale (for fallback scenarios)
     */
    async getEvenIfStale<T>(key: string): Promise<T | null> {
        let raw: string | null;

        if (isNative()) {
            const result = await Preferences.get({ key });
            raw = result.value;
        } else {
            raw = localStorage.getItem(key);
        }

        if (!raw) return null;

        try {
            const entry: CacheEntry<T> = JSON.parse(raw);
            // Ignore version and staleness - return whatever we have
            return entry.data;
        } catch {
            return null;
        }
    },

    /**
     * Remove a specific cache entry
     */
    async remove(key: string): Promise<void> {
        if (isNative()) {
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    },

    /**
     * Clear all cache entries (use carefully)
     */
    async clear(): Promise<void> {
        if (isNative()) {
            await Preferences.clear();
        } else {
            // Only clear cache keys, not all localStorage
            Object.values(CACHE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        }
    },

    /**
     * Get cache timestamp for a key
     */
    async getTimestamp(key: string): Promise<number | null> {
        let raw: string | null;

        if (isNative()) {
            const result = await Preferences.get({ key });
            raw = result.value;
        } else {
            raw = localStorage.getItem(key);
        }

        if (!raw) return null;

        try {
            const entry: CacheEntry<unknown> = JSON.parse(raw);
            return entry.timestamp;
        } catch {
            return null;
        }
    },

    /**
     * Check if cache exists and is fresh
     */
    async isFresh(key: string, maxAgeMs: number): Promise<boolean> {
        const timestamp = await this.getTimestamp(key);
        if (!timestamp) return false;
        return Date.now() - timestamp <= maxAgeMs;
    }
};

/**
 * Sync queue for offline changes
 */
interface SyncQueueItem {
    id: string;
    operation: 'create' | 'update' | 'delete';
    table: string;
    data: any;
    timestamp: number;
    retries: number;
}

export const syncQueue = {
    /**
     * Add an operation to the sync queue
     */
    async add(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
        const queue = await this.getAll();
        queue.push({
            ...item,
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retries: 0,
        });
        await offlineCache.set(CACHE_KEYS.SYNC_QUEUE, queue);
    },

    /**
     * Get all pending sync operations
     */
    async getAll(): Promise<SyncQueueItem[]> {
        const queue = await offlineCache.get<SyncQueueItem[]>(CACHE_KEYS.SYNC_QUEUE);
        return queue || [];
    },

    /**
     * Remove a processed item from the queue
     */
    async remove(id: string): Promise<void> {
        const queue = await this.getAll();
        const filtered = queue.filter(item => item.id !== id);
        await offlineCache.set(CACHE_KEYS.SYNC_QUEUE, filtered);
    },

    /**
     * Increment retry count for an item
     */
    async markRetry(id: string): Promise<void> {
        const queue = await this.getAll();
        const item = queue.find(i => i.id === id);
        if (item) {
            item.retries += 1;
            await offlineCache.set(CACHE_KEYS.SYNC_QUEUE, queue);
        }
    },

    /**
     * Get count of pending sync operations
     */
    async getPendingCount(): Promise<number> {
        const queue = await this.getAll();
        return queue.length;
    },

    /**
     * Clear the entire sync queue
     */
    async clear(): Promise<void> {
        await offlineCache.remove(CACHE_KEYS.SYNC_QUEUE);
    }
};
