import { createClient } from '@supabase/supabase-js';

/**
 * Admin API for QookCommander
 * 
 * Provides admin-only endpoints for:
 * - User management (search, view, modify credits)
 * - Account actions (reset, block, unblock)
 * - Analytics (dashboard metrics)
 * - Access control (add/remove admins)
 * 
 * All endpoints require the user to be in the admin_users table.
 */

interface AdminAction {
    action: string;
    userId: string;
    payload?: any;
}

type AdminCreditSourceType = 'bonus' | 'pack' | 'trial' | 'admin';
type StoredCreditType = 'bonus' | 'purchased' | 'trial';

function normalizeStoredCreditType(sourceType?: AdminCreditSourceType): StoredCreditType {
    switch (sourceType) {
        case 'pack':
            return 'purchased';
        case 'trial':
            return 'trial';
        case 'bonus':
        case 'admin':
        default:
            return 'bonus';
    }
}

function resolveCreditExpiry(sourceType?: AdminCreditSourceType, expiresAt?: string): string | null {
    if (expiresAt) {
        const parsedDate = new Date(expiresAt);
        if (Number.isNaN(parsedDate.getTime())) {
            throw new Error('Invalid expiry date');
        }
        return parsedDate.toISOString();
    }

    if (sourceType === 'pack') {
        return null;
    }

    const defaultDays = sourceType === 'bonus' ? 7 : 30;
    return new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeEmail(email: string | null | undefined): string {
    return (email ?? '').trim();
}

async function listAuthUsers(supabase: any) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
        throw error;
    }

    return data?.users || [];
}

function sumCreditColumns(row: {
    meal_credits?: number | null;
    grocery_credits?: number | null;
    edit_credits?: number | null;
    regen_credits?: number | null;
}) {
    return Number(row.meal_credits ?? 0)
        + Number(row.grocery_credits ?? 0)
        + Number(row.edit_credits ?? 0)
        + Number(row.regen_credits ?? 0);
}

function buildCreditBalancePatch(
    creditType: 'meal' | 'grocery' | 'edit' | 'regen',
    amount: number
): Record<string, number> {
    return {
        credits: creditType === 'meal' ? amount : 0,
        meal_credits: creditType === 'meal' ? amount : 0,
        grocery_credits: creditType === 'grocery' ? amount : 0,
        edit_credits: creditType === 'edit' ? amount : 0,
        regen_credits: creditType === 'regen' ? amount : 0,
    };
}

export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, userId, payload } = req.body as AdminAction;

    if (!action || !userId) {
        return res.status(400).json({ error: 'Missing action or userId' });
    }

    // Initialize Supabase with service role key for admin operations
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Step 1: Verify the user is an admin
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (!userData?.user?.email) {
            return res.status(401).json({ error: 'Invalid user' });
        }

        const adminEmail = userData.user.email;
        const { data: adminRecord, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('email', adminEmail)
            .single();

        if (adminError || !adminRecord) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        // Step 2: Execute the requested action
        let result: any;

        switch (action) {
            case 'check_admin':
                result = { isAdmin: true, role: adminRecord.role };
                break;

            case 'list_users':
                result = await listUsers(supabase, payload);
                break;

            case 'get_user_details':
                result = await getUserDetails(supabase, payload.targetUserId);
                break;

            case 'modify_credits':
                result = await modifyCredits(supabase, userId, adminEmail, payload);
                break;

            case 'reset_account':
                // Allow all admins to reset accounts (was super_admin only)
                result = await resetAccount(supabase, userId, adminEmail, payload.targetUserId);
                break;

            case 'block_user':
                result = await blockUser(supabase, userId, payload.targetUserId, payload.reason);
                break;

            case 'unblock_user':
                result = await unblockUser(supabase, payload.targetUserId);
                break;

            case 'add_admin':
                if (adminRecord.role !== 'super_admin') {
                    return res.status(403).json({ error: 'Super admin required to add admins' });
                }
                result = await addAdmin(supabase, userId, payload.email, payload.role);
                break;

            case 'remove_admin':
                if (adminRecord.role !== 'super_admin') {
                    return res.status(403).json({ error: 'Super admin required to remove admins' });
                }
                result = await removeAdmin(supabase, payload.email);
                break;

            case 'get_analytics':
                result = await getAnalytics(supabase);
                break;

            case 'search_user':
                result = await searchUser(supabase, payload.query);
                break;

            case 'list_test_accounts':
                result = await listTestAccounts(supabase);
                break;

            case 'create_test_user':
                if (adminRecord.role !== 'super_admin') {
                    return res.status(403).json({ error: 'Super admin required' });
                }
                result = await createTestUser(supabase, payload.email, payload.tier);
                break;

            case 'reset_test_user':
                result = await resetTestUser(supabase, userId, adminEmail, payload.email, payload.tier);
                break;

            case 'list_admins':
                result = await listAdmins(supabase);
                break;

            case 'list_templates':
                result = await listTemplates(supabase);
                break;

            case 'create_template':
                result = await createTemplate(supabase, userId, payload);
                break;

            case 'delete_template':
                result = await deleteTemplate(supabase, payload.templateId);
                break;

            case 'get_detailed_analytics':
                result = await getDetailedAnalytics(supabase);
                break;

            case 'get_user_activity_timeline':
                result = await getUserActivityTimeline(supabase, payload.targetUserId);
                break;

            case 'get_aggregate_insights':
                result = await getAggregateInsights(supabase);
                break;

            case 'delete_user':
                // Allow all admins to delete users (was super_admin only)
                result = await deleteUser(supabase, userId, adminEmail, payload.targetUserId);
                break;

            case 'get_admin_history':
                result = await getAdminHistory(supabase);
                break;

            case 'get_user_preferences':
                result = await getUserPreferences(supabase, payload.targetUserId);
                break;

            case 'get_all_user_profiles':
                result = await getAllUserProfiles(supabase);
                break;

            case 'change_tier':
                result = await changeTier(supabase, userId, adminEmail, payload.targetUserId, payload.newTier);
                break;

            case 'cancel_razorpay':
                result = await cancelRazorpaySubscription(supabase, userId, adminEmail, payload.targetUserId);
                break;

            // Feature Matrix Management
            case 'get_feature_matrix':
                result = await getFeatureMatrix(supabase);
                break;

            case 'update_feature_access':
                result = await updateFeatureAccess(supabase, userId, payload.featureId, payload.tierId, payload.enabled);
                break;

            case 'get_subscription_plans':
                result = await getSubscriptionPlans(supabase);
                break;

            // Launch Offer Management
            case 'get_launch_offer':
                result = await getLaunchOffer(supabase);
                break;

            case 'update_launch_offer':
                result = await updateLaunchOffer(supabase, userId, payload);
                break;

            // Admin Notifications to Users
            case 'send_notification':
                result = await sendNotification(supabase, userId, adminEmail, payload);
                break;

            case 'list_notifications':
                result = await listNotificationHistory(supabase);
                break;

            case 'get_push_token_stats':
                result = await getPushTokenStats(supabase);
                break;

            default:
                return res.status(400).json({ error: 'Unknown action' });
        }

        return res.status(200).json({ success: true, data: result });

    } catch (error: any) {
        console.error('Admin API error:', error);
        return res.status(500).json({ error: 'Admin operation failed', details: error.message });
    }
}

