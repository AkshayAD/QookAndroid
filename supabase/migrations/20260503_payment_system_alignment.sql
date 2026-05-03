-- Payment System Alignment Migration
-- =====================================================
-- This migration brings version-controlled schema in sync
-- with the live database and applies the CHECK constraint fix.
-- =====================================================

-- =====================================================
-- 1. ADD MISSING COLUMNS TO subscription_plans (IF NOT EXISTS)
-- These already exist in production but were added outside
-- of migrations. This ensures reproducibility.
-- =====================================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_offer_id VARCHAR,
  ADD COLUMN IF NOT EXISTS razorpay_upi_offer_id VARCHAR,
  ADD COLUMN IF NOT EXISTS first_month_price INTEGER,
  ADD COLUMN IF NOT EXISTS regular_price INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_credits INTEGER,
  ADD COLUMN IF NOT EXISTS weekly_bonus_credits INTEGER,
  ADD COLUMN IF NOT EXISTS family_member_limit INTEGER,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- =====================================================
-- 2. ADD billing_preference TO user_subscriptions (IF NOT EXISTS)
-- =====================================================

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_preference TEXT DEFAULT 'credits';

-- =====================================================
-- 3. FIX STATUS CHECK CONSTRAINT
--    Add 'halted' and 'past_due' for Razorpay lifecycle states
-- =====================================================

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN ('active', 'expired', 'cancelled', 'pending', 'deleted', 'halted', 'past_due'));

-- =====================================================
-- 4. CREATE OR REPLACE grant_credits
--    Upserts credits for individual or family credit pool.
-- =====================================================

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id UUID,
  p_credits INTEGER,
  p_credit_type TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_family_group_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID AS $$
