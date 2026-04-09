-- Align personal credit accounting with the live app's meal-credit model.

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS credits INTEGER;

UPDATE public.user_credits
SET
  credits = COALESCE(meal_credits, 0),
  updated_at = NOW()
WHERE COALESCE(credits, 0) IS DISTINCT FROM COALESCE(meal_credits, 0);

CREATE OR REPLACE FUNCTION public.get_credit_summary(
  p_user_id UUID,
  p_family_group_id UUID DEFAULT NULL
)
RETURNS TABLE(
  total_credits INTEGER,
  subscription_credits INTEGER,
  purchased_credits INTEGER,
  bonus_credits INTEGER,
  trial_credits INTEGER,
  referral_credits INTEGER,
  plan_tier TEXT,
  effective_tier TEXT,
  billing_preference TEXT,
  byok_enabled BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  weekly_bonus_credits INTEGER,
  next_weekly_bonus_at TIMESTAMPTZ,
  weekly_bonus_claimable BOOLEAN,
  weekly_bonus_window_start TIMESTAMPTZ,
  weekly_bonus_window_end TIMESTAMPTZ,
  weekly_bonus_claimed_for_window BOOLEAN,
  family_mode BOOLEAN,
  family_group_id UUID
) AS $$
DECLARE
    v_plan_id TEXT := 'free';
    v_billing_preference TEXT := 'credits';
    v_trial_ends_at TIMESTAMPTZ;
    v_effective_tier TEXT := 'free';
    v_weekly_bonus_credits INTEGER := 0;
    v_byok_enabled BOOLEAN := FALSE;
    v_next_weekly_bonus_at TIMESTAMPTZ;
    v_weekly_bonus_claimable BOOLEAN := FALSE;
    v_weekly_bonus_window_start TIMESTAMPTZ;
    v_weekly_bonus_window_end TIMESTAMPTZ;
    v_weekly_bonus_claimed_for_window BOOLEAN := FALSE;
    v_family_mode BOOLEAN := FALSE;
    v_started_at TIMESTAMPTZ;
    v_local_now TIMESTAMP;
    v_current_week_start DATE;
    v_current_week_start_at TIMESTAMPTZ;
    v_current_week_end_at TIMESTAMPTZ;
    v_joined_local_date DATE;
    v_signup_week_start DATE;
    v_active_family_group_id UUID;
