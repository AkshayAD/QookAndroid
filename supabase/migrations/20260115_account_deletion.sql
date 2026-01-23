-- Account Deletion Migration
-- Implements soft-delete with data archival for user accounts

-- =====================================================
-- 1. CREATE DELETED USERS ARCHIVE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.deleted_users (
  id UUID PRIMARY KEY,
  email TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  deletion_reason TEXT,
  -- Store summary of user data at time of deletion
  data_snapshot JSONB,
  -- Original auth metadata
  auth_metadata JSONB
);

-- Enable RLS on deleted_users (admin only)
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view deleted users
CREATE POLICY "Admins can view deleted users"
  ON public.deleted_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- =====================================================
-- 2. ADD DELETED_AT COLUMNS TO USER TABLES
-- =====================================================

-- Add deleted_at to user_subscriptions
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to preference_profiles
ALTER TABLE public.preference_profiles 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to meal_plans
ALTER TABLE public.meal_plans 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to user_credits
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- =====================================================
-- 3. CREATE SOFT DELETE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.soft_delete_user(
  p_user_id UUID, 
  p_reason TEXT DEFAULT 'User requested deletion'
)
RETURNS JSONB AS $$
DECLARE
  v_email TEXT;
  v_result JSONB;
BEGIN
  -- Get user email from auth
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Archive user info with data snapshot
  INSERT INTO public.deleted_users (id, email, deleted_at, deletion_reason, data_snapshot, auth_metadata)
  SELECT 
    p_user_id,
    v_email,
    NOW(),
    p_reason,
    jsonb_build_object(
      'subscription', (SELECT row_to_json(s) FROM user_subscriptions s WHERE s.user_id = p_user_id AND s.deleted_at IS NULL),
      'credits_summary', (
        SELECT jsonb_build_object(
          'total_meal', COALESCE(SUM(meal_credits), 0),
          'total_grocery', COALESCE(SUM(grocery_credits), 0),
          'total_edit', COALESCE(SUM(edit_credits), 0),
          'total_regen', COALESCE(SUM(regen_credits), 0)
        )
        FROM user_credits WHERE user_id = p_user_id AND deleted_at IS NULL
      ),
      'meal_plans_count', (SELECT COUNT(*) FROM meal_plans WHERE user_id = p_user_id AND deleted_at IS NULL),
      'profiles', (SELECT json_agg(row_to_json(p)) FROM preference_profiles p WHERE p.user_id = p_user_id AND p.deleted_at IS NULL),
      'deleted_at', NOW()
    ),
    (SELECT raw_user_meta_data FROM auth.users WHERE id = p_user_id)
  ON CONFLICT (id) DO UPDATE SET
    deleted_at = NOW(),
    deletion_reason = p_reason;

  -- Soft-delete subscription
  UPDATE public.user_subscriptions 
  SET deleted_at = NOW(), status = 'deleted'
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Soft-delete profiles
  UPDATE public.preference_profiles 
  SET deleted_at = NOW()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Soft-delete meal plans
  UPDATE public.meal_plans 
  SET deleted_at = NOW()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Soft-delete credits
  UPDATE public.user_credits 
  SET deleted_at = NOW()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Log in admin audit
  INSERT INTO public.admin_audit_log (admin_user_id, action_type, target_user_id, details)
  VALUES (p_user_id, 'account_deleted', p_user_id, jsonb_build_object('reason', p_reason, 'self_delete', true));

  RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. UPDATE RLS POLICIES TO EXCLUDE DELETED DATA
-- =====================================================

-- Drop existing policies if they exist and recreate with deleted_at filter
-- (These are safe to run - they'll update the behavior to exclude deleted records)

-- Update user_subscriptions policy
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Update preference_profiles policy  
DROP POLICY IF EXISTS "Users can view own profiles" ON public.preference_profiles;
CREATE POLICY "Users can view own profiles"
  ON public.preference_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can manage own profiles" ON public.preference_profiles;
CREATE POLICY "Users can manage own profiles"
  ON public.preference_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Update meal_plans policy
DROP POLICY IF EXISTS "Users can view own meal plans" ON public.meal_plans;
CREATE POLICY "Users can view own meal plans"
  ON public.meal_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can manage own meal plans" ON public.meal_plans;
CREATE POLICY "Users can manage own meal plans"
  ON public.meal_plans FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Update user_credits policy
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits"
  ON public.user_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- =====================================================
-- 5. CREATE INDEX FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_deleted 
  ON public.user_subscriptions(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preference_profiles_deleted 
  ON public.preference_profiles(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meal_plans_deleted 
  ON public.meal_plans(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_credits_deleted 
  ON public.user_credits(user_id) WHERE deleted_at IS NULL;
