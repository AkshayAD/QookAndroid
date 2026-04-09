import type { Session } from '@supabase/supabase-js';
import type { PreferenceProfile } from '../types';
import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../utils/platform';
import {
    getHouseholdSettings,
    getPreferenceProfiles,
    getUserProfile,
    getUserSettings,
    type HouseholdSettings,
    type UserProfile,
    type UserSettings,
} from './supabaseService';

export interface AppBootstrapPayload {
    profiles: PreferenceProfile[];
    userSettings: UserSettings | null;
    userProfile: UserProfile | null;
    householdSettings: HouseholdSettings;
}

export interface AppBootstrapResult extends AppBootstrapPayload {
    source: 'server' | 'direct' | 'cache' | 'fallback';
    profilesConfirmed: boolean;
    userSettingsConfirmed: boolean;
    userProfileConfirmed: boolean;
    householdSettingsConfirmed: boolean;
}

const BOOTSTRAP_CACHE_KEY = 'qookcommander_bootstrap_cache_v2';
const LEGACY_BOOTSTRAP_CACHE_KEYS = [
    'qookcommander_bootstrap_cache_v1',
];
const SERVER_BOOTSTRAP_TIMEOUT_MS = 8000;
const DIRECT_BOOTSTRAP_TIMEOUT_MS = 5000;

const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
    city: '',
    country: 'India',
    language: 'English',
    householdSize: 4,
    portionSize: 'regular',
    pantryStaples: [],
    hasTiffin: false,
    tiffinDays: [],
    tiffinFor: [],
    showPrepReminders: true,
    showQuantities: true,
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = globalThis.setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise.then(
            (value) => {
                globalThis.clearTimeout(timeoutId);
                resolve(value);
            },
            (error) => {
                globalThis.clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

function mergeHouseholdSettings(
    householdSettings?: Partial<HouseholdSettings> | null
): HouseholdSettings {
    return {
        ...DEFAULT_HOUSEHOLD_SETTINGS,
        ...(householdSettings || {}),
    };
}

function readCachedBootstrapData(): AppBootstrapPayload | null {
    try {
        const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<AppBootstrapPayload>;
        return {
            profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
            userSettings: parsed.userSettings || null,
            userProfile: parsed.userProfile || null,
            householdSettings: mergeHouseholdSettings(parsed.householdSettings),
        };
    } catch (error) {
        console.warn('[Bootstrap] Unable to read cached bootstrap data.', error);
        return null;
    }
}

export function clearBootstrapCache() {
    try {
        for (const key of [BOOTSTRAP_CACHE_KEY, ...LEGACY_BOOTSTRAP_CACHE_KEYS]) {
            localStorage.removeItem(key);
        }
    } catch (error) {
        console.warn('[Bootstrap] Unable to clear bootstrap cache.', error);
    }
}

function writeCachedBootstrapData(payload: AppBootstrapPayload) {
    try {
        localStorage.setItem(
            BOOTSTRAP_CACHE_KEY,
            JSON.stringify({
                profiles: payload.profiles,
                userSettings: payload.userSettings,
                userProfile: payload.userProfile,
                householdSettings: payload.householdSettings,
            })
        );
    } catch (error) {
        console.warn('[Bootstrap] Unable to cache bootstrap data.', error);
    }
}

async function fetchServerBootstrap(accessToken: string): Promise<AppBootstrapPayload> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), SERVER_BOOTSTRAP_TIMEOUT_MS);

    try {
        const response = await fetch(`${getApiBaseUrl()}/api/bootstrap`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Bootstrap request failed with ${response.status}`);
        }

        const payload = (await response.json()) as AppBootstrapPayload;
        return {
            ...payload,
            householdSettings: mergeHouseholdSettings(payload.householdSettings),
        };
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
}

export async function fetchBootstrapData(activeSession?: Session | null): Promise<AppBootstrapResult> {
    if (!supabase) {
        throw new Error('Supabase is not configured');
    }

    let session = activeSession ?? null;
    if (!session?.access_token || !session.user?.id) {
        const sessionResult = await supabase.auth.getSession();
        session = sessionResult.data.session;
    }

    if (!session?.access_token || !session.user?.id) {
        throw new Error('Missing authenticated session');
    }

    const cached = readCachedBootstrapData();

    try {
        const payload = await fetchServerBootstrap(session.access_token);
        writeCachedBootstrapData(payload);
        return {
            ...payload,
            source: 'server',
            profilesConfirmed: true,
            userSettingsConfirmed: true,
            userProfileConfirmed: true,
            householdSettingsConfirmed: true,
        };
    } catch (error) {
        console.warn('[Bootstrap] Server bootstrap failed, falling back to direct client reads.', error);
    }

    const userId = session.user.id;
    const [profilesResult, userSettingsResult, userProfileResult, householdSettingsResult] = await Promise.allSettled([
        withTimeout(getPreferenceProfiles(userId), DIRECT_BOOTSTRAP_TIMEOUT_MS, 'profile bootstrap'),
        withTimeout(getUserSettings(userId), DIRECT_BOOTSTRAP_TIMEOUT_MS, 'user settings bootstrap'),
        withTimeout(getUserProfile(userId), DIRECT_BOOTSTRAP_TIMEOUT_MS, 'user profile bootstrap'),
        withTimeout(getHouseholdSettings(userId), DIRECT_BOOTSTRAP_TIMEOUT_MS, 'household settings bootstrap'),
    ]);

    const payload: AppBootstrapPayload = {
        profiles: profilesResult.status === 'fulfilled' ? profilesResult.value : cached?.profiles || [],
        userSettings: userSettingsResult.status === 'fulfilled' ? userSettingsResult.value : cached?.userSettings || null,
        userProfile: userProfileResult.status === 'fulfilled' ? userProfileResult.value : cached?.userProfile || null,
        householdSettings:
            householdSettingsResult.status === 'fulfilled'
                ? mergeHouseholdSettings(householdSettingsResult.value)
                : mergeHouseholdSettings(cached?.householdSettings),
    };

    if (
        profilesResult.status === 'fulfilled' ||
        userSettingsResult.status === 'fulfilled' ||
        userProfileResult.status === 'fulfilled' ||
        householdSettingsResult.status === 'fulfilled'
    ) {
        writeCachedBootstrapData(payload);
    }

    const source: AppBootstrapResult['source'] =
        profilesResult.status === 'fulfilled' ||
        userSettingsResult.status === 'fulfilled' ||
        userProfileResult.status === 'fulfilled' ||
        householdSettingsResult.status === 'fulfilled'
            ? 'direct'
            : cached
                ? 'cache'
                : 'fallback';

    return {
        ...payload,
        source,
        profilesConfirmed: profilesResult.status === 'fulfilled',
        userSettingsConfirmed: userSettingsResult.status === 'fulfilled',
        userProfileConfirmed: userProfileResult.status === 'fulfilled',
        householdSettingsConfirmed: householdSettingsResult.status === 'fulfilled',
    };
}
