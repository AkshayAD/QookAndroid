-- Admin Notifications Migration
-- Adds push notification capability and fixes dim_users email visibility

-- =====================================================
-- 1. ADD EMAIL TO DIM_USERS
-- =====================================================

ALTER TABLE public.dim_users ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email from auth.users for existing records
UPDATE public.dim_users d
SET email = u.email
FROM auth.users u
WHERE d.user_id = u.id AND d.email IS NULL;

-- =====================================================
-- 2. UPDATE NEW USER TRIGGER TO INCLUDE EMAIL
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create free trial subscription
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'active', NOW() + INTERVAL '28 days')
  ON CONFLICT (user_id) DO UPDATE SET 
    status = 'active',
    plan_id = 'free',
    deleted_at = NULL;
  
  -- Grant trial credits
  INSERT INTO public.user_credits (user_id, credit_type, meal_credits, grocery_credits, edit_credits, regen_credits, expires_at)
  VALUES (NEW.id, 'trial', 25, 63, 25, 25, NOW() + INTERVAL '28 days');
  
  -- Record in analytics
  INSERT INTO public.fact_subscription_events (user_id, event_type, new_tier, revenue_inr)
  VALUES (NEW.id, 'trial_start', 'free', 0);
  
  -- Create/update user dimension record with email
  INSERT INTO public.dim_users (user_id, signup_date, current_tier, email)
  VALUES (NEW.id, CURRENT_DATE, 'free', NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    current_tier = 'free',
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. USER PUSH TOKENS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  device_type TEXT DEFAULT 'android',
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can manage own push tokens"
  ON public.user_push_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all tokens (for sending notifications)
CREATE POLICY "Admins can read all push tokens"
  ON public.user_push_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- =====================================================
-- 4. ADMIN NOTIFICATIONS LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'specific', 'tier')),
  target_user_ids UUID[],
  target_tier TEXT,
  sent_by UUID REFERENCES auth.users(id),
  sent_by_email TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can access
CREATE POLICY "Admins can manage notifications"
  ON public.admin_notifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- =====================================================
-- 5. INDEX FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_updated 
  ON public.user_push_tokens(updated_at);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_sent 
  ON public.admin_notifications(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_dim_users_email 
  ON public.dim_users(email);
