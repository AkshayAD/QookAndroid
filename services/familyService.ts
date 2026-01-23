/**
 * Family Service
 * Handles all family group operations for QookCommander Family Mode.
 */

import { supabase } from '../lib/supabase';

// Types
export interface FamilyGroup {
    id: string;
    name: string;
    owner_id: string;
    invite_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface FamilyMember {
    id: string;
    group_id: string;
    user_id: string;
    role: 'owner' | 'member';
    joined_at: string;
    display_name?: string; // Joined from user_profiles
    email?: string;
}

export interface FamilyCreditPool {
    id: string;
    group_id: string;
    total_credits: number;
    updated_at: string;
}

export interface FamilyCreditContribution {
    id: string;
    group_id: string;
    contributor_id: string;
    amount: number;
    source: 'subscription' | 'purchase' | 'bonus' | 'transfer';
    description?: string;
    created_at: string;
    contributor_name?: string; // Joined from user_profiles
}

export interface FamilyActivity {
    id: string;
    group_id: string;
    user_id: string;
    user_name: string;
    action_type: 'meal_added' | 'meal_edited' | 'meal_deleted' | 'plan_generated' | 'grocery_generated' | 'member_joined' | 'member_left';
    target_type?: 'weekly_plan' | 'scheduled_meal' | 'grocery_list' | 'member';
    target_date?: string;
    description: string;
    created_at: string;
}

// ============================================================================
// FAMILY GROUP OPERATIONS
// ============================================================================

/**
 * Get the current user's family group (if any)
 */
export async function getUserFamilyGroup(): Promise<FamilyGroup | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // First check if user is a member of any ACTIVE group
    const { data: membership, error: memberError } = await supabase
        .from('family_group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    if (memberError || !membership) return null;

    // Get the group details (only if group is also active)
    const { data: group, error: groupError } = await supabase
        .from('family_groups')
        .select('*')
        .eq('id', membership.group_id)
        .eq('is_active', true)
        .single();

    if (groupError) {
        console.error('Error fetching family group:', groupError);
        return null;
    }

    return group;
}

/**
 * Create a new family group (current user becomes owner)
 */
export async function createFamilyGroup(groupName: string = 'My Family'): Promise<{ groupId: string; inviteCode: string } | null> {
    const { data, error } = await supabase.rpc('create_family_group', {
        group_name: groupName
    });

    if (error) {
        console.error('Error creating family group:', error);
        throw new Error(error.message);
    }

    // Fetch the group to get invite code
    const group = await getUserFamilyGroup();
    if (!group) throw new Error('Failed to create family group');

    return {
        groupId: group.id,
        inviteCode: group.invite_code
    };
}

/**
 * Join an existing family group via invite code
 */
export async function joinFamilyGroup(inviteCode: string): Promise<string> {
    const { data, error } = await supabase.rpc('join_family_group', {
        invite: inviteCode.toUpperCase()
    });

    if (error) {
        console.error('Error joining family group:', error);
        throw new Error(error.message);
    }

    // Log member joined activity
    if (data) {
        // Small delay to ensure membership is committed
        setTimeout(async () => {
            try {
                await logFamilyActivity(
                    data,
                    'member_joined',
                    'joined the family',
                    'member'
                );
            } catch (e) {
                console.warn('Could not log join activity:', e);
            }
        }, 500);
    }

    return data; // Returns group_id
}

/**
 * Leave the current family group
 */
export async function leaveFamilyGroup(): Promise<void> {
    // Get current group before leaving to log activity
    const currentGroup = await getUserFamilyGroup();

    // Log member left activity BEFORE leaving (while still has permission)
    if (currentGroup) {
        try {
            await logFamilyActivity(
                currentGroup.id,
                'member_left',
                'left the family',
                'member'
            );
        } catch (e) {
            console.warn('Could not log leave activity:', e);
        }
    }

    const { error } = await supabase.rpc('leave_family_group');

    if (error) {
        console.error('Error leaving family group:', error);
        throw new Error(error.message);
    }
}

/**
 * Get all members of a family group (including emails)
 */
export async function getFamilyMembers(groupId: string): Promise<FamilyMember[]> {
    // Use security definer function to get members with emails
    const { data, error } = await supabase.rpc('get_family_members_with_emails', {
        p_group_id: groupId
    });

    if (error) {
        console.error('Error fetching family members:', error);
        // Fallback to basic query if RPC fails
        return getFamilyMembersBasic(groupId);
    }

    return (data || []).map((m: any) => ({
        id: m.id,
        group_id: m.group_id,
        user_id: m.user_id,
        role: m.role as 'owner' | 'member',
        joined_at: m.joined_at,
        display_name: m.display_name || 'Unknown',
        email: m.email || ''
    }));
}

/**
 * Fallback function for getting members without emails (if RPC unavailable)
 */
async function getFamilyMembersBasic(groupId: string): Promise<FamilyMember[]> {
    const { data: members, error: membersError } = await supabase
        .from('family_group_members')
        .select('id, group_id, user_id, role, joined_at')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });

    if (membersError || !members) return [];

    // Get display names for all member user_ids
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds);

    const profileMap = new Map<string, string>();
    (profiles || []).forEach(p => {
        profileMap.set(p.id, p.display_name || 'Unknown');
    });

    return members.map(member => ({
        id: member.id,
        group_id: member.group_id,
        user_id: member.user_id,
        role: member.role as 'owner' | 'member',
        joined_at: member.joined_at,
        display_name: profileMap.get(member.user_id) || 'Unknown',
        email: '' // No email in fallback
    }));
}