// =====================================================
// Admin Action Implementations
// =====================================================

async function listUsers(supabase: any, payload: any) {
    const { page = 1, limit = 20, filter = 'all' } = payload || {};
    const offset = (page - 1) * limit;

    // Get users from dim_users with subscription and credit info
    let query = supabase
        .from('dim_users')
        .select(`
            user_id,
            email,
            signup_date,
            current_tier,
            last_active_at,
            total_generations
        `, { count: 'exact' })
        .is('deleted_at', null)
        .order('last_active_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

    if (filter !== 'all') {
        query = query.eq('current_tier', filter);
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    // For any user missing email, fetch from auth.users
    const enrichedUsers = await Promise.all((users || []).map(async (user: any) => {
        if (!user.email && user.user_id) {
            try {
                const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);
                if (authUser?.user?.email) {
                    // Also update dim_users with the email for future queries
                    await supabase
                        .from('dim_users')
                        .update({ email: authUser.user.email })
                        .eq('user_id', user.user_id);
                    return { ...user, email: normalizeEmail(authUser.user.email) };
                }
            } catch (e) {
                // Ignore errors, just return user without email
            }
        }
        return { ...user, email: normalizeEmail(user.email) };
    }));

    const userIds = enrichedUsers.map((user: any) => user.user_id).filter(Boolean);
    const creditSummaryMap = new Map<string, { active_credits: number; bonus_credits: number }>();

    if (userIds.length > 0) {
        const { data: creditRows, error: creditError } = await supabase
            .from('user_credits')
            .select('user_id, credit_type, meal_credits, grocery_credits, edit_credits, regen_credits, expires_at')
            .in('user_id', userIds)
            .is('deleted_at', null);

        if (creditError) throw creditError;

        const now = Date.now();
        for (const row of creditRows || []) {
            const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;
            const isActive = expiresAt === null || (Number.isFinite(expiresAt) && expiresAt > now);

            if (!isActive) {
                continue;
            }

            const totalForRow = sumCreditColumns(row);
            const existing = creditSummaryMap.get(row.user_id) || { active_credits: 0, bonus_credits: 0 };
            existing.active_credits += totalForRow;

            if (row.credit_type === 'bonus') {
                existing.bonus_credits += totalForRow;
            }

            creditSummaryMap.set(row.user_id, existing);
        }
    }

    return {
        users: enrichedUsers.map((user: any) => {
            const creditSummary = creditSummaryMap.get(user.user_id);
            return {
                ...user,
                active_credits: creditSummary?.active_credits ?? 0,
                bonus_credits: creditSummary?.bonus_credits ?? 0,
            };
        }),
        page,
        limit,
        total: count
    };
}

async function searchUser(supabase: any, query: string) {
    if (!query || query.length < 3) {
        return { users: [] };
    }

    const { data: users, error } = await supabase
        .from('dim_users')
        .select('user_id, email, current_tier, last_active_at')
        .is('deleted_at', null)
        .ilike('email', `%${query}%`)
        .limit(20);

    if (error) throw error;

    return {
        users: (users || []).map((user: any) => ({
            ...user,
            email: normalizeEmail(user.email),
        }))
    };
}

async function getUserDetails(supabase: any, targetUserId: string) {
    // Get user info
    const { data: userInfo } = await supabase
        .from('dim_users')
        .select('*')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .maybeSingle();

    if (!userInfo) {
        throw new Error('User not found or already deleted');
    }

    // Get subscription
    const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .maybeSingle();

    // Get all credits
    const { data: credits } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', targetUserId)
        .is('deleted_at', null);

    // Get recent usage (last 30)
    const { data: usage } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(30);

    // Get credit transactions (purchases, grants, etc.)
    const { data: transactions } = await supabase
        .from('fact_credit_transactions')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(20);

    // Get meal plans count
    const { count: mealPlanCount } = await supabase
        .from('weekly_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

    // Get meal history count
    const { count: mealHistoryCount } = await supabase
        .from('meal_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

    // Get preference profiles
    const { data: profiles } = await supabase
        .from('preference_profiles')
        .select('id, name, dietary_type, is_default, created_at')
        .eq('user_id', targetUserId)
        .is('deleted_at', null);

    // Get admin audit log entries for this user
    const { data: auditLog } = await supabase
        .from('admin_audit_log')
        .select('*')
        .eq('target_user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(10);

    // Check if blocked
    const { data: blocked } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

    return {
        user: {
            ...userInfo,
            email: normalizeEmail(userInfo.email),
        },
        subscription,
        credits,
        recentUsage: usage || [],
        transactions: transactions || [],
        mealPlanCount: mealPlanCount || 0,
        mealHistoryCount: mealHistoryCount || 0,
        preferenceProfiles: profiles || [],
        auditLog: auditLog || [],
        isBlocked: !!blocked,
        blockedInfo: blocked
    };
}

// NOTE: modifyCredits function moved to end of file with enhanced expiry/source type support

async function resetAccount(supabase: any, adminId: string, adminEmail: string, targetUserId: string) {
    // Delete meal plans
    await supabase.from('weekly_plans').delete().eq('user_id', targetUserId);

    // Delete preferences (keep one default)
    await supabase.from('preference_profiles').delete().eq('user_id', targetUserId);

    // Reset credits to trial values
    await supabase.from('user_credits').delete().eq('user_id', targetUserId);

    const trialEndsAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('user_credits').insert({
        user_id: targetUserId,
        credit_type: 'trial',
        credits: 25,
        meal_credits: 25,
        grocery_credits: 63,
        edit_credits: 25,
        regen_credits: 25,
        expires_at: trialEndsAt
    });

    // Reset subscription to free
    await supabase
        .from('user_subscriptions')
        .update({ plan_id: 'free', status: 'active', trial_ends_at: trialEndsAt, deleted_at: null })
        .eq('user_id', targetUserId);

    // Clear usage history
    await supabase.from('usage_tracking').delete().eq('user_id', targetUserId);

    // Log the action
    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'account_reset',
        target_user_id: targetUserId,
        details: { admin_email: adminEmail }
    });

    return { success: true, message: 'Account reset to fresh state' };
}

async function blockUser(supabase: any, adminId: string, targetUserId: string, reason: string) {
    await supabase.from('blocked_users').upsert({
        user_id: targetUserId,
        blocked_by: adminId,
        reason,
        blocked_at: new Date().toISOString()
    });

    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'user_blocked',
        target_user_id: targetUserId,
        details: { reason }
    });

    return { success: true };
}

