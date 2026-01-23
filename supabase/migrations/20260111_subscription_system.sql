-- QookCommander Subscription System Migration
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. SUBSCRIPTION PLANS (Reference Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_inr INTEGER NOT NULL,
  meal_generations INTEGER NOT NULL,
  grocery_generations INTEGER NOT NULL,
  smart_edits INTEGER NOT NULL,
  single_regens INTEGER NOT NULL,
  max_profiles INTEGER NOT NULL,
  history_days INTEGER NOT NULL,
  byok_enabled BOOLEAN DEFAULT FALSE,
  weekly_bonus_meals INTEGER DEFAULT 0,
  weekly_bonus_grocery INTEGER DEFAULT 0,
  priority_support BOOLEAN DEFAULT FALSE,
  can_buy_credits BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO public.subscription_plans (id, name, price_inr, meal_generations, grocery_generations, smart_edits, single_regens, max_profiles, history_days, byok_enabled, weekly_bonus_meals, weekly_bonus_grocery, priority_support, can_buy_credits)
VALUES 
  ('free', 'Free Trial', 0, 25, 63, 25, 25, 3, 30, FALSE, 3, 8, FALSE, FALSE),
  ('basic', 'Basic', 49, 20, 50, 20, 40, 10, 90, TRUE, 3, 8, FALSE, TRUE),
  ('pro', 'Pro', 99, 60, 150, 60, 100, 999, 365, TRUE, 5, 13, TRUE, TRUE),
  ('byok', 'BYOK Only', 29, 0, 0, 0, 0, 999, 365, TRUE, 0, 0, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. USER SUBSCRIPTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id TEXT REFERENCES public.subscription_plans(id) NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  renews_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. USER CREDITS (Separate credit pools)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('plan', 'purchased', 'bonus', 'trial')),
  meal_credits INTEGER DEFAULT 0,
  grocery_credits INTEGER DEFAULT 0,
  edit_credits INTEGER DEFAULT 0,
  regen_credits INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_type ON public.user_credits(user_id, credit_type);
CREATE INDEX IF NOT EXISTS idx_user_credits_expiry ON public.user_credits(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- 4. USAGE TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('meal_generation', 'grocery_generation', 'smart_edit', 'single_regen', 'preference_parse')),
  credits_used DECIMAL(4,2) DEFAULT 1,
  credit_source_id UUID REFERENCES public.user_credits(id),
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10,6),
  api_source TEXT CHECK (api_source IN ('platform', 'byok')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON public.usage_tracking(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_action ON public.usage_tracking(action_type, created_at);

-- =====================================================
-- 5. CREDIT PACKS (Reference Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_inr INTEGER NOT NULL,
  discount_pct INTEGER DEFAULT 0,
  validity_days INTEGER DEFAULT 180,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default credit packs
INSERT INTO public.credit_packs (id, name, credits, price_inr, discount_pct)
VALUES 
  ('starter', 'Starter Pack', 10, 19, 0),
  ('popular', 'Popular Pack', 30, 49, 14),
  ('value', 'Value Pack', 75, 99, 30),
  ('mega', 'Mega Pack', 200, 199, 47)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. CREDIT PURCHASES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pack_id TEXT REFERENCES public.credit_packs(id),
  credits_added INTEGER NOT NULL,
  amount_inr INTEGER NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. WEEKLY BONUS LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS public.weekly_bonus_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  bonus_meals_granted INTEGER DEFAULT 0,
  bonus_grocery_granted INTEGER DEFAULT 0,
  bonus_meals_used INTEGER DEFAULT 0,
  bonus_grocery_used INTEGER DEFAULT 0,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- =====================================================
-- 8. RATE LIMIT TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1
);

-- Create unique constraint for upsert
ALTER TABLE public.rate_limit_tracking DROP CONSTRAINT IF EXISTS rate_limit_tracking_pkey;
ALTER TABLE public.rate_limit_tracking ADD CONSTRAINT rate_limit_unique UNIQUE (user_id, action_type, window_start);

-- =====================================================
-- 9. ANALYTICS: FACT TABLES
-- =====================================================

-- Generation Events Fact Table
CREATE TABLE IF NOT EXISTS public.fact_generation_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10,6),
  plan_tier TEXT,
  credit_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_gen_date ON public.fact_generation_events(created_at);
CREATE INDEX IF NOT EXISTS idx_fact_gen_user ON public.fact_generation_events(user_id);

-- Subscription Events Fact Table
CREATE TABLE IF NOT EXISTS public.fact_subscription_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('subscribe', 'upgrade', 'downgrade', 'cancel', 'renew', 'trial_start', 'trial_end')),
  old_tier TEXT,
  new_tier TEXT,
  revenue_inr INTEGER,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_sub_date ON public.fact_subscription_events(created_at);

-- Credit Transactions Fact Table
CREATE TABLE IF NOT EXISTS public.fact_credit_transactions (
  txn_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('purchase', 'consume', 'expire', 'bonus', 'refund', 'plan_grant')),
  credits_amount INTEGER,
  credits_balance_after INTEGER,
  pack_id TEXT,
  revenue_inr INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_credit_date ON public.fact_credit_transactions(created_at);

-- =====================================================
-- 10. ANALYTICS: DIMENSION TABLES
-- =====================================================

