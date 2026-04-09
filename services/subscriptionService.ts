import { supabase } from '../lib/supabase';
import {
    SubscriptionPlan,
    UserSubscription,
    UserCredits,
    CreditPack,
    UsageRecord,
} from '../types/subscription';
import { BillingFeature, DEFAULT_FEATURE_TIERS } from '../lib/billing/featureAccess';
import { getApiBaseUrl } from '../utils/platform';

const PLAN_SELECT = `
    id,
    name,
    price_inr,
    first_month_price,
    regular_price,
    monthly_credits,
    weekly_bonus_credits,
    trial_credits,
    max_profiles,
    history_days,
    byok_enabled,
    priority_support,
    can_buy_credits,
    family_member_limit,
    sort_order,
    features,
    razorpay_plan_id,
    razorpay_offer_id,
    razorpay_upi_offer_id,
    is_active,
    unified_credits,
    weekly_bonus,
    meal_generations,
    grocery_generations,
    smart_edits,
    single_regens,
    weekly_bonus_meals,
    weekly_bonus_grocery
`;

export interface LaunchOfferSettings {
    enabled: boolean;
    trial_days: number;
    effective_tier: string;
    trial_credits?: number;
}

export type FeatureAccessMatrix = Partial<Record<BillingFeature, string[]>>;

const STATIC_SUBSCRIPTION_CACHE_TTL_MS = 5 * 60 * 1000;
const CREDIT_SUMMARY_CACHE_TTL_MS = 15 * 1000;

type TimedCacheEntry<T> = {
    value: T;
    fetchedAt: number;
};

let subscriptionPlansCache: TimedCacheEntry<SubscriptionPlan[]> | null = null;
let subscriptionPlansPromise: Promise<SubscriptionPlan[]> | null = null;
let featureMatrixCache: TimedCacheEntry<FeatureAccessMatrix | null> | null = null;
let featureMatrixPromise: Promise<FeatureAccessMatrix | null> | null = null;
let launchOfferCache: TimedCacheEntry<LaunchOfferSettings | null> | null = null;
let launchOfferPromise: Promise<LaunchOfferSettings | null> | null = null;
let userCreditsCache = new Map<string, TimedCacheEntry<UserCredits | null>>();
let userCreditsPromises = new Map<string, Promise<UserCredits | null>>();

function isStaticCacheFresh<T>(entry: TimedCacheEntry<T> | null): entry is TimedCacheEntry<T> {
    return Boolean(entry && Date.now() - entry.fetchedAt < STATIC_SUBSCRIPTION_CACHE_TTL_MS);
}

function isCreditSummaryCacheFresh(entry: TimedCacheEntry<UserCredits | null> | undefined): entry is TimedCacheEntry<UserCredits | null> {
    return Boolean(entry && Date.now() - entry.fetchedAt < CREDIT_SUMMARY_CACHE_TTL_MS);
}

function getUserCreditsCacheKey(userId: string, familyGroupId: string | null): string {
    return `${userId}:${familyGroupId ?? 'personal'}`;
}

function normalizeFeatureList(features: unknown): string[] {
    if (Array.isArray(features)) {
        return features.filter((item): item is string => typeof item === 'string');
    }

    if (typeof features === 'string') {
        try {
            const parsed = JSON.parse(features);
            return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
        } catch {
            return [];
        }
    }

    return [];
}

