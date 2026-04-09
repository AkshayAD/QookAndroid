import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useFamily } from './FamilyContext';
import { useSettings } from './SettingsContext';
import {
    getUserSubscription,
    getUserCredits,
    getSubscriptionPlans,
    getEnabledFeatureMatrix,
    checkRateLimit,
    claimWeeklyBonus,
    createTrialSubscription,
    getLaunchOfferSettings,
    FeatureAccessMatrix,
} from '../services/subscriptionService';
import { SubscriptionPlan, UserSubscription, UserCredits } from '../types/subscription';
import { ACTION_FEATURES, canAccessFeature } from '../lib/billing/featureAccess';

interface SubscriptionContextType {
    subscription: UserSubscription | null;
    credits: UserCredits | null;
    plans: SubscriptionPlan[];
    featureMatrix: FeatureAccessMatrix | null;
    loading: boolean;
    isTrialActive: boolean;
    isLaunchTrial: boolean;
    effectiveTier: string;
    trialDaysRemaining: number;
    canGenerate: (type: 'meal' | 'grocery' | 'edit' | 'regen') => boolean;
    useCredits: (type: 'meal_generation' | 'grocery_generation' | 'smart_edit' | 'single_regen') => Promise<boolean>;
    checkRate: (action: string) => Promise<boolean>;
    refreshCredits: (options?: { force?: boolean }) => Promise<void>;
    claimBonus: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);
const SUBSCRIPTION_BOOTSTRAP_CACHE_TTL_MS = 5 * 60 * 1000;

type SubscriptionBootstrapCache = {
    subscription: UserSubscription | null;
    credits: UserCredits | null;
    fetchedAt: number;
};

function getSubscriptionBootstrapCacheKey(userId: string, familyGroupId: string | null) {
    return `qookcommander_subscription_bootstrap_v1:${userId}:${familyGroupId ?? 'personal'}`;
}