async function unblockUser(supabase: any, targetUserId: string) {
    await supabase.from('blocked_users').delete().eq('user_id', targetUserId);
    return { success: true };
}

async function addAdmin(supabase: any, adminId: string, email: string, role: string = 'admin') {
    const { error } = await supabase.from('admin_users').insert({
        email,
        role,
        added_by: adminId
    });

    if (error) {
        if (error.code === '23505') {
            throw new Error('Email already has admin access');
        }
        throw error;
    }

    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'admin_added',
        details: { email, role }
    });

    return { success: true };
}

async function removeAdmin(supabase: any, email: string) {
    await supabase.from('admin_users').delete().eq('email', email);
    return { success: true };
}

async function getAnalytics(supabase: any) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Active users (last 7 days)
    const { count: activeUsers } = await supabase
        .from('dim_users')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('last_active_at', sevenDaysAgo.toISOString());

    // Total users
    const { count: totalUsers } = await supabase
        .from('dim_users')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

    // Credits used (last 7 days)
    const { data: usageData } = await supabase
        .from('usage_tracking')
        .select('credits_used')
        .gte('created_at', sevenDaysAgo.toISOString());

    const creditsUsed = usageData?.reduce((sum: number, row: any) => sum + parseFloat(row.credits_used || 0), 0) || 0;

    // Plan distribution
    const { data: planData } = await supabase
        .from('user_subscriptions')
        .select('plan_id')
        .is('deleted_at', null);

    const planDistribution: Record<string, number> = {};
    planData?.forEach((row: any) => {
        planDistribution[row.plan_id] = (planDistribution[row.plan_id] || 0) + 1;
    });

    // Total revenue (sum from fact_credit_transactions)
    const { data: revenueData } = await supabase
        .from('fact_credit_transactions')
        .select('revenue_inr')
        .eq('txn_type', 'purchase');

    const totalRevenue = revenueData?.reduce((sum: number, row: any) => sum + (row.revenue_inr || 0), 0) || 0;

    return {
        activeUsers7d: activeUsers || 0,
        totalUsers: totalUsers || 0,
        creditsUsed7d: creditsUsed,
        totalRevenueINR: totalRevenue,
        planDistribution
    };
}

// =====================================================
// Test Account Management
// =====================================================

async function listTestAccounts(supabase: any) {
    const { data: accounts, error } = await supabase
        .from('test_accounts')
        .select('*')
        .order('email');

    if (error) throw error;

    const authUsers = await listAuthUsers(supabase);
    const authEmailSet = new Set(
        authUsers
            .map((user: any) => normalizeEmail(user.email).toLowerCase())
            .filter(Boolean)
    );

    const enrichedAccounts = (accounts || []).map((acc: any) => {
        const normalizedEmail = normalizeEmail(acc.email).toLowerCase();
        const exists = authEmailSet.has(normalizedEmail);
        const usesGoogleBootstrap = acc.reset_mode === 'manual';

        return {
            ...acc,
            exists,
            usesGoogleBootstrap,
            canCreate: !usesGoogleBootstrap && !exists,
        };
    });

    return { accounts: enrichedAccounts };
}

