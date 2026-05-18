-- Payment hardening: trusted intents, webhook idempotency, RLS lockdown,
-- and transactional credit consumption.

-- =====================================================
-- 1. Billing support tables
-- =====================================================

CREATE TABLE IF NOT EXISTS public.billing_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  payment_key TEXT NOT NULL,
  payment_id TEXT,
  order_id TEXT,
  subscription_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, payment_key)
);

CREATE TABLE IF NOT EXISTS public.billing_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('pack', 'subscription')),
  item_id TEXT NOT NULL,
  amount_inr INTEGER NOT NULL CHECK (amount_inr >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'refunded')),
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_subscription_id TEXT,
  provider_plan_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_key)
);

ALTER TABLE public.billing_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_billing_payment_intents_user_status
  ON public.billing_payment_intents (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_payment_intents_order
  ON public.billing_payment_intents (provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payment_intents_subscription
  ON public.billing_payment_intents (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payment_events_user
  ON public.billing_payment_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_status
  ON public.billing_webhook_events (status, updated_at DESC);

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.billing_webhook_events
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.credit_purchases
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_purchases_razorpay_order_unique
  ON public.credit_purchases (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_purchases_razorpay_payment_unique
  ON public.credit_purchases (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- Idempotent non-negative credit constraints.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_credits_non_negative_check'
      AND conrelid = 'public.user_credits'::regclass
  ) THEN
    ALTER TABLE public.user_credits
      ADD CONSTRAINT user_credits_non_negative_check
      CHECK (
        COALESCE(credits, 0) >= 0
        AND COALESCE(meal_credits, 0) >= 0
        AND COALESCE(grocery_credits, 0) >= 0
        AND COALESCE(edit_credits, 0) >= 0
        AND COALESCE(regen_credits, 0) >= 0
      );
  END IF;
END $$;

-- =====================================================
-- 2. RLS policies: users may read billing state, not mutate it
-- =====================================================

DROP POLICY IF EXISTS "Users manage own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users manage own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users manage own purchases" ON public.credit_purchases;
DROP POLICY IF EXISTS "Users view own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users manage own bonus log" ON public.weekly_bonus_log;
DROP POLICY IF EXISTS "Users manage own rate limits" ON public.rate_limit_tracking;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits"
  ON public.user_credits FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own purchases" ON public.credit_purchases;
CREATE POLICY "Users can view own purchases"
  ON public.credit_purchases FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_tracking;
CREATE POLICY "Users can view own usage"
  ON public.usage_tracking FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own billing intents" ON public.billing_payment_intents;
CREATE POLICY "Users can view own billing intents"
  ON public.billing_payment_intents FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own billing events" ON public.billing_payment_events;
CREATE POLICY "Users can view own billing events"
  ON public.billing_payment_events FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- No client policies are created for billing_webhook_events.

-- =====================================================
-- 3. Function privileges
-- =====================================================

REVOKE ALL ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TIMESTAMPTZ, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_razorpay_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TIMESTAMPTZ, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_razorpay_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- =====================================================
-- 4. Harden grant and verify functions
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
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_credits <= 0 THEN
    RETURN;
  END IF;

  IF p_credit_type NOT IN ('plan', 'purchased', 'bonus', 'trial') THEN
    RAISE EXCEPTION 'Invalid credit type: %', p_credit_type;
  END IF;

  IF p_family_group_id IS NOT NULL THEN
    INSERT INTO public.family_credit_pool (group_id, total_credits, updated_at)
    VALUES (p_family_group_id, p_credits, NOW())
    ON CONFLICT (group_id) DO UPDATE SET
      total_credits = public.family_credit_pool.total_credits + p_credits,
      updated_at = NOW();
    RETURN;
  END IF;

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
    p_credits,
    0,
    0,
    0,
    p_expires_at,
    COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object('description', p_description)
  );
END;
$$;

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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_key TEXT;
  v_plan RECORD;
  v_pack RECORD;
  v_credits INTEGER := 0;
  v_family_group_id UUID;
  v_renews_at TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL OR COALESCE(p_payment_id, '') = '' OR COALESCE(p_plan_id, '') = '' THEN
    RAISE EXCEPTION 'Missing payment verification fields';
  END IF;

  v_payment_key := 'razorpay:' || COALESCE(p_type, 'subscription') || ':' || COALESCE(p_payment_id, '') || ':' || COALESCE(p_plan_id, '');

  IF EXISTS (
    SELECT 1 FROM public.billing_payment_events
    WHERE provider = 'razorpay' AND payment_key = v_payment_key
  ) THEN
    RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE, 'payment_key', v_payment_key);
  END IF;

  IF p_type = 'pack' THEN
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
      CASE
        WHEN COALESCE(v_pack.validity_days, 0) > 0 THEN NOW() + (v_pack.validity_days || ' days')::INTERVAL
        ELSE NULL
      END,
      'Razorpay credit pack purchase',
      NULL,
      jsonb_build_object('order_id', p_order_id, 'payment_id', p_payment_id, 'item_id', p_plan_id)
    );

    UPDATE public.credit_purchases
    SET status = 'completed',
        razorpay_payment_id = p_payment_id,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND razorpay_order_id = p_order_id
      AND status <> 'completed';
  ELSE
    SELECT *
    INTO v_plan
    FROM public.subscription_plans
    WHERE id = p_plan_id
      AND is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown subscription plan: %', p_plan_id;
    END IF;

    v_credits := COALESCE(v_plan.monthly_credits, v_plan.unified_credits, 0);
    v_renews_at := NOW() + INTERVAL '28 days';

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
      cancel_at_period_end,
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
      FALSE,
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
      cancel_at_period_end = FALSE,
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
$$;

-- =====================================================
-- 5. Transactional credit consumption
-- =====================================================

DROP FUNCTION IF EXISTS public.consume_credits(UUID, TEXT, DECIMAL);

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_action_type TEXT,
  p_credits_needed DECIMAL DEFAULT 1,
  p_family_group_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_record RECORD;
  v_remaining INTEGER;
  v_to_deduct INTEGER;
  v_credit_column TEXT;
  v_family_balance INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_credits_needed <= 0 THEN
    RETURN FALSE;
  END IF;

  v_credit_column := CASE p_action_type
    WHEN 'meal_generation' THEN 'meal_credits'
    WHEN 'grocery_generation' THEN 'grocery_credits'
    WHEN 'smart_edit' THEN 'edit_credits'
    WHEN 'single_regen' THEN 'regen_credits'
    ELSE 'meal_credits'
  END;

  v_remaining := CEIL(p_credits_needed)::INTEGER;

  IF p_family_group_id IS NOT NULL THEN
    UPDATE public.family_credit_pool
    SET total_credits = total_credits - v_remaining,
        updated_at = NOW()
    WHERE group_id = p_family_group_id
      AND total_credits >= v_remaining
    RETURNING total_credits INTO v_family_balance;

    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;

    INSERT INTO public.usage_tracking (user_id, action_type, credits_used, api_source)
    VALUES (p_user_id, p_action_type, p_credits_needed, 'platform');
    RETURN TRUE;
  END IF;

  FOR v_credit_record IN
    SELECT id, credit_type,
      CASE v_credit_column
        WHEN 'meal_credits' THEN meal_credits
        WHEN 'grocery_credits' THEN grocery_credits
        WHEN 'edit_credits' THEN edit_credits
        WHEN 'regen_credits' THEN regen_credits
      END AS available_credits
    FROM public.user_credits
    WHERE user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > NOW())
      AND CASE v_credit_column
        WHEN 'meal_credits' THEN meal_credits
        WHEN 'grocery_credits' THEN grocery_credits
        WHEN 'edit_credits' THEN edit_credits
        WHEN 'regen_credits' THEN regen_credits
      END > 0
    ORDER BY
      CASE credit_type
        WHEN 'bonus' THEN 1
        WHEN 'trial' THEN 2
        WHEN 'plan' THEN 3
        WHEN 'purchased' THEN 4
        ELSE 5
      END,
      created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_deduct := LEAST(v_credit_record.available_credits, v_remaining);

    EXECUTE format(
      'UPDATE public.user_credits SET %I = %I - $1, credits = GREATEST(COALESCE(credits, 0) - $1, 0), updated_at = NOW() WHERE id = $2',
      v_credit_column,
      v_credit_column
    )
    USING v_to_deduct, v_credit_record.id;

    v_remaining := v_remaining - v_to_deduct;
  END LOOP;

  IF v_remaining > 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.usage_tracking (user_id, action_type, credits_used, api_source)
  VALUES (p_user_id, p_action_type, p_credits_needed, 'platform');

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(UUID, TEXT, DECIMAL, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, TEXT, DECIMAL, UUID) TO service_role;

-- Client-authenticated users may create their own free trial only through this RPC.
CREATE OR REPLACE FUNCTION public.ensure_free_trial_subscription(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_credits INTEGER;
  v_trial_days INTEGER;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Authentication required for requested user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(trial_credits, unified_credits, monthly_credits, 8),
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

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, status, trial_ends_at, billing_preference
  )
  VALUES (
    p_user_id, 'free', 'active',
    NOW() + (v_trial_days || ' days')::INTERVAL,
    'credits'
  )
  ON CONFLICT (user_id) DO NOTHING;

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
$$;

REVOKE ALL ON FUNCTION public.ensure_free_trial_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_free_trial_subscription(UUID) TO authenticated;
