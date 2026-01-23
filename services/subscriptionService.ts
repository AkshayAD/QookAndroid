import { supabase } from '../lib/supabase';
import { SubscriptionPlan, UserSubscription, UserCredits, CreditPack, UsageRecord } from '../types/subscription';
import { getApiBaseUrl } from '../utils/platform';

// =====================================================
// SUBSCRIPTION PLANS
// =====================================================

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_inr', { ascending: true });

    if (error) {
        console.error('Error fetching plans:', error);
        return [];
    }
    return data || [];
}

/**
 * Get a specific subscription plan by ID with Razorpay offer details
 */
export async function getSubscriptionPlanById(planId: string): Promise<SubscriptionPlan & { razorpay_offer_id?: string } | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('subscription_plans')
        .select('*, razorpay_offer_id')
        .eq('id', planId)
        .single();

    if (error) {
        console.error('Error fetching plan:', error);
        return null;
    }
    return data;
}

// =====================================================
// USER SUBSCRIPTION
// =====================================================

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error('Error fetching subscription:', error);
        return null;
    }
    return data;
}

// =====================================================
// LAUNCH OFFER SETTINGS
// =====================================================

export interface LaunchOfferSettings {
    enabled: boolean;
    trial_days: number;
    effective_tier: string;
}

export async function getLaunchOfferSettings(): Promise<LaunchOfferSettings | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'launch_offer')
        .single();

    if (error || !data) {
        console.error('Error fetching launch offer settings:', error);
        return null;
    }

    return data.value as LaunchOfferSettings;
}

export async function createTrialSubscription(userId: string): Promise<boolean> {
    if (!supabase) return false;

    // Check if launch offer is active
    const launchOffer = await getLaunchOfferSettings();
    const isLaunchOfferActive = launchOffer?.enabled === true;

    const trialDays = isLaunchOfferActive ? launchOffer.trial_days : 28;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
            user_id: userId,
            plan_id: 'free',
            status: 'active',
            trial_ends_at: trialEndsAt.toISOString(),
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Error creating trial:', error);
        return false;
    }

    // Create initial credits - more credits if launch offer active
    const creditAmount = isLaunchOfferActive ? 25 : 8;
    const { error: creditsError } = await supabase
        .from('user_credits')
        .insert({
            user_id: userId,
            credit_type: 'trial',
            meal_credits: creditAmount,
            grocery_credits: creditAmount,
            edit_credits: creditAmount,
            regen_credits: creditAmount,
            expires_at: trialEndsAt.toISOString(),
        });

    if (creditsError) {
        console.error('Error creating trial credits:', creditsError);
    }

    return true;
}

// =====================================================
// USER CREDITS
// =====================================================

export async function getUserCredits(userId: string): Promise<UserCredits | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .rpc('get_user_credits_summary', { p_user_id: userId });

    if (error) {
        console.error('Error fetching credits:', error);
        return null;
    }

    return data?.[0] || null;
}

export async function consumeCredits(
    userId: string,
    actionType: 'meal_generation' | 'grocery_generation' | 'smart_edit' | 'single_regen',
    creditsNeeded: number = 1
): Promise<boolean> {
    // DEPRECATED: Credits are now consumed server-side by the AI proxy.
    // This function is kept for type compatibility but performs no action.
    return true;
}

// =====================================================
// CREDIT PACKS
// =====================================================

export async function getCreditPacks(): Promise<CreditPack[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('credit_packs')
        .select('*')
        .eq('is_active', true)
        .order('price_inr', { ascending: true });

    if (error) {
        console.error('Error fetching packs:', error);
        return [];
    }
    return data || [];
}

// =====================================================
// USAGE TRACKING
// =====================================================

export async function trackUsage(
    userId: string,
    actionType: string,
    creditsUsed: number,
    apiSource: 'platform' | 'byok',
    tokensInput?: number,
    tokensOutput?: number,
    costUsd?: number
): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
        .from('usage_tracking')
        .insert({
            user_id: userId,
            action_type: actionType,
            credits_used: creditsUsed,
            api_source: apiSource,
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            cost_usd: costUsd,
        });

    if (error) {
        console.error('Error tracking usage:', error);
    }

    // Also log to analytics fact table
    await supabase
        .from('fact_generation_events')
        .insert({
            user_id: userId,
            event_type: actionType,
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            cost_usd: costUsd,
            credit_source: apiSource,
        });
}

export async function getUsageHistory(userId: string, days: number = 30): Promise<UsageRecord[]> {
    if (!supabase) return [];

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching usage:', error);
        return [];
    }
    return data || [];
}

// =====================================================
// RATE LIMITING
// =====================================================

