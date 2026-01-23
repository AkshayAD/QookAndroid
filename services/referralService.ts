import { supabase } from '../lib/supabase';

// =====================================================
// REFERRAL CODE MANAGEMENT
// =====================================================

/**
 * Get or create referral code for a user
 * Format: QOOK-XXXXXX (6 alphanumeric chars)
 */
export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
    try {
        // Check if user already has a code
        const { data: existing, error: fetchError } = await supabase
            .from('referral_codes')
            .select('code')
            .eq('user_id', userId)
            .single();

        if (existing?.code) {
            return existing.code;
        }

        // Generate new code using database function
        const { data: codeData, error: genError } = await supabase
            .rpc('generate_referral_code');

        if (genError || !codeData) {
            console.error('Error generating referral code:', genError);
            return null;
        }

        // Insert new referral code
        const { data: inserted, error: insertError } = await supabase
            .from('referral_codes')
            .insert({
                user_id: userId,
                code: codeData,
                is_active: true
            })
            .select('code')
            .single();

        if (insertError) {
            console.error('Error inserting referral code:', insertError);
            return null;
        }

        return inserted?.code || null;
    } catch (error) {
        console.error('Error in getOrCreateReferralCode:', error);
        return null;
    }
}

/**
 * Validate a referral code and get referrer info
 */
export async function validateReferralCode(code: string): Promise<{
    valid: boolean;
    referrerId?: string;
    error?: string;
}> {
    try {
        const normalizedCode = code.trim().toUpperCase();

        // Check if code matches QOOK-XXXXXX format
        if (!/^QOOK-[A-Z0-9]{6}$/.test(normalizedCode)) {
            return { valid: false, error: 'Invalid code format' };
        }

        const { data, error } = await supabase
            .from('referral_codes')
            .select('user_id, is_active, usage_count, max_uses')
            .eq('code', normalizedCode)
            .single();

        if (error || !data) {
            return { valid: false, error: 'Code not found' };
        }

        if (!data.is_active) {
            return { valid: false, error: 'Code is no longer active' };
        }

        if (data.max_uses && data.usage_count >= data.max_uses) {
            return { valid: false, error: 'Code has reached maximum uses' };
        }

        return { valid: true, referrerId: data.user_id };
    } catch (error) {
        console.error('Error validating referral code:', error);
        return { valid: false, error: 'Validation failed' };
    }
}

/**
 * Apply referral during signup
 * - Links referee to referrer
 * - Awards referee 3 bonus credits immediately
 * - Only works during first-time signup (not after onboarding is complete)
 */
export async function applyReferral(
    refereeId: string,
    referralCode: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const validation = await validateReferralCode(referralCode);
        if (!validation.valid || !validation.referrerId) {
            return { success: false, error: validation.error };
        }

        // Prevent self-referral
        if (validation.referrerId === refereeId) {
            return { success: false, error: 'Cannot use your own referral code' };
        }

        // Check if user was already referred
        const { data: existingReferral } = await supabase
            .from('referrals')
            .select('id')
            .eq('referee_id', refereeId)
            .single();

        if (existingReferral) {
            return { success: false, error: 'Already referred by someone' };
        }

        // ANTI-FRAUD: Check if user has already completed onboarding
        // This prevents users from applying referral codes after initial signup
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('onboarding_completed')
            .eq('user_id', refereeId)
            .single();

        if (userSettings?.onboarding_completed) {
            return { success: false, error: 'Referral codes can only be used during signup' };
        }

        // Get referral code ID
        const { data: codeData } = await supabase
            .from('referral_codes')
            .select('id')
            .eq('code', referralCode.toUpperCase())
            .single();

        // Create referral record
        const { error: referralError } = await supabase
            .from('referrals')
            .insert({
                referrer_id: validation.referrerId,
                referee_id: refereeId,
                referral_code_id: codeData?.id,
                status: 'pending',
                referee_credits_awarded: 3
            });

        if (referralError) {
            console.error('Error creating referral:', referralError);
            return { success: false, error: 'Failed to apply referral' };
        }

        // Update referral code usage count
        await supabase.rpc('increment_referral_usage', { p_code: referralCode.toUpperCase() });

        // Award referee 3 bonus credits (add to their referral_credits)
        const { error: creditError } = await supabase
            .from('user_credits')
            .update({ referral_credits: 3 })
            .eq('user_id', refereeId);

        if (creditError) {
            console.error('Error awarding referee credits:', creditError);
        }

        // Update user_profiles with referral info
        await supabase
            .from('user_profiles')
            .update({
                referred_by: validation.referrerId,
                referral_code_used: referralCode.toUpperCase()
            })
            .eq('id', refereeId);

        return { success: true };
    } catch (error) {
        console.error('Error applying referral:', error);
        return { success: false, error: 'Failed to apply referral' };
    }
}

