/**
 * Feature Gating Hook
 * 
 * Controls access to features based on subscription tier.
 * Fetches feature access from database (feature_tier_access table) for admin control.
 * Falls back to hardcoded defaults when database is unavailable.
 * 
 * Tier Feature Matrix:
 * - Free: Basic meal generation (limited credits)
 * - Standard: + Single regen, smart edit, grocery gen, full recipe panel
 * - Pro: + Nutrition info, ingredient add to grocery, export, priority support
 * - Family Pro: + Family mode, shared grocery, family activity log
 * - BYOK: Unlimited generations, same as Standard features
 */

import { useSubscription } from '../contexts/SubscriptionContext';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Feature =
    | 'meal_generation'      // All tiers (with credits)
    | 'single_regen'         // Standard+
    | 'smart_edit'           // Standard+
    | 'grocery_generation'   // Standard+
    | 'full_recipe_panel'    // Standard+
    | 'nutrition_info'       // Pro+
    | 'ingredient_add'       // Pro+
    | 'export_share'         // Pro+
    | 'priority_support'     // Pro+
    | 'family_mode'          // Family Pro only
    | 'shared_grocery'       // Family Pro only
    | 'family_activity_log'  // Family Pro only
    | 'show_quantity'        // Standard+ (show ingredient quantities)
    | 'prep_ahead';          // Standard+ (show prep-ahead reminders)

// Define which tier unlocks which features
const FEATURE_TIERS: Record<Feature, string[]> = {
    meal_generation: ['free', 'basic', 'pro', 'family_pro', 'byok'],
    single_regen: ['basic', 'pro', 'family_pro', 'byok'],
    smart_edit: ['basic', 'pro', 'family_pro', 'byok'],
    grocery_generation: ['basic', 'pro', 'family_pro', 'byok'],
    full_recipe_panel: ['basic', 'pro', 'family_pro', 'byok'],
    nutrition_info: ['pro', 'family_pro'],
    ingredient_add: ['pro', 'family_pro'],
    export_share: ['pro', 'family_pro'],
    priority_support: ['pro', 'family_pro'],
    family_mode: ['family_pro'],
    shared_grocery: ['family_pro'],
    family_activity_log: ['family_pro'],
    show_quantity: ['basic', 'pro', 'family_pro', 'byok'],
    prep_ahead: ['basic', 'pro', 'family_pro', 'byok'],
};

// Feature descriptions for upgrade prompts
export const FEATURE_DESCRIPTIONS: Record<Feature, { name: string; requiredTier: string; description: string }> = {
    meal_generation: {
        name: 'Meal Generation',
        requiredTier: 'Free',
        description: 'Generate AI-powered weekly meal plans'
    },
    single_regen: {
        name: 'Single Meal Regeneration',
        requiredTier: 'Standard',
        description: 'Regenerate individual meals you don\'t like'
    },
    smart_edit: {
        name: 'Smart Edit',
        requiredTier: 'Standard',
        description: 'AI-powered meal suggestions based on your changes'
    },
    grocery_generation: {
        name: 'Grocery List Generation',
        requiredTier: 'Standard',
        description: 'Auto-generate shopping lists from meal plans'
    },
    full_recipe_panel: {
        name: 'Full Recipe Panel',
        requiredTier: 'Standard',
        description: 'View detailed recipes with ingredients and steps'
    },
    nutrition_info: {
        name: 'Nutrition Information',
        requiredTier: 'Pro',
        description: 'See estimated calories, protein, carbs, and fat'
    },
    ingredient_add: {
        name: 'Add to Grocery',
        requiredTier: 'Pro',
        description: 'Add recipe ingredients directly to your grocery list'
    },
    export_share: {
        name: 'Export & Share',
        requiredTier: 'Pro',
        description: 'Download or share your meal plans as PDF/image'
    },
    priority_support: {
        name: 'Priority Support',
        requiredTier: 'Pro',
        description: 'Get faster responses from our support team'
    },
    family_mode: {
        name: 'Family Mode',
        requiredTier: 'Family Pro',
        description: 'Share meal plans with up to 5 family members'
    },
    shared_grocery: {
        name: 'Shared Grocery List',
        requiredTier: 'Family Pro',
        description: 'Collaborative grocery list for the whole family'
    },
    family_activity_log: {
        name: 'Family Activity Log',
        requiredTier: 'Family Pro',
        description: 'See what family members have planned or edited'
    },
    show_quantity: {
        name: 'Show Quantities',
        requiredTier: 'Standard',
        description: 'View ingredient quantities in recipes'
    },
    prep_ahead: {
        name: 'Prep-Ahead Reminders',
        requiredTier: 'Standard',
        description: 'Get reminders for meal prep the night before'
    },
};

