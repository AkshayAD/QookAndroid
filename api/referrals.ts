import {
    ApiError,
    applyCors,
    assertRequestUser,
    getErrorMessage,
    getErrorStatus,
    getSupabaseAdminClient,
    requireAuthenticatedUser,
} from '../lib/serverApi';

const REFERRAL_BONUS_CREDITS = 3;
const REFERRAL_CODE_PATTERN = /^QOOK-[A-Z0-9]{6}$/;

function normalizeReferralCode(code: unknown): string {
    const normalized = String(code || '').trim().toUpperCase();
    if (!REFERRAL_CODE_PATTERN.test(normalized)) {
        throw new ApiError(400, 'Invalid referral code');
    }
    return normalized;
}

async function grantReferralCredits(supabase: any, userId: string, description: string) {
    const { error } = await supabase
        .from('user_credits')
        .insert({
            user_id: userId,
            credit_type: 'bonus',
            credits: REFERRAL_BONUS_CREDITS,
            meal_credits: REFERRAL_BONUS_CREDITS,
            grocery_credits: 0,
            edit_credits: 0,
            regen_credits: 0,
            referral_credits: REFERRAL_BONUS_CREDITS,
            expires_at: null,
            metadata: { description },
        });

    if (error) {
        throw error;
    }
}

async function validateReferral(supabase: any, requesterId: string, referralCode: string) {
    const { data, error } = await supabase
        .from('referral_codes')
        .select('user_id, is_active, usage_count, max_uses')
        .eq('code', referralCode)
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

    if (data.user_id === requesterId) {
        return { valid: false, error: 'Cannot use your own referral code' };
    }

    return { valid: true, referrerId: data.user_id };
}

async function applyReferral(supabase: any, refereeId: string, referralCode: string) {
    const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('id, user_id, is_active, usage_count, max_uses')
        .eq('code', referralCode)
        .single();

    if (codeError || !codeData) {
        throw new ApiError(404, 'Code not found');
    }

    if (!codeData.is_active) {
        throw new ApiError(400, 'Code is no longer active');
    }

    if (codeData.max_uses && codeData.usage_count >= codeData.max_uses) {
        throw new ApiError(400, 'Code has reached maximum uses');
    }

    if (codeData.user_id === refereeId) {
        throw new ApiError(400, 'Cannot use your own referral code');
    }

    const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id')
        .eq('referee_id', refereeId)
        .maybeSingle();

    if (existingReferral) {
        throw new ApiError(409, 'Already referred by someone');
    }

    const { data: userSettings } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', refereeId)
        .maybeSingle();

    if (userSettings?.onboarding_completed) {
        throw new ApiError(400, 'Referral codes can only be used during signup');
    }

    const { error: referralError } = await supabase
        .from('referrals')
        .insert({
            referrer_id: codeData.user_id,
            referee_id: refereeId,
            referral_code_id: codeData.id,
            status: 'pending',
            referee_credits_awarded: REFERRAL_BONUS_CREDITS,
        });

    if (referralError) {
        throw referralError;
    }

    const { error: usageError } = await supabase.rpc('increment_referral_usage', { p_code: referralCode });
    if (usageError) {
        throw usageError;
    }

    await grantReferralCredits(supabase, refereeId, `Referral signup bonus for ${referralCode}`);

    await supabase
        .from('user_profiles')
        .update({
            referred_by: codeData.user_id,
            referral_code_used: referralCode,
        })
        .eq('id', refereeId);

    return { success: true };
}

async function awardReferrerCredits(supabase: any, refereeId: string) {
    const { data: referral, error: fetchError } = await supabase
        .from('referrals')
        .select('id, referrer_id, status, referrer_credits_awarded')
        .eq('referee_id', refereeId)
        .single();

    if (fetchError || !referral) {
        return { awarded: false };
    }

    if (referral.status !== 'pending' || Number(referral.referrer_credits_awarded || 0) > 0) {
        return { awarded: false };
    }

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
        return { awarded: false, capped: true };
    }

    const updatedAt = new Date().toISOString();
    const { data: updatedRows, error: updateError } = await supabase
        .from('referrals')
        .update({
            status: 'active',
            referrer_credits_awarded: REFERRAL_BONUS_CREDITS,
            referee_first_action_at: updatedAt,
            updated_at: updatedAt,
        })
        .eq('id', referral.id)
        .eq('status', 'pending')
        .select('id');

    if (updateError) {
        throw updateError;
    }

    if (!updatedRows?.length) {
        return { awarded: false };
    }

    await grantReferralCredits(supabase, referral.referrer_id, `Referral reward for ${refereeId}`);

    return { awarded: true };
}

export default async function handler(req: any, res: any) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authUserId = await requireAuthenticatedUser(req.headers.authorization);
        const userId = assertRequestUser(authUserId, req.body?.user_id || req.body?.userId);
        const action = req.body?.action;
        const supabase = getSupabaseAdminClient();

        switch (action) {
            case 'validate_referral':
                return res.status(200).json(
                    await validateReferral(supabase, userId, normalizeReferralCode(req.body?.referral_code || req.body?.referralCode))
                );

            case 'apply_referral':
                return res.status(200).json(
                    await applyReferral(supabase, userId, normalizeReferralCode(req.body?.referral_code || req.body?.referralCode))
                );

            case 'award_referrer_credits':
                return res.status(200).json(await awardReferrerCredits(supabase, userId));

            default:
                return res.status(400).json({ error: 'Unknown referral action' });
        }
    } catch (error) {
        console.error('Referral API error:', error);
        return res.status(getErrorStatus(error)).json({
            success: false,
            error: getErrorMessage(error, 'Referral request failed'),
        });
    }
}