BEGIN
    SELECT
        COALESCE(us.plan_id, 'free'),
        COALESCE(us.billing_preference, 'credits'),
        us.trial_ends_at,
        COALESCE(us.started_at, au.created_at, NOW())
    INTO
        v_plan_id,
        v_billing_preference,
        v_trial_ends_at,
        v_started_at
    FROM auth.users au
    LEFT JOIN public.user_subscriptions us
        ON us.user_id = au.id
    WHERE au.id = p_user_id
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        v_plan_id := 'free';
    END IF;

    IF v_billing_preference IS NULL THEN
        v_billing_preference := 'credits';
    END IF;

    IF v_started_at IS NULL THEN
        v_started_at := NOW();
    END IF;

    v_effective_tier := public.get_effective_tier(p_user_id);

    SELECT
        COALESCE(sp.weekly_bonus_credits, 0),
        COALESCE(sp.byok_enabled, FALSE)
    INTO
        v_weekly_bonus_credits,
        v_byok_enabled
    FROM public.subscription_plans sp
    WHERE sp.id = v_plan_id
    LIMIT 1;

    v_weekly_bonus_credits := COALESCE(v_weekly_bonus_credits, 0);
    v_byok_enabled := COALESCE(v_byok_enabled, FALSE);

    v_active_family_group_id := public.resolve_active_family_billing_group(p_user_id, p_family_group_id);
    v_family_mode := v_active_family_group_id IS NOT NULL;

    IF v_family_mode THEN
        v_plan_id := 'family_pro';
        v_effective_tier := 'family_pro';

        SELECT
            COALESCE(sp.weekly_bonus_credits, 0),
            COALESCE(sp.byok_enabled, FALSE)
        INTO
            v_weekly_bonus_credits,
            v_byok_enabled
        FROM public.subscription_plans sp
        WHERE sp.id = 'family_pro'
        LIMIT 1;
    END IF;

    v_local_now := timezone('Asia/Kolkata', NOW());
    v_current_week_start := v_local_now::DATE - EXTRACT(DOW FROM v_local_now::DATE)::INTEGER;
    v_current_week_start_at := (v_current_week_start + TIME '00:00') AT TIME ZONE 'Asia/Kolkata';
    v_current_week_end_at := ((v_current_week_start + 7) + TIME '00:00') AT TIME ZONE 'Asia/Kolkata';
    v_next_weekly_bonus_at := v_current_week_end_at;

    IF COALESCE(v_weekly_bonus_credits, 0) > 0 THEN
        v_weekly_bonus_window_start := v_current_week_start_at;
        v_weekly_bonus_window_end := v_current_week_end_at;

        IF v_plan_id = 'free' THEN
            v_joined_local_date := timezone('Asia/Kolkata', v_started_at)::DATE;
            v_signup_week_start := v_joined_local_date - EXTRACT(DOW FROM v_joined_local_date)::INTEGER;

            IF v_current_week_start <= v_signup_week_start THEN
                v_weekly_bonus_window_start := ((v_signup_week_start + 7) + TIME '00:00') AT TIME ZONE 'Asia/Kolkata';
                v_weekly_bonus_window_end := ((v_signup_week_start + 14) + TIME '00:00') AT TIME ZONE 'Asia/Kolkata';
                v_next_weekly_bonus_at := v_weekly_bonus_window_start;
                v_weekly_bonus_claimed_for_window := FALSE;
                v_weekly_bonus_claimable := FALSE;
            ELSE
                SELECT EXISTS (
                    SELECT 1
                    FROM public.weekly_bonus_log
                    WHERE user_id = p_user_id
                      AND week_start = v_current_week_start
                )
                INTO v_weekly_bonus_claimed_for_window;

                v_weekly_bonus_claimable := NOT v_weekly_bonus_claimed_for_window;
            END IF;
        ELSE
            SELECT EXISTS (
                SELECT 1
                FROM public.weekly_bonus_log
                WHERE user_id = p_user_id
                  AND week_start = v_current_week_start
            )
            INTO v_weekly_bonus_claimed_for_window;

            v_weekly_bonus_claimable := NOT v_weekly_bonus_claimed_for_window;
        END IF;
    ELSE
        v_next_weekly_bonus_at := NULL;
        v_weekly_bonus_window_start := NULL;
        v_weekly_bonus_window_end := NULL;
        v_weekly_bonus_claimed_for_window := FALSE;
        v_weekly_bonus_claimable := FALSE;
    END IF;

    RETURN QUERY
    SELECT
        CASE
            WHEN v_family_mode THEN COALESCE(MAX(fcp.total_credits), 0)
            ELSE COALESCE(SUM(uc.meal_credits), 0)::INTEGER
        END AS total_credits,
        CASE
            WHEN v_family_mode THEN 0
            ELSE COALESCE(SUM(uc.meal_credits) FILTER (WHERE uc.credit_type = 'plan'), 0)::INTEGER
        END AS subscription_credits,
        CASE
            WHEN v_family_mode THEN 0
            ELSE COALESCE(SUM(uc.meal_credits) FILTER (WHERE uc.credit_type IN ('purchased', 'pack')), 0)::INTEGER
        END AS purchased_credits,
        CASE
            WHEN v_family_mode THEN 0
            ELSE COALESCE(SUM(uc.meal_credits) FILTER (WHERE uc.credit_type = 'bonus'), 0)::INTEGER
        END AS bonus_credits,
        CASE
            WHEN v_family_mode THEN 0
            ELSE COALESCE(SUM(uc.meal_credits) FILTER (WHERE uc.credit_type = 'trial'), 0)::INTEGER
        END AS trial_credits,
        CASE
            WHEN v_family_mode THEN 0
            ELSE COALESCE(SUM(uc.referral_credits), 0)::INTEGER
        END AS referral_credits,
        v_plan_id,
        v_effective_tier,
        v_billing_preference,
        v_byok_enabled,
        v_trial_ends_at,
        v_weekly_bonus_credits,
        v_next_weekly_bonus_at,
        v_weekly_bonus_claimable,
        v_weekly_bonus_window_start,
        v_weekly_bonus_window_end,
        v_weekly_bonus_claimed_for_window,
        v_family_mode,
        CASE WHEN v_family_mode THEN v_active_family_group_id ELSE NULL END
    FROM (SELECT 1) base
    LEFT JOIN public.family_credit_pool fcp
        ON fcp.group_id = v_active_family_group_id
    LEFT JOIN public.user_credits uc
        ON uc.user_id = p_user_id
       AND uc.deleted_at IS NULL
       AND (uc.expires_at IS NULL OR uc.expires_at > NOW());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