/**
 * Update family group name
 */
export async function updateFamilyGroupName(groupId: string, newName: string): Promise<void> {
    const { error } = await supabase
        .from('family_groups')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', groupId);

    if (error) {
        console.error('Error updating family group name:', error);
        throw new Error(error.message);
    }
}

/**
 * Remove a member from the group (owner only)
 */
export async function removeFamilyMember(groupId: string, memberId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_family_member', {
        target_user_id: memberId
    });

    if (error) {
        console.error('Error removing family member:', error);
        throw new Error(error.message || 'Failed to remove member');
    }
}

/**
 * Regenerate invite code (owner only)
 */
export async function regenerateInviteCode(groupId: string): Promise<string> {
    // Generate a new code client-side (same format as server)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = 'FAM-';
    for (let i = 0; i < 6; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { error } = await supabase
        .from('family_groups')
        .update({ invite_code: newCode, updated_at: new Date().toISOString() })
        .eq('id', groupId);

    if (error) {
        console.error('Error regenerating invite code:', error);
        throw new Error(error.message);
    }

    return newCode;
}

// ============================================================================
// FAMILY CREDIT OPERATIONS
// ============================================================================

/**
 * Get family credit pool balance
 */
export async function getFamilyCreditPool(groupId: string): Promise<FamilyCreditPool | null> {
    const { data, error } = await supabase
        .from('family_credit_pool')
        .select('*')
        .eq('group_id', groupId)
        .single();

    if (error) {
        console.error('Error fetching family credit pool:', error);
        return null;
    }

    return data;
}

/**
 * Contribute credits to family pool
 */
export async function contributeCredits(
    groupId: string,
    amount: number,
    source: 'subscription' | 'purchase' | 'bonus' | 'transfer',
    description?: string
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Add contribution record
    const { error: contributionError } = await supabase
        .from('family_credit_contributions')
        .insert({
            group_id: groupId,
            contributor_id: user.id,
            amount,
            source,
            description
        });

    if (contributionError) {
        console.error('Error recording contribution:', contributionError);
        throw new Error(contributionError.message);
    }

    // Update pool total
    const { error: updateError } = await supabase.rpc('increment_family_credits', {
        p_group_id: groupId,
        p_amount: amount
    });

    // If RPC doesn't exist yet, do it manually
    if (updateError) {
        const { data: pool } = await supabase
            .from('family_credit_pool')
            .select('total_credits')
            .eq('group_id', groupId)
            .single();

        await supabase
            .from('family_credit_pool')
            .update({
                total_credits: (pool?.total_credits || 0) + amount,
                updated_at: new Date().toISOString()
            })
            .eq('group_id', groupId);
    }
}

/**
 * Get credit contribution history
 */
export async function getCreditContributions(groupId: string): Promise<FamilyCreditContribution[]> {
    const { data, error } = await supabase
        .from('family_credit_contributions')
        .select(`
            id,
            group_id,
            contributor_id,
            amount,
            source,
            description,
            created_at,
            user_profiles!inner(display_name)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching credit contributions:', error);
        return [];
    }

    return (data || []).map(c => ({
        id: c.id,
        group_id: c.group_id,
        contributor_id: c.contributor_id,
        amount: c.amount,
        source: c.source as 'subscription' | 'purchase' | 'bonus' | 'transfer',
        description: c.description,
        created_at: c.created_at,
        contributor_name: (c.user_profiles as any)?.display_name || 'Unknown'
    }));
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to family group changes (real-time)
 */
export function subscribeToFamilyGroup(
    groupId: string,
    onMemberChange: (members: FamilyMember[]) => void,
    onCreditChange: (pool: FamilyCreditPool) => void
) {
    const channel = supabase
        .channel(`family-${groupId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'family_group_members',
            filter: `group_id=eq.${groupId}`
        }, async () => {
            // Refetch members on any change
            const members = await getFamilyMembers(groupId);
            onMemberChange(members);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'family_credit_pool',
            filter: `group_id=eq.${groupId}`
        }, async () => {
            // Refetch credit pool on any change
            const pool = await getFamilyCreditPool(groupId);
            if (pool) onCreditChange(pool);
        })
        .subscribe();

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Subscribe to family menu changes (real-time sync for collaborative editing)
 */
export function subscribeToFamilyMenuChanges(
    groupId: string,
    onWeeklyPlanChange: (plan: any) => void,
    onScheduledMealChange: (meal: any) => void
) {
    const channel = supabase
        .channel(`family-menu-${groupId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'weekly_plans',
            filter: `family_group_id=eq.${groupId}`
        }, (payload) => {
            onWeeklyPlanChange(payload.new);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'scheduled_meals',
            filter: `family_group_id=eq.${groupId}`
        }, (payload) => {
            onScheduledMealChange(payload.new);
        })
        .subscribe();

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
}

// ============================================================================
// LINK GENERATION
// ============================================================================

/**
 * Generate shareable invite link
 */
export function generateInviteLink(inviteCode: string): string {
    const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://qook.in';
    return `${baseUrl}/join-family?code=${inviteCode}`;
}

/**
 * Parse invite code from URL
 */
export function parseInviteCodeFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('code');
}

// ============================================================================
// FAMILY MODE STATUS
// ============================================================================

/**
 * Check if current user is in family mode
 */
export async function isInFamilyMode(): Promise<boolean> {
    const group = await getUserFamilyGroup();
    return group !== null && group.is_active;
}

/**
 * Check if current user is the family owner
 */
export async function isFamilyOwner(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
        .from('family_group_members')
        .select('role')
        .eq('user_id', user.id)
        .single();

    return data?.role === 'owner';
}

// ============================================================================
// FAMILY ACTIVITY LOG
// ============================================================================

/**
 * Log a family activity
 */
export async function logFamilyActivity(
    groupId: string,
    actionType: FamilyActivity['action_type'],
    description: string,
    targetType?: FamilyActivity['target_type'],
    targetDate?: string
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's display name
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

    const userName = profile?.display_name || user.email?.split('@')[0] || 'Unknown';

    const { error } = await supabase
        .from('family_activity')
        .insert({
            group_id: groupId,
            user_id: user.id,
            user_name: userName,
            action_type: actionType,
            target_type: targetType,
            target_date: targetDate,
            description
        });

    if (error) {
        console.error('Error logging family activity:', error);
        // Don't throw - activity logging shouldn't break main operations
    }
}

/**
 * Get recent family activity
 */
export async function getFamilyActivity(groupId: string, limit: number = 20): Promise<FamilyActivity[]> {
    const { data, error } = await supabase
        .from('family_activity')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching family activity:', error);
        return [];
    }

    return data || [];
}

/**
 * Subscribe to family activity changes (real-time)
 */
export function subscribeToFamilyActivity(
    groupId: string,
    onActivityChange: (activities: FamilyActivity[]) => void
) {
    const channel = supabase
        .channel(`family-activity-${groupId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'family_activity',
            filter: `group_id=eq.${groupId}`
        }, async () => {
            // Refetch activities on new insert
            const activities = await getFamilyActivity(groupId);
            onActivityChange(activities);
        })
        .subscribe();

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
}

// ============================================================================
// CONVENIENT HELPERS FOR ACTIVITY LOGGING
// ============================================================================

/**
 * Log a meal-related activity if user is in family mode.
 * This is a fire-and-forget function - errors are logged but don't throw.
 * Call this after successfully saving a meal/schedule.
 */
export async function logMealActivity(
    actionType: 'meal_added' | 'meal_edited' | 'meal_deleted' | 'plan_generated' | 'grocery_generated',
    description: string,
    targetDate?: string
): Promise<void> {
    try {
        const group = await getUserFamilyGroup();
        if (!group || !group.is_active) return; // Not in family mode

        await logFamilyActivity(
            group.id,
            actionType,
            description,
            actionType.includes('meal') ? 'scheduled_meal' :
                actionType === 'plan_generated' ? 'weekly_plan' : 'grocery_list',
            targetDate
        );
    } catch (error) {
        console.warn('Failed to log meal activity (non-critical):', error);
        // Don't throw - activity logging is not critical
    }
}
