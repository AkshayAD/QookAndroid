/**
 * Device Fingerprinting Service
 * 
 * Uses FingerprintJS to generate a unique device identifier for anti-abuse prevention.
 * The device hash is stored in Supabase and used to:
 * 1. Detect same-device multi-account trial abuse
 * 2. Track device history for security
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { supabase } from '../lib/supabase';

let cachedVisitorId: string | null = null;

/**
 * Get the current device's fingerprint ID
 * Caches the result for the session to avoid repeated calculations
 */
export async function getDeviceId(): Promise<string> {
    if (cachedVisitorId) {
        return cachedVisitorId;
    }

    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        cachedVisitorId = result.visitorId;
        return cachedVisitorId;
    } catch (error) {
        console.error('Failed to generate device fingerprint:', error);
        // Return a fallback random ID (less secure but prevents blocking users)
        return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Register a device for a user
 * Called on signup/login to track device usage
 */
export async function registerDevice(userId: string): Promise<{
    isNewDevice: boolean;
    trialAlreadyUsed: boolean;
}> {
    const deviceHash = await getDeviceId();

    // Check if this device has been used before
    const { data: existingDevice } = await supabase
        .from('user_devices')
        .select('user_id, trial_granted')
        .eq('device_hash', deviceHash)
        .single();

    if (existingDevice) {
        // Device exists - check if it's a different user
        const isDifferentUser = existingDevice.user_id !== userId;
        const trialAlreadyUsed = existingDevice.trial_granted;

        // Update last_seen for this device
        await supabase
            .from('user_devices')
            .update({ last_seen: new Date().toISOString() })
            .eq('device_hash', deviceHash);

        return {
            isNewDevice: false,
            trialAlreadyUsed: isDifferentUser && trialAlreadyUsed
        };
    }

    // New device - register it
    await supabase.from('user_devices').insert({
        user_id: userId,
        device_hash: deviceHash,
        trial_granted: false, // Will be set true when trial credits are awarded
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString()
    });

    return {
        isNewDevice: true,
        trialAlreadyUsed: false
    };
}

/**
 * Mark trial as granted for this device
 * Called after awarding trial credits
 */
export async function markTrialGranted(userId: string): Promise<void> {
    const deviceHash = await getDeviceId();

    await supabase
        .from('user_devices')
        .update({ trial_granted: true })
        .eq('device_hash', deviceHash)
        .eq('user_id', userId);
}

/**
 * Check if the current device is eligible for trial credits
 */
export async function isDeviceEligibleForTrial(): Promise<boolean> {
    const deviceHash = await getDeviceId();

    const { data } = await supabase
        .from('user_devices')
        .select('trial_granted')
        .eq('device_hash', deviceHash)
        .single();

    // If no record or trial_granted is false, device is eligible
    return !data?.trial_granted;
}
