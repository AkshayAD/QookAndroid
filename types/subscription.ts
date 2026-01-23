// Subscription-related types

export interface SubscriptionPlan {
    id: string;
    name: string;
    price_inr: number;
    first_month_price?: number;  // Discounted first month price
    regular_price?: number;       // Regular price after first month
    meal_generations: number;
    grocery_generations: number;
    smart_edits: number;
    single_regens: number;
    max_profiles: number;
    history_days: number;
    byok_enabled: boolean;
    weekly_bonus_meals: number;
    weekly_bonus_grocery: number;
    priority_support: boolean;
    can_buy_credits: boolean;
    razorpay_plan_id?: string;
}

export interface UserSubscription {
    id: string;
    user_id: string;
    plan_id: string;
    status: 'active' | 'expired' | 'cancelled' | 'pending';
    started_at: string;
    renews_at: string | null;
    cancelled_at: string | null;
    trial_ends_at: string | null;
    razorpay_subscription_id: string | null;
}

export interface UserCredits {
    total_meal_credits: number;
    total_grocery_credits: number;
    total_edit_credits: number;
    total_regen_credits: number;
    plan_tier: string;
    byok_enabled: boolean;
    trial_ends_at: string | null;
}

export interface CreditPack {
    id: string;
    name: string;
    credits: number;
    price_inr: number;
    discount_pct: number;
}

export interface UsageRecord {
    id: string;
    action_type: 'meal_generation' | 'grocery_generation' | 'smart_edit' | 'single_regen' | 'preference_parse';
    credits_used: number;
    api_source: 'platform' | 'byok';
    created_at: string;
}