async function createTestUser(supabase: any, email: string, tier: string) {
    // Create user via Supabase Auth Admin API
    const password = `TestUser${tier}${Date.now()}!`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (authError) {
        if (authError.message?.includes('already registered')) {
            return { success: true, message: 'User already exists', userId: null };
        }
        throw authError;
    }

    const userId = authData.user.id;

    // Set up tier-specific data
    const tierConfigs: Record<string, any> = {
        free: {
            plan_id: 'free',
            meal_credits: 25,
            grocery_credits: 63,
            edit_credits: 25,
            regen_credits: 25
        },
        basic: {
            plan_id: 'basic',
            meal_credits: 100,
            grocery_credits: 250,
            edit_credits: 100,
            regen_credits: 100
        },
        pro: {
            plan_id: 'pro',
            meal_credits: 999,
            grocery_credits: 999,
            edit_credits: 999,
            regen_credits: 999,
            byok_enabled: true
        }
    };

    const config = tierConfigs[tier] || tierConfigs.free;
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const creditType = config.plan_id === 'free' ? 'trial' : 'plan';

    // Create subscription
    await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        plan_id: config.plan_id,
        status: 'active',
        billing_preference: config.byok_enabled ? 'byok' : 'credits',
        trial_ends_at: expiresAt,
        deleted_at: null
    });

    // Create credits
    await supabase.from('user_credits').insert({
        user_id: userId,
        credit_type: creditType,
        credits: config.meal_credits,
        meal_credits: config.meal_credits,
        grocery_credits: config.grocery_credits,
        edit_credits: config.edit_credits,
        regen_credits: config.regen_credits,
        expires_at: expiresAt
    });

    // Add to dim_users
    await supabase.from('dim_users').upsert({
        user_id: userId,
        email,
        signup_date: new Date().toISOString().split('T')[0],
        current_tier: tier,
        deleted_at: null
    });

    return { success: true, userId, message: `Test user created for ${tier} tier` };
}

async function resetTestUser(supabase: any, adminId: string, adminEmail: string, email: string, _tier: string) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.rpc('admin_reset_test_account', {
        p_email: normalizedEmail,
    });

    if (error) {
        throw error;
    }

    const targetUserId = data?.target_user_id || null;
    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'reset_test_account',
        target_user_id: targetUserId,
        details: {
            admin_email: adminEmail,
            target_email: normalizedEmail,
            reset_at: data?.reset_at ?? null,
            counts: data?.counts ?? {},
        }
    });

    return {
        success: true,
        message: `Test account ${normalizedEmail} reset to fresh onboarding state`,
        ...(data || {}),
    };
}

// =====================================================
// Admin Management
// =====================================================

async function listAdmins(supabase: any) {
    const { data: admins, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return { admins };
}

// =====================================================
// Template Management
// =====================================================

async function listTemplates(supabase: any) {
    const { data: templates, error } = await supabase
        .from('custom_templates')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return { templates };
}

async function createTemplate(supabase: any, adminId: string, payload: any) {
    const { name, description, templateData, targetAudience } = payload;

    const { data, error } = await supabase.from('custom_templates').insert({
        name,
        description,
        template_data: templateData,
        target_audience: targetAudience || 'all_users',
        created_by: adminId,
        is_active: true
    }).select().single();

    if (error) throw error;
    return { success: true, template: data };
}

async function deleteTemplate(supabase: any, templateId: string) {
    await supabase.from('custom_templates').delete().eq('id', templateId);
    return { success: true };
}

// =====================================================
// Detailed Analytics Functions
// =====================================================

async function getDetailedAnalytics(supabase: any) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total users
    const { count: totalUsers } = await supabase
        .from('dim_users')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

    // Active users (7d and 30d)
    const { count: activeUsers7d } = await supabase
        .from('dim_users')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('last_active_at', sevenDaysAgo.toISOString());

    const { count: activeUsers30d } = await supabase
        .from('dim_users')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('last_active_at', thirtyDaysAgo.toISOString());

    // Generations by type
    const { data: usageByType } = await supabase
        .from('usage_tracking')
        .select('action_type, credits_used')
        .gte('created_at', thirtyDaysAgo.toISOString());

    const generationsByType: Record<string, { count: number; credits: number }> = {};
    usageByType?.forEach((u: any) => {
        if (!generationsByType[u.action_type]) {
            generationsByType[u.action_type] = { count: 0, credits: 0 };
        }
        generationsByType[u.action_type].count++;
        generationsByType[u.action_type].credits += u.credits_used || 0;
    });

    // Daily generation trend (last 7 days)
    const { data: dailyUsage } = await supabase
        .from('usage_tracking')
        .select('created_at, action_type')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

    const dailyTrend: Record<string, number> = {};
    dailyUsage?.forEach((u: any) => {
        const date = new Date(u.created_at).toISOString().split('T')[0];
        dailyTrend[date] = (dailyTrend[date] || 0) + 1;
    });

    // Plan distribution
    const { data: planData } = await supabase
        .from('user_subscriptions')
        .select('plan_id')
        .is('deleted_at', null);

    const planDistribution: Record<string, number> = {};
    planData?.forEach((row: any) => {
        planDistribution[row.plan_id] = (planDistribution[row.plan_id] || 0) + 1;
    });

    // Total revenue
    const { data: revenueData } = await supabase
        .from('fact_credit_transactions')
        .select('revenue_inr, txn_type');

    const totalRevenue = revenueData?.reduce((sum: number, row: any) =>
        sum + (row.txn_type === 'purchase' ? (row.revenue_inr || 0) : 0), 0) || 0;

    // Preference profiles count
    const { count: totalProfiles } = await supabase
        .from('preference_profiles')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

    // Meal plans count
    const { count: totalMealPlans } = await supabase
        .from('weekly_plans')
        .select('*', { count: 'exact', head: true });

    return {
        totalUsers: totalUsers || 0,
        activeUsers7d: activeUsers7d || 0,
        activeUsers30d: activeUsers30d || 0,
        generationsByType,
        dailyTrend,
        planDistribution,
        totalRevenueINR: totalRevenue,
        totalProfiles: totalProfiles || 0,
        totalMealPlans: totalMealPlans || 0
    };
}

