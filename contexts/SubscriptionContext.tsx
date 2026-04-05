import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
    refreshCredits: () => Promise<void>;
    claimBonus: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

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

    const loadCreditSummary = useCallback(async (userId: string, familyGroupId: string | null): Promise<UserCredits | null> => {
        const candidateGroupIds = familyGroupId ? [familyGroupId, null] : [null];

        for (let attempt = 0; attempt < 2; attempt++) {
            for (const candidateGroupId of candidateGroupIds) {
                const summary = await getUserCredits(userId, candidateGroupId);

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

    useEffect(() => {
        const loadSubscriptionData = async () => {
            setLoading(true);
            try {
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

                const summary = await loadCreditSummary(user.id, activeFamilyGroupId);
                setCredits((previous) => summary ?? previous);
            } catch (error) {
                console.error('Error loading subscription:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSubscriptionData();
    }, [user?.id, activeFamilyGroupId, loadCreditSummary]);

    useEffect(() => {
        const handleRefreshCredits = () => {
            if (user?.id) {
                loadCreditSummary(user.id, activeFamilyGroupId).then((summary) => {
                    setCredits((previous) => summary ?? previous);
                });
            }
        };

        window.addEventListener('refresh-credits', handleRefreshCredits);
        return () => window.removeEventListener('refresh-credits', handleRefreshCredits);
    }, [user?.id, activeFamilyGroupId, loadCreditSummary]);

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

    const refreshCredits = async () => {
        if (!user?.id) {
            return;
        }

        const summary = await loadCreditSummary(user.id, activeFamilyGroupId);
        setCredits((previous) => summary ?? previous);
    };

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
