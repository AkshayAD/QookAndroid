// Subscription-related types

export interface SubscriptionPlan {
    id: string;
    name: string;
    price_inr: number;
    first_month_price?: number;
    regular_price?: number;
    monthly_credits: number;
    weekly_bonus_credits: number;
    trial_credits: number;
    max_profiles: number;
    history_days: number;
    byok_enabled: boolean;
    priority_support: boolean;
    can_buy_credits: boolean;
    family_member_limit?: number;
    sort_order?: number;
    features?: string[];
    razorpay_plan_id?: string;
    razorpay_offer_id?: string;
    razorpay_upi_offer_id?: string;
    is_active?: boolean;

    // Deprecated compatibility aliases for older UI surfaces.
    meal_generations?: number;
    grocery_generations?: number;
    smart_edits?: number;
    single_regens?: number;
    weekly_bonus_meals?: number;
    weekly_bonus_grocery?: number;
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
    total_credits: number;
    subscription_credits: number;
    purchased_credits: number;
    bonus_credits: number;
    trial_credits: number;
    referral_credits: number;
    plan_tier: string;
    effective_tier: string;
    byok_enabled: boolean;
    billing_preference: 'credits' | 'byok';
    trial_ends_at: string | null;
    weekly_bonus_credits: number;
    next_weekly_bonus_at: string | null;
    weekly_bonus_claimable: boolean;
    weekly_bonus_window_start: string | null;
    weekly_bonus_window_end: string | null;
    weekly_bonus_claimed_for_window: boolean;
    family_mode: boolean;
    family_group_id: string | null;

    // Deprecated compatibility aliases for existing UI code.
    total_meal_credits: number;
    total_grocery_credits: number;
    total_edit_credits: number;
    total_regen_credits: number;
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