-- User Dimension (for analytics - denormalized)
CREATE TABLE IF NOT EXISTS public.dim_users (
  user_id UUID PRIMARY KEY,
  signup_date DATE,
  signup_source TEXT,
  current_tier TEXT,
  lifetime_value_inr INTEGER DEFAULT 0,
  total_generations INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_bonus_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Public read for plans and packs
CREATE POLICY "Anyone can view plans" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can view packs" ON public.credit_packs FOR SELECT USING (true);

-- User-specific policies
CREATE POLICY "Users manage own subscription" ON public.user_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own credits" ON public.user_credits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own usage" ON public.usage_tracking FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own purchases" ON public.credit_purchases FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own bonus log" ON public.weekly_bonus_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own rate limits" ON public.rate_limit_tracking FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 12. FUNCTIONS: Auto-create subscription on signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create free trial subscription
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'active', NOW() + INTERVAL '28 days');
  
  -- Grant trial credits
  INSERT INTO public.user_credits (user_id, credit_type, meal_credits, grocery_credits, edit_credits, regen_credits, expires_at)
  VALUES (NEW.id, 'trial', 25, 63, 25, 25, NOW() + INTERVAL '28 days');
  
  -- Record in analytics
  INSERT INTO public.fact_subscription_events (user_id, event_type, new_tier, revenue_inr)
  VALUES (NEW.id, 'trial_start', 'free', 0);
  
  -- Create user dimension record
  INSERT INTO public.dim_users (user_id, signup_date, current_tier)
  VALUES (NEW.id, CURRENT_DATE, 'free');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup (subscription)
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- =====================================================
-- 13. FUNCTIONS: Get user credits summary
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_credits_summary(p_user_id UUID)
RETURNS TABLE (
  total_meal_credits INTEGER,
  total_grocery_credits INTEGER,
  total_edit_credits INTEGER,
  total_regen_credits INTEGER,
  plan_tier TEXT,
  byok_enabled BOOLEAN,
  trial_ends_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(uc.meal_credits), 0)::INTEGER,
    COALESCE(SUM(uc.grocery_credits), 0)::INTEGER,
    COALESCE(SUM(uc.edit_credits), 0)::INTEGER,
    COALESCE(SUM(uc.regen_credits), 0)::INTEGER,
    us.plan_id,
    sp.byok_enabled,
    us.trial_ends_at
  FROM public.user_subscriptions us
  LEFT JOIN public.user_credits uc ON uc.user_id = us.user_id 
    AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
  LEFT JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
  GROUP BY us.plan_id, sp.byok_enabled, us.trial_ends_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 14. FUNCTIONS: Consume credits
-- =====================================================

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_action_type TEXT,
  p_credits_needed DECIMAL DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_credit_record RECORD;
  v_remaining DECIMAL;
  v_to_deduct DECIMAL;
  v_credit_column TEXT;
BEGIN
  -- Map action to credit column
  v_credit_column := CASE p_action_type
    WHEN 'meal_generation' THEN 'meal_credits'
    WHEN 'grocery_generation' THEN 'grocery_credits'
    WHEN 'smart_edit' THEN 'edit_credits'
    WHEN 'single_regen' THEN 'regen_credits'
    ELSE 'meal_credits'
  END;
  
  v_remaining := p_credits_needed;
  
  -- Consume from oldest credits first (bonus > trial > plan > purchased)
  FOR v_credit_record IN 
    SELECT id, credit_type,
      CASE v_credit_column
        WHEN 'meal_credits' THEN meal_credits
        WHEN 'grocery_credits' THEN grocery_credits
        WHEN 'edit_credits' THEN edit_credits
        WHEN 'regen_credits' THEN regen_credits
      END as available_credits
    FROM public.user_credits
    WHERE user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
      CASE credit_type WHEN 'bonus' THEN 1 WHEN 'trial' THEN 2 WHEN 'plan' THEN 3 WHEN 'purchased' THEN 4 END,
      created_at ASC
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;
    
    v_to_deduct := LEAST(v_credit_record.available_credits, v_remaining);
    
    IF v_to_deduct > 0 THEN
      EXECUTE format('UPDATE public.user_credits SET %I = %I - $1, updated_at = NOW() WHERE id = $2', 
        v_credit_column, v_credit_column)
      USING v_to_deduct, v_credit_record.id;
      
      v_remaining := v_remaining - v_to_deduct;
    END IF;
  END LOOP;
  
  IF v_remaining > 0 THEN
    RETURN FALSE; -- Not enough credits
  END IF;
  
  -- Log usage
  INSERT INTO public.usage_tracking (user_id, action_type, credits_used, api_source)
  VALUES (p_user_id, p_action_type, p_credits_needed, 'platform');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 15. FUNCTIONS: Check rate limit
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_window_minutes INTEGER DEFAULT 1,
  p_max_requests INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', NOW());
  
  -- Get or create rate limit record
  INSERT INTO public.rate_limit_tracking (user_id, action_type, window_start, request_count)
  VALUES (p_user_id, p_action_type, v_window_start, 1)
  ON CONFLICT (user_id, action_type, window_start) 
  DO UPDATE SET request_count = rate_limit_tracking.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  RETURN v_current_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