/**
 * Award referrer credits when referee completes first meal generation
 * Should be called after user's first meal plan generation
 */
export async function awardReferrerCredits(refereeId: string): Promise<boolean> {
    try {
        // Get referral record
        const { data: referral, error: fetchError } = await supabase
            .from('referrals')
            .select('id, referrer_id, status, referrer_credits_awarded')
            .eq('referee_id', refereeId)
            .single();

        if (fetchError || !referral) {
            return false; // No referral found
        }

        // Only award if pending and not yet awarded
        if (referral.status !== 'pending' || referral.referrer_credits_awarded > 0) {
            return false;
        }

        // Check monthly cap (10 referrals per month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: monthlyCount } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', referral.referrer_id)
            .eq('status', 'active')
            .gte('updated_at', startOfMonth.toISOString());

        if ((monthlyCount || 0) >= 10) {
            console.log('Referrer reached monthly cap');
            return false;
        }

        // Award referrer 3 credits
        const { data: referrerCredits } = await supabase
            .from('user_credits')
            .select('referral_credits')
            .eq('user_id', referral.referrer_id)
            .single();

        const currentCredits = referrerCredits?.referral_credits || 0;

        await supabase
            .from('user_credits')
            .update({ referral_credits: currentCredits + 3 })
            .eq('user_id', referral.referrer_id);

        // Update referral record
        await supabase
            .from('referrals')
            .update({
                status: 'active',
                referrer_credits_awarded: 3,
                referee_first_action_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', referral.id);

        return true;
    } catch (error) {
        console.error('Error awarding referrer credits:', error);
        return false;
    }
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userId: string): Promise<{
    referralCode: string | null;
    totalReferrals: number;
    activeReferrals: number;
    pendingReferrals: number;
    creditsEarned: number;
    monthlyReferrals: number;
    monthlyLimit: number;
}> {
    try {
        const code = await getOrCreateReferralCode(userId);

        // Get all referrals
        const { data: referrals } = await supabase
            .from('referrals')
            .select('status, referrer_credits_awarded, updated_at')
            .eq('referrer_id', userId);

        const allReferrals = referrals || [];

        // Count monthly referrals
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyReferrals = allReferrals.filter(r =>
            r.status === 'active' &&
            new Date(r.updated_at) >= startOfMonth
        ).length;

        return {
            referralCode: code,
            totalReferrals: allReferrals.length,
            activeReferrals: allReferrals.filter(r => r.status === 'active').length,
            pendingReferrals: allReferrals.filter(r => r.status === 'pending').length,
            creditsEarned: allReferrals.reduce((sum, r) => sum + (r.referrer_credits_awarded || 0), 0),
            monthlyReferrals,
            monthlyLimit: 10
        };
    } catch (error) {
        console.error('Error getting referral stats:', error);
        return {
            referralCode: null,
            totalReferrals: 0,
            activeReferrals: 0,
            pendingReferrals: 0,
            creditsEarned: 0,
            monthlyReferrals: 0,
            monthlyLimit: 10
        };
    }
}

/**
 * Generate WhatsApp share message with referral link
 */
export function generateWhatsAppShareLink(referralCode: string, userName?: string): string {
    const referralUrl = `https://qook.in?ref=${referralCode}`;
    const message = `Hey! 👋

I've been using *Qook Commander* to plan my weekly meals and it's amazing! 🍽️

The AI creates personalized meal plans based on my taste, and even generates grocery lists automatically. 

Sign up using my link and we BOTH get 3 free credits! 🎁

${referralUrl}

${userName ? `- ${userName}` : ''}`;

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Generate direct referral link URL
 */
export function generateReferralLink(referralCode: string): string {
    return `https://qook.in?ref=${referralCode}`;
}