function mapPlan(row: any): SubscriptionPlan {
    const monthlyCredits = Number(
        row?.monthly_credits ??
        row?.unified_credits ??
        row?.meal_generations ??
        0
    );
    const weeklyBonusCredits = Number(
        row?.weekly_bonus_credits ??
        row?.weekly_bonus ??
        row?.weekly_bonus_meals ??
        0
    );
    const trialCredits = Number(
        row?.trial_credits ??
        monthlyCredits
    );

    return {
        id: row.id,
        name: row.name,
        price_inr: Number(row.price_inr ?? row.regular_price ?? 0),
        first_month_price: row.first_month_price ?? row.price_inr ?? 0,
        regular_price: row.regular_price ?? row.price_inr ?? 0,
        monthly_credits: monthlyCredits,
        weekly_bonus_credits: weeklyBonusCredits,
        trial_credits: trialCredits,
        max_profiles: Number(row.max_profiles ?? 0),
        history_days: Number(row.history_days ?? 0),
        byok_enabled: Boolean(row.byok_enabled),
        priority_support: Boolean(row.priority_support),
        can_buy_credits: Boolean(row.can_buy_credits),
        family_member_limit: Number(row.family_member_limit ?? (row.id === 'family_pro' ? 5 : 1)),
        sort_order: Number(row.sort_order ?? 999),
        features: normalizeFeatureList(row.features),
        razorpay_plan_id: row.razorpay_plan_id ?? undefined,
        razorpay_offer_id: row.razorpay_offer_id ?? undefined,
        razorpay_upi_offer_id: row.razorpay_upi_offer_id ?? undefined,
        is_active: row.is_active ?? true,
        meal_generations: monthlyCredits,
        grocery_generations: Number(row?.grocery_generations ?? 0),
        smart_edits: Number(row?.smart_edits ?? 0),
        single_regens: Number(row?.single_regens ?? 0),
        weekly_bonus_meals: weeklyBonusCredits,
        weekly_bonus_grocery: Number(row?.weekly_bonus_grocery ?? 0),
    };
}

function mapCreditSummary(row: any): UserCredits {
    const totalCredits = Number(row?.total_credits ?? 0);

    return {
        total_credits: totalCredits,
        subscription_credits: Number(row?.subscription_credits ?? 0),
        purchased_credits: Number(row?.purchased_credits ?? 0),
        bonus_credits: Number(row?.bonus_credits ?? 0),
        trial_credits: Number(row?.trial_credits ?? 0),
        referral_credits: Number(row?.referral_credits ?? 0),
        plan_tier: row?.plan_tier || 'free',
        effective_tier: row?.effective_tier || row?.plan_tier || 'free',
        byok_enabled: Boolean(row?.byok_enabled),
        billing_preference: row?.billing_preference === 'byok' ? 'byok' : 'credits',
        trial_ends_at: row?.trial_ends_at ?? null,
        weekly_bonus_credits: Number(row?.weekly_bonus_credits ?? 0),
        next_weekly_bonus_at: row?.next_weekly_bonus_at ?? null,
        weekly_bonus_claimable: Boolean(row?.weekly_bonus_claimable),
        weekly_bonus_window_start: row?.weekly_bonus_window_start ?? null,
        weekly_bonus_window_end: row?.weekly_bonus_window_end ?? null,
        weekly_bonus_claimed_for_window: Boolean(row?.weekly_bonus_claimed_for_window),
        family_mode: Boolean(row?.family_mode),
        family_group_id: row?.family_group_id ?? null,
        total_meal_credits: totalCredits,
        total_grocery_credits: 0,
        total_edit_credits: 0,
        total_regen_credits: 0,
    };
}

