export type BillingFeature =
    | 'meal_generation'
    | 'single_regen'
    | 'smart_edit'
    | 'grocery_generation'
    | 'full_recipe_panel'
    | 'nutrition_info'
    | 'ingredient_add'
    | 'export_share'
    | 'priority_support'
    | 'family_mode'
    | 'shared_grocery'
    | 'family_activity_log'
    | 'show_quantity'
    | 'prep_ahead';

export type BillingActionKind = 'meal' | 'grocery' | 'edit' | 'regen';

export const DEFAULT_FEATURE_TIERS: Record<BillingFeature, string[]> = {
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

export const FEATURE_DESCRIPTIONS: Record<BillingFeature, { name: string; requiredTier: string; description: string }> = {
    meal_generation: {
        name: 'Meal Generation',
        requiredTier: 'Free',
        description: 'Generate AI-powered weekly meal plans'
    },
    single_regen: {
        name: 'Single Meal Regeneration',
        requiredTier: 'Basic',
        description: 'Regenerate individual meals you do not like'
    },
    smart_edit: {
        name: 'Smart Edit',
        requiredTier: 'Basic',
        description: 'AI-powered meal suggestions based on your changes'
    },
    grocery_generation: {
        name: 'Grocery List Generation',
        requiredTier: 'Basic',
        description: 'Auto-generate shopping lists from meal plans'
    },
    full_recipe_panel: {
        name: 'Full Recipe Panel',
        requiredTier: 'Basic',
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
        description: 'Download or share your meal plans as PDF or image'
    },
    priority_support: {
        name: 'Priority Support',
        requiredTier: 'Pro',
        description: 'Get faster responses from support'
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
        requiredTier: 'Basic',
        description: 'View ingredient quantities in recipes'
    },
    prep_ahead: {
        name: 'Prep-Ahead Reminders',
        requiredTier: 'Basic',
        description: 'Get reminders for meal prep the night before'
    },
};

export const ACTION_FEATURES: Record<BillingActionKind, BillingFeature> = {
    meal: 'meal_generation',
    grocery: 'grocery_generation',
    edit: 'smart_edit',
    regen: 'single_regen',
};

export function getAllowedTiers(
    feature: BillingFeature,
    featureMatrix?: Record<string, string[]> | null
): string[] {
    if (featureMatrix) {
        return featureMatrix[feature] ?? [];
    }

    return DEFAULT_FEATURE_TIERS[feature] || [];
}

export function canAccessFeature(
    feature: BillingFeature,
    tier: string,
    featureMatrix?: Record<string, string[]> | null
): boolean {
    return getAllowedTiers(feature, featureMatrix).includes(tier);
}

export function getRequiredTierLabel(feature: BillingFeature): string {
    return FEATURE_DESCRIPTIONS[feature].requiredTier;
}