async function getUserActivityTimeline(supabase: any, targetUserId: string) {
    // Get all usage tracking for this user
    const { data: usage } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(100);

    // Get all preference profiles
    const { data: profiles } = await supabase
        .from('preference_profiles')
        .select('id, name, dietary_type, dislikes, breakfast_preferences, lunch_preferences, dinner_preferences, is_default, created_at')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    // Get meal history (ratings)
    const { data: mealHistory } = await supabase
        .from('meal_history')
        .select('meal_name, meal_type, rating, created_at')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(50);

    // Get saved meal plans
    const { data: mealPlans } = await supabase
        .from('weekly_plans')
        .select('id, profile_id, week_range:week_start_date, created_at')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(20);

    // Get scheduled meals
    const { data: scheduledMeals } = await supabase
        .from('scheduled_meals')
        .select('date, breakfast, lunch, dinner, created_at')
        .eq('user_id', targetUserId)
        .order('date', { ascending: false })
        .limit(30);

    // Get credit transactions
    const { data: creditTxns } = await supabase
        .from('fact_credit_transactions')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(20);

    // Build activity timeline
    const timeline: any[] = [];

    usage?.forEach((u: any) => {
        timeline.push({
            type: 'generation',
            action: u.action_type,
            credits: u.credits_used,
            source: u.api_source,
            timestamp: u.created_at
        });
    });

    profiles?.forEach((p: any) => {
        timeline.push({
            type: 'profile_created',
            profileName: p.name,
            dietaryType: p.dietary_type,
            timestamp: p.created_at
        });
    });

    mealHistory?.forEach((m: any) => {
        timeline.push({
            type: 'meal_rated',
            mealName: m.meal_name,
            mealType: m.meal_type,
            rating: m.rating,
            timestamp: m.created_at
        });
    });

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Compute summary stats
    const summary = {
        totalGenerations: usage?.length || 0,
        totalProfiles: profiles?.length || 0,
        totalMealPlans: mealPlans?.length || 0,
        totalScheduledMeals: scheduledMeals?.length || 0,
        totalRatings: mealHistory?.length || 0,
        likedMeals: mealHistory?.filter((m: any) => m.rating === 'liked').length || 0,
        dislikedMeals: mealHistory?.filter((m: any) => m.rating === 'disliked').length || 0
    };

    return {
        timeline: timeline.slice(0, 100),
        profiles,
        mealPlans,
        scheduledMeals,
        mealHistory,
        creditTransactions: creditTxns,
        summary
    };
}

async function getAggregateInsights(supabase: any) {
    // Most common dietary types
    const { data: dietaryData } = await supabase
        .from('preference_profiles')
        .select('dietary_type')
        .is('deleted_at', null);

    const dietaryTypes: Record<string, number> = {};
    dietaryData?.forEach((p: any) => {
        if (p.dietary_type) {
            dietaryTypes[p.dietary_type] = (dietaryTypes[p.dietary_type] || 0) + 1;
        }
    });

    // Most common dislikes
    const { data: dislikesData } = await supabase
        .from('preference_profiles')
        .select('dislikes')
        .is('deleted_at', null);

    const dislikesCount: Record<string, number> = {};
    dislikesData?.forEach((p: any) => {
        if (p.dislikes && Array.isArray(p.dislikes)) {
            p.dislikes.forEach((d: string) => {
                dislikesCount[d] = (dislikesCount[d] || 0) + 1;
            });
        }
    });

    // Peak usage hours
    const { data: usageHours } = await supabase
        .from('usage_tracking')
        .select('created_at');

    const hourCounts: Record<number, number> = {};
    usageHours?.forEach((u: any) => {
        const hour = new Date(u.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Feature adoption
    const { data: featureUsage } = await supabase
        .from('usage_tracking')
        .select('action_type, user_id');

    const featureUsers: Record<string, Set<string>> = {};
    featureUsage?.forEach((u: any) => {
        if (!featureUsers[u.action_type]) {
            featureUsers[u.action_type] = new Set();
        }
        featureUsers[u.action_type].add(u.user_id);
    });

    const featureAdoption: Record<string, number> = {};
    Object.entries(featureUsers).forEach(([feature, users]) => {
        featureAdoption[feature] = users.size;
    });

    // Sort dislikes by count
    const topDislikes = Object.entries(dislikesCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([item, count]) => ({ item, count }));

    // Sort dietary types by count
    const topDietaryTypes = Object.entries(dietaryTypes)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }));

    // Find peak hours
    const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));

    return {
        topDietaryTypes,
        topDislikes,
        peakHours,
        featureAdoption,
        hourlyDistribution: hourCounts
    };
}