BEGIN
  IF p_credits <= 0 THEN
    RETURN;
  END IF;

  -- For family groups, update the pool
  IF p_family_group_id IS NOT NULL THEN
    INSERT INTO public.family_credit_pool (group_id, total_credits, updated_at)
    VALUES (p_family_group_id, p_credits, NOW())
    ON CONFLICT (group_id) DO UPDATE SET
      total_credits = family_credit_pool.total_credits + p_credits,
      updated_at = NOW();
    RETURN;
  END IF;

  -- Insert individual credit record
  INSERT INTO public.user_credits (
    user_id,
    credit_type,
    credits,
    meal_credits,
    grocery_credits,
    edit_credits,
    regen_credits,
    expires_at,
    metadata
  )
  VALUES (
    p_user_id,
    p_credit_type,
    p_credits,
    p_credits,   -- unified: all stored in meal_credits
    0,
    0,
    0,
    p_expires_at,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CREATE OR REPLACE verify_razorpay_payment
--    Handles both subscription activation and credit pack purchases.
--    Idempotent via billing_payment_events dedup.
-- =====================================================

CREATE OR REPLACE FUNCTION public.verify_razorpay_payment(
  p_user_id UUID,
  p_order_id TEXT,
  p_payment_id TEXT,
  p_signature TEXT,
  p_plan_id TEXT,
  p_type TEXT DEFAULT 'subscription',
  p_subscription_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_payment_key TEXT;
    v_plan RECORD;
    v_pack RECORD;
    v_credits INTEGER := 0;
    v_family_group_id UUID;
    v_renews_at TIMESTAMPTZ;
BEGIN
    v_payment_key := 'razorpay:' || COALESCE(p_type, 'subscription') || ':' || COALESCE(p_payment_id, '') || ':' || COALESCE(p_plan_id, '');

    -- Idempotency: skip if already processed
    IF EXISTS (
        SELECT 1
        FROM public.billing_payment_events
        WHERE payment_key = v_payment_key
    ) THEN
        RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE, 'payment_key', v_payment_key);
    END IF;

    IF p_type = 'pack' THEN
        -- =====================================================
        -- CREDIT PACK PURCHASE
        -- =====================================================
        SELECT *
        INTO v_pack
        FROM public.credit_packs
        WHERE id = p_plan_id
          AND is_active = TRUE
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Unknown credit pack: %', p_plan_id;
        END IF;

        v_credits := COALESCE(v_pack.credits, 0);

        PERFORM public.grant_credits(
            p_user_id,
            v_credits,
            'purchased',
            NULL,
            'Razorpay credit pack purchase',
            NULL,
            jsonb_build_object('order_id', p_order_id, 'payment_id', p_payment_id, 'item_id', p_plan_id)
        );
    ELSE
        -- =====================================================
        -- SUBSCRIPTION PAYMENT
        -- =====================================================
        SELECT *
        INTO v_plan
        FROM public.subscription_plans
        WHERE id = p_plan_id
          AND is_active = TRUE
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Unknown subscription plan: %', p_plan_id;
        END IF;

        v_credits := COALESCE(v_plan.monthly_credits, 0);
        v_renews_at := NOW() + INTERVAL '28 days';

        -- Handle family_pro group
        IF p_plan_id = 'family_pro' THEN
            SELECT group_id
            INTO v_family_group_id
            FROM public.family_group_members
            WHERE user_id = p_user_id
              AND COALESCE(is_active, TRUE) = TRUE
            LIMIT 1;
        END IF;

        INSERT INTO public.user_subscriptions (
            user_id,
            plan_id,
            status,
            started_at,
            renews_at,
            cancelled_at,
            trial_ends_at,
            razorpay_subscription_id,
            billing_preference,
            updated_at
        )
        VALUES (
            p_user_id,
            p_plan_id,
            'active',
            NOW(),
            v_renews_at,
            NULL,
            NULL,
            p_subscription_id,
            'credits',
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            plan_id = EXCLUDED.plan_id,
            status = 'active',
            renews_at = EXCLUDED.renews_at,
            trial_ends_at = NULL,
            cancelled_at = NULL,
            razorpay_subscription_id = COALESCE(EXCLUDED.razorpay_subscription_id, public.user_subscriptions.razorpay_subscription_id),
            updated_at = NOW();

        PERFORM public.grant_credits(
            p_user_id,
            v_credits,
            'plan',
            v_renews_at,
            'Razorpay subscription renewal',
            v_family_group_id,
            jsonb_build_object('order_id', p_order_id, 'payment_id', p_payment_id, 'subscription_id', p_subscription_id, 'plan_id', p_plan_id)
        );
    END IF;

    -- Record payment event for idempotency & audit
    INSERT INTO public.billing_payment_events (
        provider,
        payment_key,
        payment_id,
        order_id,
        subscription_id,
        user_id,
        item_type,
        item_id,
        payload
    )
    VALUES (
        'razorpay',
        v_payment_key,
        p_payment_id,
        p_order_id,
        p_subscription_id,
        p_user_id,
        COALESCE(p_type, 'subscription'),
        p_plan_id,
        COALESCE(p_payload, '{}'::JSONB)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'duplicate', FALSE,
        'credits_granted', v_credits,
        'payment_key', v_payment_key,
        'family_group_id', v_family_group_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. CREATE OR REPLACE ensure_free_trial_subscription
-- =====================================================

CREATE OR REPLACE FUNCTION public.ensure_free_trial_subscription(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_trial_credits INTEGER;
  v_trial_days INTEGER;
BEGIN
  -- Skip if user already has a subscription
  IF EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  -- Get trial config from free plan
  SELECT
    COALESCE(trial_credits, unified_credits, 8),
    COALESCE(trial_expiry_days, 28)
  INTO v_trial_credits, v_trial_days
  FROM public.subscription_plans
  WHERE id = 'free';

  IF v_trial_credits IS NULL THEN
    v_trial_credits := 8;
  END IF;
  IF v_trial_days IS NULL THEN
    v_trial_days := 28;
  END IF;

  -- Create free subscription
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, status, trial_ends_at, billing_preference
  )
  VALUES (
    p_user_id, 'free', 'active',
    NOW() + (v_trial_days || ' days')::INTERVAL,
    'credits'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Grant trial credits
  INSERT INTO public.user_credits (
    user_id, credit_type, credits, meal_credits,
    grocery_credits, edit_credits, regen_credits, expires_at
  )
  VALUES (
    p_user_id, 'trial',
    v_trial_credits, v_trial_credits,
    0, 0, 0,
    NOW() + (v_trial_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
