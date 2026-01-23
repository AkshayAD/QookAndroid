/**
 * Cross-platform storage utility for session persistence
 * Uses Capacitor Preferences for native apps, localStorage for web
 */

import { Preferences } from '@capacitor/preferences';

// Augment global Window type for Capacitor
declare global {
    interface Window {
        Capacitor?: {
            isNativePlatform?: () => boolean;
        };
    }
}

// Check if running in native app context
const isCapacitorNative = (): boolean => {
    try {
        return typeof window !== 'undefined' &&
            window.Capacitor !== undefined &&
            window.Capacitor?.isNativePlatform?.() === true;
    } catch {
        return false;
    }
};

/**
 * Native storage implementation using Capacitor Preferences
 * Falls back to localStorage for web
 */
export const nativeStorage = {
    async getItem(key: string): Promise<string | null> {
        if (isCapacitorNative()) {
            try {
                const { value } = await Preferences.get({ key });
                return value;
            } catch (e) {
                console.warn('[Storage] Capacitor Preferences failed, falling back to localStorage', e);
            }
        }
        return localStorage.getItem(key);
    },

    async setItem(key: string, value: string): Promise<void> {
        if (isCapacitorNative()) {
            try {
                await Preferences.set({ key, value });
                return;
            } catch (e) {
                console.warn('[Storage] Capacitor Preferences failed, falling back to localStorage', e);
            }
        }
        localStorage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
        if (isCapacitorNative()) {
            try {
                await Preferences.remove({ key });
                return;
            } catch (e) {
                console.warn('[Storage] Capacitor Preferences failed, falling back to localStorage', e);
            }
        }
        localStorage.removeItem(key);
    }
};

/**
 * Supabase-compatible storage adapter
 * Wraps nativeStorage for Supabase auth
 */
export const supabaseStorage = {
    getItem: (key: string): string | null => {
        // For sync access, use localStorage directly (Supabase will handle refresh)
        return localStorage.getItem(key);
    },

    setItem: (key: string, value: string): void => {
        localStorage.setItem(key, value);
        // Also persist to native storage for durability
        if (isCapacitorNative()) {
            Preferences.set({ key, value }).catch(console.warn);
        }
    },

    removeItem: (key: string): void => {
        localStorage.removeItem(key);
        if (isCapacitorNative()) {
            Preferences.remove({ key }).catch(console.warn);
        }
    }
};

/**
 * Sync session from native storage to localStorage on app launch
 * Call this early in app initialization for native apps
 */
export async function syncSessionFromNativeStorage(): Promise<void> {
    if (!isCapacitorNative()) return;

    try {
        // Look for Supabase session in native storage
        const { value } = await Preferences.get({ key: 'sb-igcmhlfonulqtxsiiisb-auth-token' });
        if (value && !localStorage.getItem('sb-igcmhlfonulqtxsiiisb-auth-token')) {
            localStorage.setItem('sb-igcmhlfonulqtxsiiisb-auth-token', value);
            console.log('[Storage] Synced session from native storage');
        }
    } catch (e) {
        console.warn('[Storage] Failed to sync from native storage', e);
    }
}

// Unified onboarding key constant
export const ONBOARDING_KEY = 'qook_onboarding_completed';