export interface FeatureGateResult {
    allowed: boolean;
    requiredTier: string;
    currentTier: string;
    featureInfo: typeof FEATURE_DESCRIPTIONS[Feature];
}

/**
 * Hook to check feature access based on subscription
 */
export function useFeatureGate() {
    const { subscription, effectiveTier } = useSubscription();
    const [dbFeatureMatrix, setDbFeatureMatrix] = useState<Record<string, string[]> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Use effectiveTier which accounts for launch trial
    const currentTier = effectiveTier || subscription?.plan_id || 'free';

    // Fetch feature matrix from database on mount
    useEffect(() => {
        async function fetchFeatureMatrix() {
            if (!supabase) {
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('feature_tier_access')
                    .select('feature_id, tier_id, enabled')
                    .eq('enabled', true);

                if (error) {
                    console.warn('Failed to fetch feature matrix:', error);
                    setIsLoading(false);
                    return;
                }

                // Transform to Record<feature, tier[]> format
                const matrix: Record<string, string[]> = {};
                data?.forEach((row: { feature_id: string; tier_id: string }) => {
                    if (!matrix[row.feature_id]) {
                        matrix[row.feature_id] = [];
                    }
                    matrix[row.feature_id].push(row.tier_id);
                });

                setDbFeatureMatrix(matrix);
            } catch (err) {
                console.warn('Error fetching feature matrix:', err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchFeatureMatrix();
    }, []);

    /**
     * Check if user has access to a specific feature
     * Uses database values when available, falls back to hardcoded defaults
     */
    const canAccess = useCallback((feature: Feature): boolean => {
        // Use database matrix if available, otherwise fall back to hardcoded
        const featureMatrix = dbFeatureMatrix || FEATURE_TIERS;
        const allowedTiers = featureMatrix[feature] || FEATURE_TIERS[feature];
        return allowedTiers?.includes(currentTier) ?? false;
    }, [currentTier, dbFeatureMatrix]);

    /**
     * Get detailed gate info for a feature
     */
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

    /**
     * Check multiple features at once
     */
    const canAccessAll = useCallback((features: Feature[]): boolean => {
        return features.every(feature => canAccess(feature));
    }, [canAccess]);

    /**
     * Check if any of the features are accessible
     */
    const canAccessAny = useCallback((features: Feature[]): boolean => {
        return features.some(feature => canAccess(feature));
    }, [canAccess]);

    return {
        currentTier,
        canAccess,
        getFeatureGate,
        canAccessAll,
        canAccessAny,
        isLoading,
        isPro: ['pro', 'family_pro'].includes(currentTier),
        isStandardOrAbove: ['basic', 'pro', 'family_pro', 'byok'].includes(currentTier),
        isFamilyPro: currentTier === 'family_pro',
        isByok: currentTier === 'byok',
    };
}

/**
 * Get upgrade CTA text based on required tier
 */
export function getUpgradeText(requiredTier: string): string {
    switch (requiredTier) {
        case 'Standard':
            return 'Upgrade to Standard for ₹99/mo';
        case 'Pro':
            return 'Upgrade to Pro for ₹199/mo';
        case 'Family Pro':
            return 'Upgrade to Family Pro for ₹299/mo';
        default:
            return 'Upgrade to unlock';
    }
}