function readSubscriptionBootstrapCache(userId: string, familyGroupId: string | null): SubscriptionBootstrapCache | null {
    try {
        const raw = window.localStorage.getItem(getSubscriptionBootstrapCacheKey(userId, familyGroupId));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as SubscriptionBootstrapCache;
        if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > SUBSCRIPTION_BOOTSTRAP_CACHE_TTL_MS) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function writeSubscriptionBootstrapCache(
    userId: string,
    familyGroupId: string | null,
    subscription: UserSubscription | null,
    credits: UserCredits | null
) {
    try {
        window.localStorage.setItem(
            getSubscriptionBootstrapCacheKey(userId, familyGroupId),
            JSON.stringify({
                subscription,
                credits,
                fetchedAt: Date.now(),
            } satisfies SubscriptionBootstrapCache)
        );
    } catch {
        // Ignore cache write failures and continue with live data only.
    }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { isFamilyModeActive, familyGroup, setFamilyModeActive } = useFamily();
    const { apiKey } = useSettings();
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [featureMatrix, setFeatureMatrix] = useState<FeatureAccessMatrix | null>(null);
    const [loading, setLoading] = useState(true);
    const [launchOfferTier, setLaunchOfferTier] = useState<string>('pro');
    const activeFamilyGroupId = isFamilyModeActive && familyGroup?.id ? familyGroup.id : null;
    const creditRefreshPromiseRef = useRef<Promise<UserCredits | null> | null>(null);
    const creditRefreshKeyRef = useRef<string | null>(null);

    const loadCreditSummary = useCallback(async (userId: string, familyGroupId: string | null): Promise<UserCredits | null> => {
        const candidateGroupIds = familyGroupId ? [familyGroupId, null] : [null];

        for (let attempt = 0; attempt < 2; attempt++) {
            for (const candidateGroupId of candidateGroupIds) {
                const summary = await getUserCredits(userId, candidateGroupId, { force: attempt > 0 });

                if (!summary) {
                    continue;
                }

                if (familyGroupId && !summary.family_mode) {
                    setFamilyModeActive(false);
                }

                return summary;
            }

            if (attempt === 0) {
                await new Promise((resolve) => window.setTimeout(resolve, 300));
            }
        }

        return null;
    }, [setFamilyModeActive]);

    const refreshCreditSummary = useCallback(async (
        userId: string,
        familyGroupId: string | null,
        options?: { force?: boolean }
    ): Promise<UserCredits | null> => {
        const requestKey = `${userId}:${familyGroupId ?? 'personal'}`;
        const shouldReuseInFlight = !options?.force &&
            creditRefreshPromiseRef.current &&
            creditRefreshKeyRef.current === requestKey;

        if (shouldReuseInFlight) {
            return creditRefreshPromiseRef.current;
        }

        const requestPromise = loadCreditSummary(userId, familyGroupId).finally(() => {
            if (creditRefreshPromiseRef.current === requestPromise) {
                creditRefreshPromiseRef.current = null;
                creditRefreshKeyRef.current = null;
            }
        });

        creditRefreshPromiseRef.current = requestPromise;
        creditRefreshKeyRef.current = requestKey;
        return requestPromise;
    }, [loadCreditSummary]);

    useEffect(() => {
        const loadSubscriptionData = async () => {
            setLoading(true);
            try {
                if (user?.id) {
                    const cachedState = readSubscriptionBootstrapCache(user.id, activeFamilyGroupId);
                    if (cachedState) {
                        setSubscription(cachedState.subscription);
                        setCredits(cachedState.credits);
                    }
                }

                const loadedPlans = await getSubscriptionPlans();
                setPlans(loadedPlans);

                const loadedFeatureMatrix = await getEnabledFeatureMatrix();
                setFeatureMatrix(loadedFeatureMatrix);

                const launchOffer = await getLaunchOfferSettings();
                if (launchOffer?.effective_tier) {
                    setLaunchOfferTier(launchOffer.effective_tier);
                }

                if (!user?.id) {
                    setSubscription(null);
                    setCredits(null);
                    return;
                }

                let sub = await getUserSubscription(user.id);

                if (!sub) {
                    await createTrialSubscription(user.id);
                    sub = await getUserSubscription(user.id);
                }

                setSubscription(sub);

                const summary = await refreshCreditSummary(user.id, activeFamilyGroupId, { force: true });
                setCredits((previous) => summary ?? previous);
                writeSubscriptionBootstrapCache(user.id, activeFamilyGroupId, sub, summary);
            } catch (error) {
                console.error('Error loading subscription:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSubscriptionData();
    }, [user?.id, activeFamilyGroupId, refreshCreditSummary]);

    useEffect(() => {
        const handleRefreshCredits = () => {
            if (user?.id) {
                refreshCreditSummary(user.id, activeFamilyGroupId, { force: true }).then((summary) => {
                    setCredits((previous) => summary ?? previous);
                });
            }
        };

        window.addEventListener('refresh-credits', handleRefreshCredits);
        return () => window.removeEventListener('refresh-credits', handleRefreshCredits);
    }, [user?.id, activeFamilyGroupId, refreshCreditSummary]);

    const isTrialActive = Boolean(
        subscription?.plan_id === 'free' &&
        subscription?.trial_ends_at &&
        new Date(subscription.trial_ends_at) > new Date()
    );

    const isLaunchTrial = isTrialActive;
    const trialDaysRemaining = isTrialActive && subscription?.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
    const effectiveTier = isLaunchTrial ? launchOfferTier : (credits?.effective_tier || subscription?.plan_id || 'free');

    const isUsingByok = Boolean(
        credits?.byok_enabled &&
        credits?.billing_preference === 'byok' &&
        apiKey?.trim()
    );

    const canGenerate = (type: 'meal' | 'grocery' | 'edit' | 'regen'): boolean => {
        if (!credits) {
            return false;
        }

        if (type === 'meal') {
            return isUsingByok || credits.total_credits > 0;
        }

        return canAccessFeature(ACTION_FEATURES[type], effectiveTier, featureMatrix ?? undefined);
    };

    const useCredits = async (
        _type: 'meal_generation' | 'grocery_generation' | 'smart_edit' | 'single_regen'
    ): Promise<boolean> => {
        if (!user?.id) {
            return false;
        }

        if (isUsingByok) {
            return true;
        }

        await refreshCredits();
        return true;
    };

    const checkRate = async (action: string): Promise<boolean> => {
        if (!user?.id) {
            return true;
        }

        return checkRateLimit(user.id, action, 15);
    };

    const refreshCredits = useCallback(async (options?: { force?: boolean }) => {
        if (!user?.id) {
            return;
        }

        const summary = await refreshCreditSummary(user.id, activeFamilyGroupId, { force: options?.force ?? true });
        setCredits((previous) => summary ?? previous);
    }, [user?.id, activeFamilyGroupId, refreshCreditSummary]);

    const claimBonus = async (): Promise<boolean> => {
        if (!user?.id) {
            return false;
        }

        const success = await claimWeeklyBonus(user.id);
        if (success) {
            await refreshCredits();
        }
        return success;
    };

    return (
        <SubscriptionContext.Provider value={{
            subscription,
            credits,
            plans,
            featureMatrix,
            loading,
            isTrialActive,
            isLaunchTrial,
            effectiveTier,
            trialDaysRemaining,
            canGenerate,
            useCredits,
            checkRate,
            refreshCredits,
            claimBonus,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        return {
            subscription: null,
            credits: null,
            plans: [],
            featureMatrix: null,
            loading: false,
            isTrialActive: false,
            isLaunchTrial: false,
            effectiveTier: 'free',
            trialDaysRemaining: 0,
            canGenerate: () => true,
            useCredits: async () => true,
            checkRate: async () => true,
            refreshCredits: async () => { },
            claimBonus: async () => false,
        };
    }
    return context;
}
