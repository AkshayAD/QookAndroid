/**
 * Trust Actions Service
 * 
 * Implements a progressive trust system where users earn trial credits
 * by completing trust-building actions. This discourages trial abuse
 * while maintaining a good user experience.
 * 
 * Active actions and credits:
 * - signup: +2 (immediate)
 * - add_phone: +2 (after adding phone number)
 * - generate_second_menu: +1 (generating 2nd meal plan)
 * - share_menu_commands: +1 (sharing meal plan or grocery list)
 *
 * Active total possible: 6 credits
 * Legacy actions such as complete_profile/install_pwa are preserved only for
 * historical users who already earned them.
 */

import { supabase } from '../lib/supabase';

export type TrustActionType =
    | 'signup'
    | 'complete_profile'
    | 'add_phone'
    | 'generate_second_menu'
    | 'share_menu_commands'
    | 'install_pwa';

export const TRUST_ACTION_CREDITS: Record<TrustActionType, number> = {
    signup: 2,
    complete_profile: 1,
    add_phone: 2,
    generate_second_menu: 1,
    share_menu_commands: 1,
    install_pwa: 1
};

export const TRUST_ACTION_LABELS: Record<TrustActionType, string> = {
    signup: 'Create account',
    complete_profile: 'Complete profile',
    add_phone: 'Add phone number',
    generate_second_menu: 'Generate 2nd menu',
    share_menu_commands: 'Share menu commands',
    install_pwa: 'Install webapp'
};

export interface TrustAction {
    action_type: TrustActionType;
    credits_awarded: number;
    completed_at: string | null;
}

export interface TrustProgress {
    completed: TrustAction[];
    pending: TrustActionType[];
    totalCreditsEarned: number;
    maxPossibleCredits: number;
}

export interface CompleteTrustActionResult {
    creditsAwarded: number;
    alreadyCompleted: boolean;
    completedAt?: string | null;
}

export type MenuGenerationSource = 'onboarding_auto' | 'manual_generate';

export interface MenuGenerationEventInput {
    requestId: string;
    userId: string;
    weekStartDate: string;
    source: MenuGenerationSource;
    familyGroupId?: string | null;
}

export const ACTIVE_TRUST_ACTIONS: TrustActionType[] = [
    'signup',
    'add_phone',
    'generate_second_menu',
    'share_menu_commands',
];

function emitTrustActionEvents() {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent('trust-actions-updated'));
    window.dispatchEvent(new CustomEvent('refresh-credits'));
}

export function createTrustProgress(completed: TrustAction[]): TrustProgress {
    const activeCompleted = completed.filter((action) => ACTIVE_TRUST_ACTIONS.includes(action.action_type));
    const completedTypes = new Set(activeCompleted.map((action) => action.action_type));

    return {
        completed: activeCompleted,
        pending: ACTIVE_TRUST_ACTIONS.filter((action) => !completedTypes.has(action)),
        totalCreditsEarned: activeCompleted.reduce((sum, action) => sum + action.credits_awarded, 0),
        maxPossibleCredits: ACTIVE_TRUST_ACTIONS.reduce((sum, action) => sum + TRUST_ACTION_CREDITS[action], 0),
    };
}

export function deriveMenuGenerationCount(options: {
    durableCount: number;
    legacyCount: number;
    hasOnboardingCompleted: boolean;
    hasSavedSchedule: boolean;
}): number {
    const { durableCount, legacyCount, hasOnboardingCompleted, hasSavedSchedule } = options;
    const onboardingBaseline = durableCount === 0 && legacyCount === 0 && hasOnboardingCompleted && hasSavedSchedule
        ? 1
        : 0;

    return Math.max(durableCount, legacyCount, onboardingBaseline);
}

/**
 * Hash a phone number after normalizing it to digits only.
 * Used to keep phone trust-action checks consistent across the app.
 */