async function getFallbackPersonalCreditSummary(userId: string): Promise<UserCredits | null> {
    if (!supabase) {
        return null;
    }

    const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select('plan_id, billing_preference, trial_ends_at')
        .eq('user_id', userId)
        .maybeSingle();

    const planTier = subscriptionData?.plan_id || 'free';

    const [{ data: planData }, { data: creditRows, error: creditsError }] = await Promise.all([
        supabase
            .from('subscription_plans')
            .select('id, byok_enabled, weekly_bonus_credits')
            .eq('id', planTier)
            .maybeSingle(),
        supabase
            .from('user_credits')
            .select('credits, meal_credits, credit_type, expires_at, family_group_id')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .is('family_group_id', null),
    ]);

    if (creditsError) {
        console.warn('Fallback credits lookup failed:', creditsError);
        return null;
    }

    const now = Date.now();
    const activeCredits = (creditRows || []).filter((row: any) => {
        if (!row?.expires_at) {
            return true;
        }

        const expiresAt = new Date(row.expires_at).getTime();
        return Number.isFinite(expiresAt) && expiresAt > now;
    });

    const buckets = activeCredits.reduce((totals, row: any) => {
        const creditAmount = Number(row?.credits ?? row?.meal_credits ?? 0);
        const creditType = String(row?.credit_type ?? '');

        if (!Number.isFinite(creditAmount) || creditAmount === 0) {
            return totals;
        }

        switch (creditType) {
            case 'subscription':
            case 'monthly_grant':
            case 'renewal':
                totals.subscription_credits += creditAmount;
                break;
            case 'purchase':
            case 'purchased':
            case 'credit_pack':
            case 'pack':
                totals.purchased_credits += creditAmount;
                break;
            case 'trial':
                totals.trial_credits += creditAmount;
                break;
            case 'referral':
                totals.referral_credits += creditAmount;
                break;
            default:
                totals.bonus_credits += creditAmount;
                break;
        }

        totals.total_credits += creditAmount;
        return totals;
    }, {
        total_credits: 0,
        subscription_credits: 0,
        purchased_credits: 0,
        bonus_credits: 0,
        trial_credits: 0,
        referral_credits: 0,
    });

    return {
        ...buckets,
        plan_tier: planTier,
        effective_tier: planTier,
        byok_enabled: Boolean(planData?.byok_enabled),
        billing_preference: subscriptionData?.billing_preference === 'byok' ? 'byok' : 'credits',
        trial_ends_at: subscriptionData?.trial_ends_at ?? null,
        weekly_bonus_credits: Number(planData?.weekly_bonus_credits ?? 0),
        next_weekly_bonus_at: null,
        weekly_bonus_claimable: false,
        weekly_bonus_window_start: null,
        weekly_bonus_window_end: null,
        weekly_bonus_claimed_for_window: false,
        family_mode: false,
        family_group_id: null,
        total_meal_credits: buckets.total_credits,
        total_grocery_credits: 0,
        total_edit_credits: 0,
        total_regen_credits: 0,
    };
}

async function fallbackGrantCredits(
    userId: string,
    credits: number,
    creditType: string,
    expiresAt: string | null,
    familyGroupId: string | null = null
): Promise<void> {
    if (!supabase || credits <= 0) {
        return;
    }

    if (familyGroupId) {
        await supabase
            .from('family_credit_pool')
            .upsert({
                group_id: familyGroupId,
                total_credits: credits,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'group_id' });
        return;
    }

    await supabase
        .from('user_credits')
        .insert({
            user_id: userId,
            credit_type: creditType,
            credits,
            meal_credits: credits,
            expires_at: expiresAt,
            metadata: {},
        });
}

async function grantCredits(
    userId: string,
    credits: number,
    creditType: string,
    expiresAt: string | null,
    description: string,
    familyGroupId: string | null = null
): Promise<void> {
    if (!supabase || credits <= 0) {
        return;
    }

    const { error } = await supabase.rpc('grant_credits', {
        p_user_id: userId,
        p_credits: credits,
        p_credit_type: creditType,
        p_expires_at: expiresAt,
        p_description: description,
        p_family_group_id: familyGroupId,
        p_metadata: {},
    });

    if (error) {
        console.error('Error granting credits via RPC:', error);
        await fallbackGrantCredits(userId, credits, creditType, expiresAt, familyGroupId);
    }
}

