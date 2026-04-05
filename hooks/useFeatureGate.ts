/**
 * Feature Gating Hook
 *
 * Controls access to features based on subscription tier.
 * Fetches feature access from database (feature_tier_access table) for admin control.
 * Falls back to hardcoded defaults when database is unavailable.
 */

import { useSubscription } from '../contexts/SubscriptionContext';
import { useCallback } from 'react';
import {
    BillingFeature as Feature,
    FEATURE_DESCRIPTIONS,
    canAccessFeature,
} from '../lib/billing/featureAccess';

export type { Feature };
export { FEATURE_DESCRIPTIONS };

export interface FeatureGateResult {
    allowed: boolean;
    requiredTier: string;
    currentTier: string;
    featureInfo: typeof FEATURE_DESCRIPTIONS[Feature];
}

export function useFeatureGate() {
    const { subscription, effectiveTier, featureMatrix, loading } = useSubscription();

    const currentTier = effectiveTier || subscription?.plan_id || 'free';

    const canAccess = useCallback((feature: Feature): boolean => {
        return canAccessFeature(feature, currentTier, featureMatrix ?? undefined);
    }, [currentTier, featureMatrix]);

    const getFeatureGate = useCallback((feature: Feature): FeatureGateResult => {
        const allowed = canAccess(feature);
        const featureInfo = FEATURE_DESCRIPTIONS[feature];

        return {
            allowed,
            requiredTier: featureInfo.requiredTier,
            currentTier,
            featureInfo,
        };
    }, [currentTier, canAccess]);

    const canAccessAll = useCallback((features: Feature[]): boolean => {
        return features.every(feature => canAccess(feature));
    }, [canAccess]);

    const canAccessAny = useCallback((features: Feature[]): boolean => {
        return features.some(feature => canAccess(feature));
    }, [canAccess]);

    return {
        currentTier,
        canAccess,
        getFeatureGate,
        canAccessAll,
        canAccessAny,
        isLoading: loading,
        isPro: ['pro', 'family_pro'].includes(currentTier),
        isStandardOrAbove: ['basic', 'pro', 'family_pro', 'byok'].includes(currentTier),
        isFamilyPro: currentTier === 'family_pro',
        isByok: currentTier === 'byok',
    };
}

export function getUpgradeText(requiredTier: string): string {
    switch (requiredTier) {
        case 'Standard':
        case 'Basic':
            return 'Upgrade to Basic for Rs 99/mo';
        case 'Pro':
            return 'Upgrade to Pro for Rs 199/mo';
        case 'Family Pro':
            return 'Upgrade to Family Pro for Rs 299/mo';
        default:
            return 'Upgrade to unlock';
    }
}
