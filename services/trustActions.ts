/**
 * Trust Actions Service
 * 
 * Implements a progressive trust system where users earn trial credits
 * by completing trust-building actions. This discourages trial abuse
 * while maintaining a good user experience.
 * 
 * Actions and Credits:
 * - signup: +2 (immediate)
 * - complete_profile: +1 (after completing profile wizard)
 * - add_phone: +2 (after adding phone number)  
 * - generate_second_menu: +1 (generating 2nd meal plan)
 * - share_menu_commands: +1 (sharing meal plan or grocery list)
 * - install_pwa: +1 (installing as PWA)
 * 
 * Total possible: 8 credits (matches original trial amount)
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

/**
 * Get the user's current trust action progress
 */
export async function getTrustProgress(userId: string): Promise<TrustProgress> {
    const { data: completed } = await supabase
        .from('user_trust_actions')
        .select('action_type, credits_awarded, completed_at')
        .eq('user_id', userId);

    const completedTypes = new Set((completed || []).map(a => a.action_type));

    const pending = (Object.keys(TRUST_ACTION_CREDITS) as TrustActionType[])
        .filter(action => !completedTypes.has(action));

    const totalCreditsEarned = (completed || [])
        .reduce((sum, a) => sum + a.credits_awarded, 0);

    const maxPossibleCredits = Object.values(TRUST_ACTION_CREDITS)
        .reduce((sum, credits) => sum + credits, 0);

    return {
        completed: completed || [],
        pending,
        totalCreditsEarned,
        maxPossibleCredits
    };
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
        .single();

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
): Promise<{ creditsAwarded: number; alreadyCompleted: boolean }> {
    // Check if already completed
    const alreadyDone = await hasCompletedAction(userId, action);
    if (alreadyDone) {
        return { creditsAwarded: 0, alreadyCompleted: true };
    }

    const credits = TRUST_ACTION_CREDITS[action];

    // Record the action
    const { error } = await supabase.from('user_trust_actions').insert({
        user_id: userId,
        action_type: action,
        credits_awarded: credits,
        metadata
    });

    if (error) {
        console.error('Failed to record trust action:', error);
        return { creditsAwarded: 0, alreadyCompleted: false };
    }

    // Award the credits to user_credits table
    await awardTrustCredits(userId, credits, action);

    return { creditsAwarded: credits, alreadyCompleted: false };
}

/**
 * Award trust credits to the user's credit balance
 */
async function awardTrustCredits(
    userId: string,
    amount: number,
    source: TrustActionType
): Promise<void> {
    // Calculate expiry (28 days from now, same as trial)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 28);

    await supabase.from('user_credits').insert({
        user_id: userId,
        credit_type: 'bonus',
        meal_credits: amount,
        expires_at: expiresAt.toISOString()
    });
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
 * Get the count of meal plans generated by a user
 * Used for tracking 2nd menu generation trust action
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