async function getActiveFamilyGroupId(userId: string): Promise<string | null> {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('family_group_members')
        .select('group_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.warn('Unable to resolve family group for billing grant:', error);
        return null;
    }

    return data?.group_id ?? null;
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    if (!supabase) {
        return [];
    }

    if (isStaticCacheFresh(subscriptionPlansCache)) {
        return subscriptionPlansCache.value;
    }

    if (subscriptionPlansPromise) {
        return subscriptionPlansPromise;
    }

    subscriptionPlansPromise = (async () => {
        const { data, error } = await supabase
            .from('subscription_plans')
            .select(PLAN_SELECT)
            .eq('is_active', true)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('price_inr', { ascending: true });

        if (error) {
            console.error('Error fetching plans:', error);
            return [];
        }

        const mappedPlans = (data || []).map(mapPlan);
        subscriptionPlansCache = {
            value: mappedPlans,
            fetchedAt: Date.now(),
        };
        return mappedPlans;
    })();

    try {
        return await subscriptionPlansPromise;
    } finally {
        subscriptionPlansPromise = null;
    }
}

export async function getSubscriptionPlanById(planId: string): Promise<SubscriptionPlan | null> {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('subscription_plans')
        .select(PLAN_SELECT)
        .eq('id', planId)
        .single();

    if (error) {
        console.error('Error fetching plan:', error);
        return null;
    }

    return mapPlan(data);
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
    if (!supabase) {
        return null;
    }

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

export async function getLaunchOfferSettings(): Promise<LaunchOfferSettings | null> {
    if (!supabase) {
        return null;
    }

    if (isStaticCacheFresh(launchOfferCache)) {
        return launchOfferCache.value;
    }

    if (launchOfferPromise) {
        return launchOfferPromise;
    }

    launchOfferPromise = (async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'launch_offer')
            .maybeSingle();

        if (error) {
            console.error('Error fetching launch offer settings:', error);
            return null;
        }

        const launchOffer = data ? (data.value as LaunchOfferSettings) : null;
        launchOfferCache = {
            value: launchOffer,
            fetchedAt: Date.now(),
        };
        return launchOffer;
    })();

    try {
        return await launchOfferPromise;
    } finally {
        launchOfferPromise = null;
    }
}

