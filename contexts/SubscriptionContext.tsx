import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
    getUserSubscription,
    getUserCredits,
    getSubscriptionPlans,
    consumeCredits,
    checkRateLimit,
    claimWeeklyBonus,
    createTrialSubscription,
    getLaunchOfferSettings
} from '../services/subscriptionService';
import { SubscriptionPlan, UserSubscription, UserCredits } from '../types/subscription';

interface SubscriptionContextType {
    subscription: UserSubscription | null;
    credits: UserCredits | null;
    plans: SubscriptionPlan[];
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
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [launchOfferTier, setLaunchOfferTier] = useState<string>('family_pro');

    // Load subscription data
    useEffect(() => {
        const loadSubscriptionData = async () => {
            setLoading(true);
            try {
                // Load plans first (public data)
                const loadedPlans = await getSubscriptionPlans();
                setPlans(loadedPlans);

                // Load launch offer settings
                const launchOffer = await getLaunchOfferSettings();
                if (launchOffer?.effective_tier) {
                    setLaunchOfferTier(launchOffer.effective_tier);
                }

                if (!user?.id) {
                    setSubscription(null);
                    setCredits(null);
                    setLoading(false);
                    return;
                }

                // Load user subscription
                let sub = await getUserSubscription(user.id);

                // If no subscription exists, create trial
                if (!sub) {
                    await createTrialSubscription(user.id);
                    sub = await getUserSubscription(user.id);
                }
                setSubscription(sub);

                // Load credits
                const userCredits = await getUserCredits(user.id);
                setCredits(userCredits);

                // Try to claim weekly bonus
                await claimWeeklyBonus(user.id);

                // Refresh credits after bonus claim
                const updatedCredits = await getUserCredits(user.id);
                setCredits(updatedCredits);

            } catch (error) {
                console.error('Error loading subscription:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSubscriptionData();
    }, [user?.id]);

    // Listen for refresh-credits event from trust actions
    useEffect(() => {
        const handleRefreshCredits = () => {
            if (user?.id) {
                getUserCredits(user.id).then(setCredits);
            }
        };

        window.addEventListener('refresh-credits', handleRefreshCredits);
        return () => window.removeEventListener('refresh-credits', handleRefreshCredits);
    }, [user?.id]);

    const isTrialActive = Boolean(
        subscription?.plan_id === 'free' &&
        subscription?.trial_ends_at &&
        new Date(subscription.trial_ends_at) > new Date()
    );

    // Launch trial = free plan with active trial
    const isLaunchTrial = isTrialActive;

    // Calculate days remaining
    const trialDaysRemaining = isTrialActive && subscription?.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    // Effective tier: during launch trial, use family_pro features
    const effectiveTier = isLaunchTrial ? launchOfferTier : (subscription?.plan_id || 'free');

    const canGenerate = (type: 'meal' | 'grocery' | 'edit' | 'regen'): boolean => {
        if (!credits) return false;

        // BYOK users can always generate
        if (credits.byok_enabled) return true;

        switch (type) {
            case 'meal':
                return credits.total_meal_credits > 0;
            case 'grocery':
                return credits.total_grocery_credits > 0;
            case 'edit':
                return credits.total_edit_credits > 0;
            case 'regen':
                return credits.total_regen_credits > 0;
            default:
                return false;
        }
    };

    const useCredits = async (type: 'meal_generation' | 'grocery_generation' | 'smart_edit' | 'single_regen'): Promise<boolean> => {
        if (!user?.id) return false;

        // Check BYOK - no credits needed
        if (credits?.byok_enabled) return true;

        // NOTE: Credits are now consumed server-side by ai-proxy
        // This function just refreshes the local credit state after generation
        await refreshCredits();
        return true;
    };

    const checkRate = async (action: string): Promise<boolean> => {
        if (!user?.id) return true;
        return checkRateLimit(user.id, action, 15); // 15 requests per minute
    };

    const refreshCredits = async () => {
        if (!user?.id) return;
        const userCredits = await getUserCredits(user.id);
        setCredits(userCredits);
    };

    const claimBonus = async (): Promise<boolean> => {
        if (!user?.id) return false;
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
        // Return default values for non-subscription contexts
        return {
            subscription: null,
            credits: null,
            plans: [],
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