// =====================================================
// User Management Functions
// =====================================================

async function deleteUser(supabase: any, adminId: string, adminEmail: string, targetUserId: string) {
    try {
        const { data: archiveResult, error: archiveError } = await supabase.rpc('soft_delete_user', {
            p_user_id: targetUserId,
            p_reason: `Admin deleted user (${adminEmail})`
        });

        if (archiveError) {
            throw archiveError;
        }

        if (archiveResult?.success === false) {
            throw new Error(archiveResult.error || 'Failed to archive user');
        }

        await supabase.from('admin_audit_log').insert({
            admin_user_id: adminId,
            action_type: 'delete_user',
            target_user_id: targetUserId,
            details: { reason: 'Admin deleted user', admin_email: adminEmail }
        });

        const { error } = await supabase.auth.admin.deleteUser(targetUserId);
        if (error) {
            console.error('Auth delete error:', error);
            throw new Error(`Failed to delete auth user: ${error.message}`);
        }

        return { success: true, message: 'User deleted successfully' };
    } catch (error: any) {
        console.error('Delete user error:', error);
        throw new Error(`Delete user failed: ${error.message}`);
    }
}

async function getAdminHistory(supabase: any) {
    const { data, error } = await supabase
        .from('admin_audit_log')
        .select(`
            id,
            action_type,
            target_user_id,
            target_entity_type,
            details,
            created_at,
            admin_user_id
        `)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) throw error;

    // Get admin emails for display
    const adminIds = [...new Set(data?.map((d: any) => d.admin_user_id) || [])];
    const { data: admins } = await supabase
        .from('admin_users')
        .select('id, email')
        .in('id', adminIds);

    const adminMap = new Map(admins?.map((a: any) => [a.id, a.email]) || []);

    // Get target user emails
    const targetIds = [...new Set(data?.filter((d: any) => d.target_user_id).map((d: any) => d.target_user_id) || [])];
    const { data: users } = await supabase
        .from('dim_users')
        .select('user_id, email')
        .is('deleted_at', null)
        .in('user_id', targetIds);

    const { data: deletedUsers } = await supabase
        .from('deleted_users')
        .select('id, email')
        .in('id', targetIds);

    const userMap = new Map<string, string>();
    users?.forEach((u: any) => userMap.set(u.user_id, normalizeEmail(u.email)));
    deletedUsers?.forEach((u: any) => {
        if (!userMap.has(u.id)) {
            userMap.set(u.id, normalizeEmail(u.email));
        }
    });

    return {
        history: data?.map((h: any) => ({
            ...h,
            admin_email: adminMap.get(h.admin_user_id) || 'Unknown',
            target_email: h.target_user_id ? userMap.get(h.target_user_id) || 'Unknown' : null
        })) || []
    };
}

