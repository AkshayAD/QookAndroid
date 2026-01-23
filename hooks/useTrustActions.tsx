/**
 * Trust Action Hooks
 * 
 * React hooks for managing trust actions in components.
 * Handles triggering actions at the right time and showing rewards.
 */

import { useEffect, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    completeTrustAction,
    hasCompletedAction,
    checkReturn24hEligibility,
    TrustActionType,
    TRUST_ACTION_LABELS
} from '../services/trustActions';
import { registerDevice, markTrialGranted, isDeviceEligibleForTrial } from '../services/deviceFingerprint';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Gift } from 'lucide-react';
import React from 'react';

/**
 * Hook to handle signup trust action
 * Automatically awards signup credits on first login
 */
export function useSignupTrustAction() {
    const { user } = useAuth();
    const [processed, setProcessed] = useState(false);

    useEffect(() => {
        if (!user || processed) return;

        async function processSignup() {
            // Register device for fingerprinting
            const deviceStatus = await registerDevice(user!.id);

            // Check if device is eligible for trial
            if (!deviceStatus.trialAlreadyUsed) {
                // Award signup credits
                const result = await completeTrustAction(user!.id, 'signup');

                if (result.creditsAwarded > 0) {
                    // Mark device as having received trial
                    await markTrialGranted(user!.id);

                    // Show toast
                    showCreditToast('signup', result.creditsAwarded);
                }
            }

            setProcessed(true);
        }

        processSignup();
    }, [user, processed]);
}

/**
 * Hook to check and award profile completion credits
 */
export function useProfileCompleteTrustAction() {
    const { user } = useAuth();

    return useCallback(async () => {
        if (!user) return;

        const result = await completeTrustAction(user.id, 'complete_profile');

        if (result.creditsAwarded > 0) {
            showCreditToast('complete_profile', result.creditsAwarded);
        }

        return result;
    }, [user]);
}

/**
 * Hook to track menu generation and award credits on 2nd generation
 * Checks database count of weekly_plans to work across devices
 */
export function useSecondMenuTrustAction() {
    const { user } = useAuth();

    return useCallback(async () => {
        if (!user) return;

        // Check if already completed to avoid unnecessary DB call
        const alreadyDone = await hasCompletedAction(user.id, 'generate_second_menu');
        if (alreadyDone) return;

        // Get count from database (works across devices)
        const { getUserGenerationCount } = await import('../services/trustActions');
        const count = await getUserGenerationCount(user.id);

        // Only award on exactly 2nd generation
        if (count !== 2) return;

        const result = await completeTrustAction(user.id, 'generate_second_menu');

        if (result.creditsAwarded > 0) {
            showCreditToast('generate_second_menu', result.creditsAwarded);
        }

        return result;
    }, [user]);
}

/**
 * Hook to award credits when user shares meal plan or grocery list
 * Call this after any successful share action
 */
export function useShareMenuTrustAction() {
    const { user } = useAuth();

    return useCallback(async () => {
        if (!user) return;

        const result = await completeTrustAction(user.id, 'share_menu_commands');

        if (result.creditsAwarded > 0) {
            showCreditToast('share_menu_commands', result.creditsAwarded);
        }

        return result;
    }, [user]);
}

/**
 * Hook to handle PWA install trust action
 */
export function usePWAInstallTrustAction() {
    const { user } = useAuth();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [canInstall, setCanInstall] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setCanInstall(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const installPWA = useCallback(async () => {
        if (!deferredPrompt || !user) return false;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            // Award credits
            const result = await completeTrustAction(user.id, 'install_pwa');

            if (result.creditsAwarded > 0) {
                showCreditToast('install_pwa', result.creditsAwarded);
            }

            setDeferredPrompt(null);
            setCanInstall(false);
            return true;
        }

        return false;
    }, [deferredPrompt, user]);

    return { canInstall, installPWA };
}

/**
 * Show a toast notification for earned credits
 */
function showCreditToast(action: TrustActionType, credits: number) {
    // Dispatch event to trigger credit refresh in SubscriptionContext
    window.dispatchEvent(new CustomEvent('refresh-credits'));

    toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} 
      max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto 
      flex ring-1 ring-black ring-opacity-5`}
        >
            <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center">
                            <Gift className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                            +{credits} Credit{credits > 1 ? 's' : ''} Earned! 🎉
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                            {TRUST_ACTION_LABELS[action]}
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex border-l border-gray-200">
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-orange-600 hover:text-orange-500 focus:outline-none"
                >
                    Close
                </button>
            </div>
        </div>
    ), { duration: 4000 });
}

/**
 * Hook to sync phone number between profile and trust action
 * If user has phone in profile but hasn't received add_phone credit, award it retroactively
 */
export function usePhoneTrustSync() {
    const { user } = useAuth();
    const [synced, setSynced] = useState(false);

    useEffect(() => {
        if (!user || synced) return;

        async function syncPhone() {
            try {
                // Check if user already has add_phone action
                const alreadyHasCredit = await hasCompletedAction(user!.id, 'add_phone');
                if (alreadyHasCredit) {
                    setSynced(true);
                    return;
                }

                // Check if user has phone in profile
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('phone, phone_hash')
                    .eq('id', user!.id)
                    .single();

                if (profile?.phone && profile?.phone_hash) {
                    // User has phone but no credit - award retroactively
                    const result = await completeTrustAction(user!.id, 'add_phone', {
                        phone: profile.phone,
                        retroactive: true
                    });

                    if (result.creditsAwarded > 0) {
                        showCreditToast('add_phone', result.creditsAwarded);
                    }
                }

                setSynced(true);
            } catch (err) {
                console.error('Failed to sync phone trust action:', err);
                setSynced(true);
            }
        }

        // Delay to avoid blocking initial render
        const timer = setTimeout(syncPhone, 3000);
        return () => clearTimeout(timer);
    }, [user, synced]);
}