export async function hashPhoneNumber(phone: string): Promise<string> {
    const normalized = phone.replace(/\D/g, '');
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((value) => value.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the user's current trust action progress
 */
export async function getTrustProgress(userId: string): Promise<TrustProgress> {
    const { data: completed } = await supabase
        .from('user_trust_actions')
        .select('action_type, credits_awarded, completed_at')
        .eq('user_id', userId);

    return createTrustProgress(completed || []);
}

/**
 * Check if a specific action has been completed
 */
export async function hasCompletedAction(
    userId: string,
    action: TrustActionType
): Promise<boolean> {
    const { data } = await supabase
        .from('user_trust_actions')
        .select('id')
        .eq('user_id', userId)
        .eq('action_type', action)
        .maybeSingle();

    return !!data;
}

/**
 * Complete a trust action and award credits
 * Returns the credits awarded (0 if action already completed)
 */
export async function completeTrustAction(
    userId: string,
    action: TrustActionType,
    metadata: Record<string, unknown> = {}
): Promise<CompleteTrustActionResult> {
    const { data, error } = await supabase.rpc('complete_trust_action_once', {
        p_action_type: action,
        p_metadata: metadata,
    });

    if (error) {
        console.error('Failed to complete trust action via RPC:', error);
        return { creditsAwarded: 0, alreadyCompleted: false };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
        return { creditsAwarded: 0, alreadyCompleted: false };
    }

    emitTrustActionEvents();

    return {
        creditsAwarded: Number(row.credits_awarded ?? 0),
        alreadyCompleted: Boolean(row.already_completed),
        completedAt: row.completed_at ?? null,
    };
}

/**
 * Check if user is eligible for return_24h action
 * Compares current time to user's creation date
 */
export async function checkReturn24hEligibility(userId: string): Promise<boolean> {
    // Get user's creation date
    const { data: user } = await supabase
        .from('user_profiles')
        .select('created_at')
        .eq('id', userId)
        .single();

    if (!user?.created_at) return false;

    const createdAt = new Date(user.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // Must be at least 24 hours since account creation
    return hoursSinceCreation >= 24;
}

/**
 * Check if the meal plan was manually saved (not auto-generated from profile)
 * Returns true if the plan has been edited after initial generation
 */
export async function isManualMealSave(
    userId: string,
    weekPlanId: string
): Promise<boolean> {
    const { data: plan } = await supabase
        .from('weekly_plans')
        .select('created_at, updated_at')
        .eq('id', weekPlanId)
        .eq('user_id', userId)
        .single();

    if (!plan) return false;

    // If updated_at is significantly after created_at, it was manually edited
    const created = new Date(plan.created_at);
    const updated = new Date(plan.updated_at);
    const diffMinutes = (updated.getTime() - created.getTime()) / (1000 * 60);

    // Consider it manual if edited more than 1 minute after creation
    return diffMinutes > 1;
}

/**
 * Get the legacy count of generated weekly plans for a user.
 * The current planner flow now tracks successful generations locally first,
 * but this preserves historical cross-device progress from older builds.
 */
export async function getUserGenerationCount(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from('weekly_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        console.error('Error counting generations:', error);
        return 0;
    }

    return count || 0;
}

export async function recordMenuGenerationEvent({
    requestId,
    userId,
    weekStartDate,
    source,
    familyGroupId = null,
}: MenuGenerationEventInput): Promise<void> {
    const { error } = await supabase
        .from('menu_generation_events')
        .upsert({
            request_id: requestId,
            user_id: userId,
            family_group_id: familyGroupId,
            week_start_date: weekStartDate,
            source,
        }, { onConflict: 'request_id', ignoreDuplicates: false });

    if (error) {
        console.error('Failed to record menu generation event:', error);
        throw error;
    }
}

export interface RecordMenuGenerationResult {
    eventRecorded: boolean;
    milestoneCount: number;
    creditsAwarded: number;
    alreadyCompleted: boolean;
}

export async function recordMenuGenerationAndMaybeAwardSecondMenu({
    requestId,
    userId,
    weekStartDate,
    source,
    familyGroupId = null,
}: MenuGenerationEventInput): Promise<RecordMenuGenerationResult> {
    const { data, error } = await supabase.rpc('record_menu_generation_and_maybe_award_second_menu', {
        p_request_id: requestId,
        p_week_start_date: weekStartDate,
        p_source: source,
        p_family_group_id: familyGroupId,
    });

    if (error) {
        console.error('Failed to record menu generation milestone via RPC:', error);
        throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const result: RecordMenuGenerationResult = {
        eventRecorded: Boolean(row?.event_recorded),
        milestoneCount: Number(row?.milestone_count ?? 0),
        creditsAwarded: Number(row?.credits_awarded ?? 0),
        alreadyCompleted: Boolean(row?.already_completed),
    };

    if (result.eventRecorded || result.creditsAwarded > 0) {
        emitTrustActionEvents();
    }

    return result;
}

async function getDurableMenuGenerationCount(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from('menu_generation_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        console.error('Error counting durable menu generations:', error);
        return 0;
    }

    return count || 0;
}

async function getHasSavedSchedule(userId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from('scheduled_meals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        console.error('Error checking saved schedule count:', error);
        return false;
    }

    return (count || 0) > 0;
}

async function getHasCompletedOnboarding(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error checking onboarding status for menu generation count:', error);
        return false;
    }

    return Boolean(data?.onboarding_completed);
}

export async function getMenuGenerationMilestoneCount(userId: string): Promise<number> {
    const [durableCount, legacyCount, hasOnboardingCompleted, hasSavedSchedule] = await Promise.all([
        getDurableMenuGenerationCount(userId),
        getUserGenerationCount(userId),
        getHasCompletedOnboarding(userId),
        getHasSavedSchedule(userId),
    ]);

    return deriveMenuGenerationCount({
        durableCount,
        legacyCount,
        hasOnboardingCompleted,
        hasSavedSchedule,
    });
}