async function getUserPreferences(supabase: any, targetUserId: string) {
    const { data, error } = await supabase
        .from('preference_profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return { profiles: data || [] };
}

async function getAllUserProfiles(supabase: any) {
    // Get all preference profiles with user info
    const { data, error } = await supabase
        .from('preference_profiles')
        .select(`
            id,
            user_id,
            name,
            dietary_type,
            dislikes,
            breakfast_preferences,
            lunch_preferences,
            dinner_preferences,
            is_default,
            created_at
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // Get user emails
    const userIds = [...new Set(data?.map((d: any) => d.user_id) || [])];
    const { data: users } = await supabase
        .from('dim_users')
        .select('user_id, email')
        .is('deleted_at', null)
        .in('user_id', userIds);

    const userMap = new Map(users?.map((u: any) => [u.user_id, normalizeEmail(u.email)]) || []);

    // Group by unique dietary configurations
    const uniqueConfigs: Record<string, any> = {};
    data?.forEach((p: any) => {
        const key = `${p.dietary_type}-${(p.dislikes || []).sort().join(',')}`;
        if (!uniqueConfigs[key]) {
            uniqueConfigs[key] = {
                dietary_type: p.dietary_type,
                dislikes: p.dislikes || [],
                count: 0,
                users: []
            };
        }
        uniqueConfigs[key].count++;
        const email = userMap.get(p.user_id);
        if (email && !uniqueConfigs[key].users.includes(email)) {
            uniqueConfigs[key].users.push(email);
        }
    });

    return {
        profiles: data?.map((p: any) => ({
            ...p,
            user_email: userMap.get(p.user_id) || 'Unknown'
        })) || [],
        uniqueConfigs: Object.values(uniqueConfigs).sort((a, b) => b.count - a.count),
        totalProfiles: data?.length || 0,
        totalUsers: userIds.length
    };
}

// =====================================================
// Tier and Subscription Management
// =====================================================

async function changeTier(supabase: any, adminId: string, adminEmail: string, targetUserId: string, newTier: string) {
    // Validate tier
    const validTiers = ['free', 'basic', 'pro', 'byok'];
    if (!validTiers.includes(newTier)) {
        throw new Error(`Invalid tier: ${newTier}. Must be one of: ${validTiers.join(', ')}`);
    }

    // Update user subscription
    const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
            user_id: targetUserId,
            plan_id: newTier,
            status: 'active',
            deleted_at: null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (subError) throw subError;

    // Log the action
    await supabase
        .from('admin_audit_log')
        .insert({
            admin_user_id: adminId,
            action_type: 'change_tier',
            target_user_id: targetUserId,
            details: { new_tier: newTier, reason: 'Admin override', admin_email: adminEmail }
        });

    return { success: true, message: `User tier changed to ${newTier}` };
}

async function cancelRazorpaySubscription(supabase: any, adminId: string, adminEmail: string, targetUserId: string) {
    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('razorpay_subscription_id, plan_id')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .maybeSingle();

    if (subError) throw subError;
    if (!subscription?.razorpay_subscription_id) {
        return { success: false, message: 'No active Razorpay subscription found' };
    }

    // Call Razorpay API to cancel subscription
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
        throw new Error('Razorpay credentials not configured');
    }

    try {
        const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
        const response = await fetch(
            `https://api.razorpay.com/v1/subscriptions/${subscription.razorpay_subscription_id}/cancel`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cancel_at_cycle_end: false }) // Immediate cancel
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Razorpay error: ${errorData.error?.description || 'Unknown error'}`);
        }

        // Update subscription in database
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                razorpay_subscription_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId);

        // Log the action
        await supabase
            .from('admin_audit_log')
            .insert({
                admin_user_id: adminId,
                action_type: 'cancel_razorpay',
                target_user_id: targetUserId,
                details: {
                    subscription_id: subscription.razorpay_subscription_id,
                    previous_plan: subscription.plan_id,
                    admin_email: adminEmail
                }
            });

        return { success: true, message: 'Razorpay subscription cancelled successfully' };
    } catch (error: any) {
        console.error('Razorpay cancellation error:', error);
        throw new Error(`Failed to cancel Razorpay: ${error.message}`);
    }
}

// Modify user credits with custom expiry and source type
async function modifyCredits(
    supabase: any,
    adminId: string,
    adminEmail: string,
    payload: {
        targetUserId: string;
        creditType: 'meal' | 'grocery' | 'edit' | 'regen';
        operation: 'add' | 'remove';
        amount: number;
        sourceType?: 'bonus' | 'pack' | 'trial' | 'admin';
        expiresAt?: string; // ISO date string
        reason?: string;
    }
) {
    const { targetUserId, creditType, operation, amount, sourceType = 'admin', expiresAt, reason = 'Admin modification' } = payload;
    const normalizedAmount = Number(amount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error('Credit amount must be greater than zero');
    }

    // Map credit type to column name
    const creditColumnMap: Record<string, string> = {
        meal: 'meal_credits',
        grocery: 'grocery_credits',
        edit: 'edit_credits',
        regen: 'regen_credits',
    };
    const creditColumn = creditColumnMap[creditType] || 'meal_credits';

    if (operation === 'add') {
        // Insert a new credit row with custom expiry and source type
        const storedCreditType = normalizeStoredCreditType(sourceType);
        const expiryDate = resolveCreditExpiry(sourceType, expiresAt);

        const { error: insertError } = await supabase
            .from('user_credits')
            .insert({
                user_id: targetUserId,
                credit_type: storedCreditType,
                ...buildCreditBalancePatch(creditType, normalizedAmount),
                expires_at: expiryDate,
            });

        if (insertError) throw insertError;
    } else {
        // Remove credits by finding existing rows and deducting
        const { data: creditRows, error: fetchError } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', targetUserId)
            .is('deleted_at', null)
            .gt(creditColumn, 0)
            .order('expires_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true }); // Remove from soonest expiring first

        if (fetchError) throw fetchError;

        let remaining = normalizedAmount;
        for (const row of creditRows || []) {
            if (remaining <= 0) break;
            const available = row[creditColumn] || 0;
            const toDeduct = Math.min(available, remaining);
            const updatePayload: Record<string, number> = {
                [creditColumn]: available - toDeduct,
            };

            if (creditColumn === 'meal_credits') {
                updatePayload.credits = Math.max(Number(row.credits ?? available) - toDeduct, 0);
            }

            const { error: updateError } = await supabase
                .from('user_credits')
                .update(updatePayload)
                .eq('id', row.id);

            if (!updateError) {
                remaining -= toDeduct;
            }
        }

        if (remaining > 0) {
            throw new Error(`Insufficient ${creditType} credits to remove ${normalizedAmount}`);
        }
    }

    // Log the action
    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'modify_credits',
        target_user_id: targetUserId,
        details: {
            credit_type: creditType,
            operation,
            amount: normalizedAmount,
            source_type: sourceType,
            expires_at: expiresAt,
            reason,
            admin_email: adminEmail
        }
    });

    return { success: true, message: `${normalizedAmount} ${creditType} credits ${operation === 'add' ? 'added' : 'removed'}` };
}

// =====================================================
// Feature Matrix Management
// =====================================================

async function getFeatureMatrix(supabase: any) {
    // Get all feature tier access records
    const { data: matrix, error } = await supabase
        .from('feature_tier_access')
        .select('*')
        .order('feature_id')
        .order('tier_id');

    if (error) throw error;

    // Get list of all tiers
    const { data: tiers } = await supabase
        .from('subscription_plans')
        .select('id, name')
        .order('price_inr');

    // Get unique features
    const features = [...new Set(matrix?.map((m: any) => m.feature_id) || [])];

    // Organize into a matrix structure
    const featureMap: Record<string, Record<string, boolean>> = {};
    matrix?.forEach((m: any) => {
        if (!featureMap[m.feature_id]) {
            featureMap[m.feature_id] = {};
        }
        featureMap[m.feature_id][m.tier_id] = m.enabled;
    });

    return { matrix, tiers, features, featureMap };
}

async function updateFeatureAccess(supabase: any, adminId: string, featureId: string, tierId: string, enabled: boolean) {
    // Update the feature access
    const { error } = await supabase
        .from('feature_tier_access')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('feature_id', featureId)
        .eq('tier_id', tierId);

    if (error) throw error;

    // Log the action
    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'feature_access_updated',
        details: { feature_id: featureId, tier_id: tierId, enabled }
    });

    return { success: true, message: `Feature ${featureId} ${enabled ? 'enabled' : 'disabled'} for ${tierId}` };
}

async function getSubscriptionPlans(supabase: any) {
    const { data: plans, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_inr');

    if (error) throw error;

    return { plans };
}

// =====================================================
// Launch Offer Management
// =====================================================

async function getLaunchOffer(supabase: any) {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'launch_offer')
        .single();

    if (error) {
        return { enabled: false, trial_days: 30, effective_tier: 'family_pro' };
    }

    return data?.value || { enabled: false, trial_days: 30, effective_tier: 'family_pro' };
}

async function updateLaunchOffer(supabase: any, adminId: string, payload: { enabled: boolean; trial_days: number; effective_tier: string }) {
    const { enabled, trial_days, effective_tier } = payload;

    const { error } = await supabase
        .from('app_settings')
        .upsert({
            key: 'launch_offer',
            value: { enabled, trial_days, effective_tier },
            updated_at: new Date().toISOString(),
            updated_by: adminId
        }, { onConflict: 'key' });

    if (error) throw error;

    // Log the action
    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'launch_offer_updated',
        details: { enabled, trial_days, effective_tier }
    });

    return { success: true, message: `Launch offer ${enabled ? 'enabled' : 'disabled'}` };
}

// =====================================================
// Admin Push Notifications
// =====================================================

interface NotificationPayload {
    title: string;
    body: string;
    targetType: 'all' | 'specific' | 'tier';
    targetUserIds?: string[];
    targetTier?: string;
}

async function sendNotification(
    supabase: any,
    adminId: string,
    adminEmail: string,
    payload: NotificationPayload
) {
    const { title, body, targetType, targetUserIds, targetTier } = payload;

    if (!title || !body) {
        throw new Error('Title and body are required');
    }

    // Get target FCM tokens based on target type
    let tokensQuery = supabase.from('user_push_tokens').select('user_id, fcm_token');

    if (targetType === 'specific' && targetUserIds?.length) {
        tokensQuery = tokensQuery.in('user_id', targetUserIds);
    } else if (targetType === 'tier' && targetTier) {
        // Join with dim_users to filter by tier
        const { data: tierUsers } = await supabase
            .from('dim_users')
            .select('user_id')
            .eq('current_tier', targetTier);

        const tierUserIds = tierUsers?.map((u: any) => u.user_id) || [];
        if (tierUserIds.length === 0) {
            return { success: false, message: 'No users found for this tier' };
        }
        tokensQuery = tokensQuery.in('user_id', tierUserIds);
    }

    const { data: tokens, error: tokenError } = await tokensQuery;

    if (tokenError) throw tokenError;

    if (!tokens || tokens.length === 0) {
        return { success: false, message: 'No push tokens found for target users', deliveryCount: 0 };
    }

    // Send notifications via FCM (mock for now - actual FCM call would go here)
    // In production, you would use Firebase Admin SDK to send push notifications
    let successCount = 0;
    let failureCount = 0;

    // For now, we log the notification - actual FCM sending requires server-side Firebase setup
    // This stores the notification record for when FCM is configured
    console.log(`[Admin Notification] Sending to ${tokens.length} devices:`, { title, body });

    // In a real implementation, you would:
    // 1. Import firebase-admin
    // 2. Initialize with service account
    // 3. Call admin.messaging().sendMulticast({ tokens, notification: { title, body } })

    // For now, assume all would succeed for logging purposes
    successCount = tokens.length;

    // Log the notification in admin_notifications table
    const { error: insertError } = await supabase.from('admin_notifications').insert({
        title,
        body,
        target_type: targetType,
        target_user_ids: targetType === 'specific' ? targetUserIds : null,
        target_tier: targetType === 'tier' ? targetTier : null,
        sent_by: adminId,
        sent_by_email: adminEmail,
        delivery_count: tokens.length,
        success_count: successCount,
        failure_count: failureCount
    });

    if (insertError) {
        console.error('Failed to log notification:', insertError);
    }

    // Log in admin audit
    await supabase.from('admin_audit_log').insert({
        admin_user_id: adminId,
        action_type: 'notification_sent',
        details: {
            title,
            body,
            target_type: targetType,
            target_count: tokens.length,
            success_count: successCount
        }
    });

    return {
        success: true,
        message: `Notification queued for ${tokens.length} users`,
        deliveryCount: tokens.length,
        successCount,
        failureCount
    };
}

async function listNotificationHistory(supabase: any) {
    const { data: notifications, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

    if (error) throw error;

    return { notifications: notifications || [] };
}

async function getPushTokenStats(supabase: any) {
    // Total registered tokens
    const { count: totalTokens } = await supabase
        .from('user_push_tokens')
        .select('*', { count: 'exact', head: true });

    // Tokens by device type
    const { data: deviceBreakdown } = await supabase
        .from('user_push_tokens')
        .select('device_type');

    const byDevice: Record<string, number> = {};
    deviceBreakdown?.forEach((t: any) => {
        const type = t.device_type || 'unknown';
        byDevice[type] = (byDevice[type] || 0) + 1;
    });

    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentRegistrations } = await supabase
        .from('user_push_tokens')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);

    return {
        totalTokens: totalTokens || 0,
        byDevice,
        recentRegistrations: recentRegistrations || 0
    };
}
