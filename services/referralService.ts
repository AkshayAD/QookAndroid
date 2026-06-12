import { supabase } from '../lib/supabase';
import { getAuthenticatedJsonHeaders } from '../utils/authHeaders';
import { getApiBaseUrl } from '../utils/platform';

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
            .maybeSingle();

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

        const response = await fetch(`${getApiBaseUrl()}/api/referrals`, {
            method: 'POST',
            headers: await getAuthenticatedJsonHeaders(),
            body: JSON.stringify({
                action: 'validate_referral',
                referral_code: normalizedCode,
            }),
        });
        const data = await response.json();

        if (!response.ok || !data.valid) {
            return { valid: false, error: data.error || 'Validation failed' };
        }

        return { valid: true, referrerId: data.referrerId };
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
        const response = await fetch(`${getApiBaseUrl()}/api/referrals`, {
            method: 'POST',
            headers: await getAuthenticatedJsonHeaders(),
            body: JSON.stringify({
                action: 'apply_referral',
                user_id: refereeId,
                referral_code: referralCode,
            }),
        });
        const data = await response.json();
        return response.ok ? { success: true } : { success: false, error: data.error || 'Failed to apply referral' };
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
        const response = await fetch(`${getApiBaseUrl()}/api/referrals`, {
            method: 'POST',
            headers: await getAuthenticatedJsonHeaders(),
            body: JSON.stringify({
                action: 'award_referrer_credits',
                user_id: refereeId,
            }),
        });
        const data = await response.json();
        return response.ok && data.awarded === true;
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
