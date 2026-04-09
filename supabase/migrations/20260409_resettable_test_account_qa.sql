-- Resettable QA account support for repeatable onboarding tests.

ALTER TABLE public.test_accounts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reset_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_accounts_reset_mode_check'
      AND conrelid = 'public.test_accounts'::regclass
  ) THEN
    ALTER TABLE public.test_accounts
      ADD CONSTRAINT test_accounts_reset_mode_check
      CHECK (reset_mode IN ('manual'));
  END IF;
END
$$;

INSERT INTO public.test_accounts (email, tier, description, reset_mode, is_active, updated_at)
VALUES (
  'ardhsayar@gmail.com',
  'free',
  'Reusable Google OAuth onboarding QA account',
  'manual',
  TRUE,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  tier = EXCLUDED.tier,
  description = EXCLUDED.description,
  reset_mode = EXCLUDED.reset_mode,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.test_account_reset_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email TEXT NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  reset_reason TEXT NOT NULL DEFAULT 'Manual admin reset',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_account_reset_log_target_email
  ON public.test_account_reset_log (target_email, created_at DESC);

ALTER TABLE public.test_account_reset_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_account_reset_log'
      AND policyname = 'Admins can view test account reset log'
  ) THEN
    CREATE POLICY "Admins can view test account reset log"
      ON public.test_account_reset_log
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.admin_users
          WHERE lower(email) = lower(auth.jwt() ->> 'email')
        )
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_test_account(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email TEXT := lower(trim(coalesce(p_email, '')));
  v_request_role TEXT := coalesce(current_setting('role', true), '');
  v_admin_user_id UUID := auth.uid();
  v_admin_email TEXT := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_target_user_id UUID;
  v_target_email TEXT;
  v_reset_at TIMESTAMPTZ := NOW();
  v_snapshot JSONB := '{}'::jsonb;
  v_deleted_counts JSONB := '{}'::jsonb;
  v_deleted_count INTEGER := 0;
BEGIN
  IF v_normalized_email = '' THEN
    RAISE EXCEPTION 'Test account email is required';
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF v_admin_email = '' OR NOT EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE lower(email) = v_admin_email
    ) THEN
      RAISE EXCEPTION 'Admin privileges required';
    END IF;
  END IF;

  SELECT lower(email)
  INTO v_target_email
  FROM public.test_accounts
  WHERE lower(email) = v_normalized_email
    AND is_active = TRUE
  LIMIT 1;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Active resettable test account not found for %', v_normalized_email;
  END IF;

  SELECT id, lower(email)
  INTO v_target_user_id, v_target_email
  FROM auth.users
  WHERE lower(email) = v_target_email
  LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user not found for %', v_normalized_email;
  END IF;

  v_snapshot := jsonb_build_object(
    'onboarding_completed', coalesce((
      SELECT onboarding_completed
      FROM public.user_settings
      WHERE user_id = v_target_user_id
      LIMIT 1
    ), FALSE),
    'user_settings', (SELECT count(*)::INTEGER FROM public.user_settings WHERE user_id = v_target_user_id),
    'user_profiles', (SELECT count(*)::INTEGER FROM public.user_profiles WHERE id = v_target_user_id),
    'preference_profiles', (SELECT count(*)::INTEGER FROM public.preference_profiles WHERE user_id = v_target_user_id),
    'weekly_plans', (SELECT count(*)::INTEGER FROM public.weekly_plans WHERE user_id = v_target_user_id),
    'scheduled_meals', (SELECT count(*)::INTEGER FROM public.scheduled_meals WHERE user_id = v_target_user_id),
    'grocery_lists', (SELECT count(*)::INTEGER FROM public.grocery_lists WHERE user_id = v_target_user_id),
    'meal_history', (SELECT count(*)::INTEGER FROM public.meal_history WHERE user_id = v_target_user_id),
    'inventory_items', (SELECT count(*)::INTEGER FROM public.inventory_items WHERE user_id = v_target_user_id),
    'preference_signals', (SELECT count(*)::INTEGER FROM public.preference_signals WHERE user_id = v_target_user_id),
    'menu_generation_events', (SELECT count(*)::INTEGER FROM public.menu_generation_events WHERE user_id = v_target_user_id),
    'user_trust_actions', (SELECT count(*)::INTEGER FROM public.user_trust_actions WHERE user_id = v_target_user_id),
    'usage_tracking', (SELECT count(*)::INTEGER FROM public.usage_tracking WHERE user_id = v_target_user_id),
    'rate_limit_tracking', (SELECT count(*)::INTEGER FROM public.rate_limit_tracking WHERE user_id = v_target_user_id),
    'weekly_bonus_log', (SELECT count(*)::INTEGER FROM public.weekly_bonus_log WHERE user_id = v_target_user_id),
    'credit_purchases', (SELECT count(*)::INTEGER FROM public.credit_purchases WHERE user_id = v_target_user_id),
    'referrals', (SELECT count(*)::INTEGER FROM public.referrals WHERE referee_id = v_target_user_id OR referrer_id = v_target_user_id),
    'referral_codes', (SELECT count(*)::INTEGER FROM public.referral_codes WHERE user_id = v_target_user_id),
    'user_credits', (SELECT count(*)::INTEGER FROM public.user_credits WHERE user_id = v_target_user_id),
    'user_subscriptions', (SELECT count(*)::INTEGER FROM public.user_subscriptions WHERE user_id = v_target_user_id),
    'family_groups_owned', (SELECT count(*)::INTEGER FROM public.family_groups WHERE owner_id = v_target_user_id),
    'family_group_memberships', (SELECT count(*)::INTEGER FROM public.family_group_members WHERE user_id = v_target_user_id)
  );

  INSERT INTO public.test_account_reset_log (
    target_user_id,
    target_email,
    admin_user_id,
    admin_email,
    reset_reason,
    snapshot,
    created_at
  )
  VALUES (
    v_target_user_id,
    v_target_email,
    v_admin_user_id,
    coalesce(nullif(v_admin_email, ''), 'service_role'),
    'Manual admin reset',
    v_snapshot,
    v_reset_at
  );

  DELETE FROM public.referrals
  WHERE referee_id = v_target_user_id
     OR referrer_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('referrals', v_deleted_count);

  DELETE FROM public.referral_codes
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('referral_codes', v_deleted_count);

  DELETE FROM public.menu_generation_events
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('menu_generation_events', v_deleted_count);

  DELETE FROM public.preference_signals
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('preference_signals', v_deleted_count);

  DELETE FROM public.inventory_items
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('inventory_items', v_deleted_count);

  DELETE FROM public.meal_history
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('meal_history', v_deleted_count);

  DELETE FROM public.rate_limit_tracking
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('rate_limit_tracking', v_deleted_count);

  DELETE FROM public.usage_tracking
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('usage_tracking', v_deleted_count);

  DELETE FROM public.weekly_bonus_log
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('weekly_bonus_log', v_deleted_count);

  DELETE FROM public.credit_purchases
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('credit_purchases', v_deleted_count);

  DELETE FROM public.user_trust_actions
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_trust_actions', v_deleted_count);

  DELETE FROM public.grocery_lists
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('grocery_lists', v_deleted_count);

  DELETE FROM public.scheduled_meals
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('scheduled_meals', v_deleted_count);

  DELETE FROM public.weekly_plans
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('weekly_plans', v_deleted_count);

  DELETE FROM public.preference_profiles
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('preference_profiles', v_deleted_count);

  DELETE FROM public.user_settings
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_settings', v_deleted_count);

  DELETE FROM public.user_profiles
  WHERE id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_profiles', v_deleted_count);

  DELETE FROM public.user_credits
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_credits', v_deleted_count);

  DELETE FROM public.user_subscriptions
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_subscriptions', v_deleted_count);

  DELETE FROM public.family_groups
  WHERE owner_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('family_groups_owned', v_deleted_count);

  DELETE FROM public.family_group_members
  WHERE user_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('family_group_memberships', v_deleted_count);

  UPDATE public.test_accounts
  SET updated_at = v_reset_at
  WHERE lower(email) = v_target_email;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'target_email', v_target_email,
    'reset_at', v_reset_at,
    'counts', v_deleted_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_test_account(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_test_account(TEXT) TO service_role;