export async function checkRateLimit(
    userId: string,
    actionType: string,
    maxRequests: number = 15
): Promise<boolean> {
    if (!supabase) return true; // Allow if no supabase

    const { data, error } = await supabase
        .rpc('check_rate_limit', {
            p_user_id: userId,
            p_action_type: actionType,
            p_window_minutes: 1,
            p_max_requests: maxRequests
        });

    if (error) {
        console.error('Error checking rate limit:', error);
        return true; // Allow on error
    }

    return data === true;
}

// =====================================================
// WEEKLY BONUS
// =====================================================

export async function claimWeeklyBonus(userId: string): Promise<boolean> {
    if (!supabase) return false;

    const now = new Date();

    // Get the current week's Sunday (week starts on Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Go back to Sunday
    weekStart.setHours(0, 0, 0, 0);

    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Check if already claimed this week
    const { data: existing } = await supabase
        .from('weekly_bonus_log')
        .select('id')
        .eq('user_id', userId)
        .eq('week_start', weekStartStr)
        .single();

    if (existing) return false; // Already claimed

    // Get user's plan for bonus amounts
    const subscription = await getUserSubscription(userId);
    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === subscription?.plan_id) || plans[0];

    const bonusMeals = plan.weekly_bonus_meals;
    const bonusGrocery = plan.weekly_bonus_grocery;

    if (bonusMeals === 0 && bonusGrocery === 0) return false;

    // Calculate expiry: End of day Saturday (6 days after Sunday)
    const expiresAt = new Date(weekStart);
    expiresAt.setDate(expiresAt.getDate() + 6); // Saturday
    expiresAt.setHours(23, 59, 59, 999); // End of Saturday

    // Create bonus credits
    const { error: creditError } = await supabase
        .from('user_credits')
        .insert({
            user_id: userId,
            credit_type: 'bonus',
            meal_credits: bonusMeals,
            grocery_credits: bonusGrocery,
            edit_credits: 0,
            regen_credits: 0,
            expires_at: expiresAt.toISOString(),
        });

    if (creditError) {
        console.error('Error creating bonus credits:', creditError);
        return false;
    }

    // Log the bonus
    await supabase
        .from('weekly_bonus_log')
        .insert({
            user_id: userId,
            week_start: weekStartStr,
            bonus_meals_granted: bonusMeals,
            bonus_grocery_granted: bonusGrocery,
        });

    return true;
}

// =====================================================
// SUBSCRIPTION UPGRADES (Razorpay Integration Placeholder)
// =====================================================

export async function upgradeSubscription(
    userId: string,
    planId: string,
    razorpaySubscriptionId?: string
): Promise<boolean> {
    if (!supabase) return false;

    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) return false;

    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    // Update subscription
    const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            started_at: now.toISOString(),
            renews_at: renewsAt.toISOString(),
            razorpay_subscription_id: razorpaySubscriptionId,
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Error upgrading subscription:', error);
        return false;
    }

    // Grant plan credits
    const creditsExpiry = new Date(renewsAt);
    const { error: creditError } = await supabase
        .from('user_credits')
        .insert({
            user_id: userId,
            credit_type: 'plan',
            meal_credits: plan.meal_generations,
            grocery_credits: plan.grocery_generations,
            edit_credits: plan.smart_edits,
            regen_credits: plan.single_regens,
            expires_at: creditsExpiry.toISOString(),
        });

    if (creditError) {
        console.error('Error granting plan credits:', creditError);
    }

    // Log subscription event
    await supabase
        .from('fact_subscription_events')
        .insert({
            user_id: userId,
            event_type: 'subscribe',
            new_tier: planId,
            revenue_inr: plan.price_inr,
        });

    return true;
}

export async function cancelSubscription(userId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Error cancelling subscription:', error);
        return false;
    }

    return true;
}

export async function cancelSubscriptionAPI(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/cancel-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to cancel subscription' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return { success: false, error: 'Network error occurred' };
    }
}

// =====================================================
// BILLING PREFERENCE (BYOK vs Credits Toggle)
// =====================================================

export async function updateBillingPreference(
    userId: string,
    preference: 'credits' | 'byok'
): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('user_subscriptions')
        .update({ billing_preference: preference })
        .eq('user_id', userId);

    if (error) {
        console.error('Error updating billing preference:', error);
        return false;
    }

    return true;
}

export async function getBillingPreference(userId: string): Promise<'credits' | 'byok'> {
    if (!supabase) return 'credits';

    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('billing_preference')
        .eq('user_id', userId)
        .single();

    if (error || !data) return 'credits';
    return data.billing_preference || 'credits';
}