export async function createTrialSubscription(userId: string): Promise<boolean> {
    if (!supabase) {
        return false;
    }

    const { error: ensureError } = await supabase.rpc('ensure_free_trial_subscription', {
        p_user_id: userId,
    });

    if (!ensureError) {
        return true;
    }

    console.warn('Falling back to client-side free trial creation:', ensureError);

    const launchOffer = await getLaunchOfferSettings();
    const trialDays = launchOffer?.enabled ? (launchOffer.trial_days || 28) : 28;
    const freePlan = await getSubscriptionPlanById('free');
    const trialCredits = launchOffer?.trial_credits ?? freePlan?.trial_credits ?? freePlan?.monthly_credits ?? 8;
    const existingSubscription = await getUserSubscription(userId);
    const existingTrialCredit = await supabase
        .from('user_credits')
        .select('id')
        .eq('user_id', userId)
        .eq('credit_type', 'trial')
        .limit(1)
        .maybeSingle();

    if (existingSubscription?.plan_id && existingSubscription.plan_id !== 'free') {
        return true;
    }

    const trialEndsAt = existingSubscription?.trial_ends_at
        ? new Date(existingSubscription.trial_ends_at)
        : new Date();

    if (!existingSubscription?.trial_ends_at) {
        trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    }

    let error = null;
    if (!existingSubscription) {
        const result = await supabase
            .from('user_subscriptions')
            .upsert({
                user_id: userId,
                plan_id: 'free',
                status: 'active',
                started_at: new Date().toISOString(),
                billing_preference: 'credits',
                trial_ends_at: trialEndsAt.toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        error = result.error;
    }

    if (error) {
        console.error('Error creating trial subscription:', error);
        return false;
    }

    if (!existingTrialCredit.data) {
        await grantCredits(userId, trialCredits, 'trial', trialEndsAt.toISOString(), 'Launch trial credits');
    }

    return true;
}

export async function getEnabledFeatureMatrix(): Promise<FeatureAccessMatrix | null> {
    if (!supabase) {
        return null;
    }

    if (isStaticCacheFresh(featureMatrixCache)) {
        return featureMatrixCache.value;
    }

    if (featureMatrixPromise) {
        return featureMatrixPromise;
    }

    featureMatrixPromise = (async () => {
        const { data, error } = await supabase
            .from('feature_tier_access')
            .select('feature_id, tier_id')
            .eq('enabled', true);

        if (error) {
            console.error('Error fetching feature matrix:', error);
            return null;
        }

        const matrix: FeatureAccessMatrix = {};
        for (const row of data || []) {
            const featureId = row.feature_id as BillingFeature;
            if (!matrix[featureId]) {
                matrix[featureId] = [];
            }
            matrix[featureId]!.push(row.tier_id);
        }

        const resolvedMatrix = Object.keys(matrix).length === 0 ? DEFAULT_FEATURE_TIERS : matrix;
        featureMatrixCache = {
            value: resolvedMatrix,
            fetchedAt: Date.now(),
        };
        return resolvedMatrix;
    })();

    try {
        return await featureMatrixPromise;
    } finally {
        featureMatrixPromise = null;
    }
}

export async function getUserCredits(
    userId: string,
    familyGroupId: string | null = null,
    options?: { force?: boolean }
): Promise<UserCredits | null> {
    if (!supabase) {
        return null;
    }

    const cacheKey = getUserCreditsCacheKey(userId, familyGroupId);

    if (!options?.force) {
        const cachedEntry = userCreditsCache.get(cacheKey);
        if (isCreditSummaryCacheFresh(cachedEntry)) {
            return cachedEntry.value;
        }

        const inflightRequest = userCreditsPromises.get(cacheKey);
        if (inflightRequest) {
            return inflightRequest;
        }
    }

    const requestPromise = (async () => {
        const { data, error } = await supabase.rpc('get_credit_summary', {
            p_user_id: userId,
            p_family_group_id: familyGroupId,
        });

        if (error) {
            console.error('Error fetching credits:', error);
            const fallbackResult = familyGroupId ? null : await getFallbackPersonalCreditSummary(userId);
            userCreditsCache.set(cacheKey, {
                value: fallbackResult,
                fetchedAt: Date.now(),
            });
            return fallbackResult;
        }

        const summary = Array.isArray(data) ? data[0] : data;
        const mappedSummary = summary ? mapCreditSummary(summary) : null;

        if (!familyGroupId) {
            if (!mappedSummary) {
                const fallbackSummary = await getFallbackPersonalCreditSummary(userId);
                userCreditsCache.set(cacheKey, {
                    value: fallbackSummary,
                    fetchedAt: Date.now(),
                });
                return fallbackSummary;
            }

            if (mappedSummary.total_credits <= 0) {
                const fallbackSummary = await getFallbackPersonalCreditSummary(userId);
                if (fallbackSummary && fallbackSummary.total_credits > 0) {
                    const mergedSummary = {
                        ...mappedSummary,
                        total_credits: fallbackSummary.total_credits,
                        subscription_credits: fallbackSummary.subscription_credits,
                        purchased_credits: fallbackSummary.purchased_credits,
                        bonus_credits: fallbackSummary.bonus_credits,
                        trial_credits: fallbackSummary.trial_credits,
                        referral_credits: fallbackSummary.referral_credits,
                        total_meal_credits: fallbackSummary.total_meal_credits,
                    };
                    userCreditsCache.set(cacheKey, {
                        value: mergedSummary,
                        fetchedAt: Date.now(),
                    });
                    return mergedSummary;
                }
            }

            userCreditsCache.set(cacheKey, {
                value: mappedSummary,
                fetchedAt: Date.now(),
            });
            return mappedSummary;
        }

        userCreditsCache.set(cacheKey, {
            value: mappedSummary,
            fetchedAt: Date.now(),
        });
        return mappedSummary;
    })();

    userCreditsPromises.set(cacheKey, requestPromise);

    try {
        return await requestPromise;
    } finally {
        userCreditsPromises.delete(cacheKey);
    }
}

export async function consumeCredits(
    userId: string,
    actionType: 'meal_generation' | 'grocery_generation' | 'smart_edit' | 'single_regen',
    creditsNeeded: number = 1
): Promise<boolean> {
    return creditsNeeded >= 0 && !!userId && !!actionType;
}

export async function getCreditPacks(): Promise<CreditPack[]> {
    if (!supabase) {
        return [];
    }

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

export async function trackUsage(
    userId: string,
    actionType: string,
    creditsUsed: number,
    apiSource: 'platform' | 'byok',
    tokensInput?: number,
    tokensOutput?: number,
    costUsd?: number
): Promise<void> {
    if (!supabase) {
        return;
    }

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

    try {
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
    } catch (analyticsError) {
        console.warn('Generation analytics insert skipped:', analyticsError);
    }
}

export async function getUsageHistory(userId: string, days: number = 30): Promise<UsageRecord[]> {
    if (!supabase) {
        return [];
    }

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

export async function checkRateLimit(
    userId: string,
    actionType: string,
    maxRequests: number = 15
): Promise<boolean> {
    if (!supabase) {
        return true;
    }

    const { data, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: userId,
        p_action_type: actionType,
        p_window_minutes: 1,
        p_max_requests: maxRequests
    });

    if (error) {
        console.error('Error checking rate limit:', error);
        return true;
    }

    return data === true;
}

export async function claimWeeklyBonus(userId: string): Promise<boolean> {
    if (!supabase) {
        return false;
    }

    const { data, error } = await supabase.rpc('claim_weekly_bonus', {
        p_user_id: userId,
    });

    if (error) {
        console.error('Error claiming weekly bonus:', error);
        return false;
    }

    if (typeof data === 'boolean') {
        return data;
    }

    return Boolean(data?.success ?? data?.claimed);
}

export async function upgradeSubscription(
    userId: string,
    planId: string,
    razorpaySubscriptionId?: string
): Promise<boolean> {
    if (!supabase) {
        return false;
    }

    const plan = await getSubscriptionPlanById(planId);
    if (!plan) {
        return false;
    }

    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setDate(renewsAt.getDate() + 28);

    const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            started_at: now.toISOString(),
            renews_at: renewsAt.toISOString(),
            trial_ends_at: null,
            razorpay_subscription_id: razorpaySubscriptionId || null,
            updated_at: now.toISOString(),
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Error upgrading subscription:', error);
        return false;
    }

    const familyGroupId = planId === 'family_pro' ? await getActiveFamilyGroupId(userId) : null;
    await grantCredits(
        userId,
        plan.monthly_credits,
        'plan',
        renewsAt.toISOString(),
        `Subscription renewal for ${planId}`,
        familyGroupId
    );

    try {
        await supabase
            .from('fact_subscription_events')
            .insert({
                user_id: userId,
                event_type: 'subscribe',
                new_tier: planId,
                revenue_inr: plan.regular_price ?? plan.price_inr,
            });
    } catch (analyticsError) {
        console.warn('Subscription analytics insert skipped:', analyticsError);
    }

    return true;
}

export async function cancelSubscription(userId: string): Promise<boolean> {
    if (!supabase) {
        return false;
    }

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
            body: JSON.stringify({ user_id: userId }),
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

export async function updateBillingPreference(
    userId: string,
    preference: 'credits' | 'byok'
): Promise<boolean> {
    if (!supabase) {
        return false;
    }

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            billing_preference: preference,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Error updating billing preference:', error);
        return false;
    }

    return true;
}

export async function getBillingPreference(userId: string): Promise<'credits' | 'byok'> {
    if (!supabase) {
        return 'credits';
    }

    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('billing_preference')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return 'credits';
    }

    return data.billing_preference === 'byok' ? 'byok' : 'credits';
}
