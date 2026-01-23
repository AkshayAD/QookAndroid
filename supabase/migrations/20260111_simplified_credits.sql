-- QookCommander Simplified Credits Migration
-- Run this in Supabase SQL Editor after the initial migration

-- =====================================================
-- 1. ADD UNIFIED CREDITS COLUMNS TO SUBSCRIPTION_PLANS
-- =====================================================

-- Add new columns for unified credit model
ALTER TABLE public.subscription_plans 
  ADD COLUMN IF NOT EXISTS unified_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_expiry_days INTEGER DEFAULT 28;

-- Update plans with new unified values
-- Free Trial: 8 credits (generous launch offer, 4 weeks expiry)
-- Basic: 8 credits/month + 1 weekly bonus
-- Pro: 20 credits/month + 2 weekly bonus  
-- BYOK: Unlimited (uses own API key)

UPDATE public.subscription_plans SET 
  unified_credits = 0,
  trial_credits = 8,
  weekly_bonus = 3,
  trial_expiry_days = 28
WHERE id = 'free';

UPDATE public.subscription_plans SET 
  unified_credits = 8,
  trial_credits = 0,
  weekly_bonus = 1,
  trial_expiry_days = 0
WHERE id = 'basic';

UPDATE public.subscription_plans SET 
  unified_credits = 20,
  trial_credits = 0,
  weekly_bonus = 2,
  trial_expiry_days = 0
WHERE id = 'pro';

UPDATE public.subscription_plans SET 
  unified_credits = -1, -- -1 means unlimited (BYOK)
  trial_credits = 0,
  weekly_bonus = 0,
  trial_expiry_days = 0
WHERE id = 'byok';

-- =====================================================
-- 2. UPDATE CREDIT PACKS FOR UNIFIED MODEL
-- =====================================================

-- Update credit packs to unified credits
UPDATE public.credit_packs SET 
  name = 'Starter Pack',
  credits = 3,
  price_inr = 19
WHERE id = 'starter';

UPDATE public.credit_packs SET 
  name = 'Popular Pack',
  credits = 8,
  price_inr = 49,
  discount_pct = 15
WHERE id = 'popular';

UPDATE public.credit_packs SET 
  name = 'Value Pack',
  credits = 20,
  price_inr = 99,
  discount_pct = 30
WHERE id = 'value';

UPDATE public.credit_packs SET 
  name = 'Mega Pack',
  credits = 50,
  price_inr = 199,
  discount_pct = 45
WHERE id = 'mega';

-- =====================================================
-- 3. CREATE UNIFIED CREDITS VIEW FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_unified_credits(p_user_id UUID)
RETURNS TABLE (
  total_credits INTEGER,
  plan_tier TEXT,
  byok_enabled BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  weekly_bonus INTEGER,
  next_bonus_at TIMESTAMPTZ
) AS $$
DECLARE
  v_week_start DATE;
BEGIN
  -- Calculate current week start (Monday)
  v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
  
  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      uc.meal_credits + 
      FLOOR(uc.grocery_credits / 2)::INTEGER + 
      FLOOR(uc.edit_credits / 4)::INTEGER + 
      FLOOR(uc.regen_credits / 8)::INTEGER
    ), 0)::INTEGER as total_credits,
    us.plan_id,
    sp.byok_enabled,
    us.trial_ends_at,
    sp.weekly_bonus,
    (v_week_start + INTERVAL '7 days')::TIMESTAMPTZ as next_bonus_at
  FROM public.user_subscriptions us
  LEFT JOIN public.user_credits uc ON uc.user_id = us.user_id 
    AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
  LEFT JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
  GROUP BY us.plan_id, sp.byok_enabled, us.trial_ends_at, sp.weekly_bonus;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. UPDATE CONSUME CREDITS FOR UNIFIED MODEL
-- =====================================================

-- Drop old function and create new unified version
CREATE OR REPLACE FUNCTION public.consume_unified_credit(
  p_user_id UUID,
  p_credits_needed INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_credit_record RECORD;
  v_remaining INTEGER;
  v_to_deduct INTEGER;
BEGIN
  v_remaining := p_credits_needed;
  
  -- Check if BYOK user (unlimited)
  IF EXISTS (
    SELECT 1 FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = p_user_id AND sp.byok_enabled = TRUE
  ) THEN
    -- Log usage but don't deduct credits
    INSERT INTO public.usage_tracking (user_id, action_type, credits_used, api_source)
    VALUES (p_user_id, 'meal_generation', 0, 'byok');
    RETURN TRUE;
  END IF;
  
  -- Consume from oldest credits first (bonus > trial > plan > purchased)
  FOR v_credit_record IN 
    SELECT id, credit_type, meal_credits as available_credits
    FROM public.user_credits
    WHERE user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > NOW())
      AND meal_credits > 0
    ORDER BY 
      CASE credit_type WHEN 'bonus' THEN 1 WHEN 'trial' THEN 2 WHEN 'plan' THEN 3 WHEN 'purchased' THEN 4 END,
      created_at ASC
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;
    
    v_to_deduct := LEAST(v_credit_record.available_credits, v_remaining);
    
    IF v_to_deduct > 0 THEN
      UPDATE public.user_credits 
      SET meal_credits = meal_credits - v_to_deduct, updated_at = NOW() 
      WHERE id = v_credit_record.id;
      
      v_remaining := v_remaining - v_to_deduct;
    END IF;
  END LOOP;
  
  IF v_remaining > 0 THEN
    RETURN FALSE; -- Not enough credits
  END IF;
  
  -- Log usage
  INSERT INTO public.usage_tracking (user_id, action_type, credits_used, api_source)
  VALUES (p_user_id, 'meal_generation', p_credits_needed, 'platform');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. UPDATE NEW USER TRIGGER FOR UNIFIED CREDITS
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_credits INTEGER;
  v_trial_days INTEGER;
BEGIN
  -- Get trial credits from plan
  SELECT trial_credits, trial_expiry_days 
  INTO v_trial_credits, v_trial_days
  FROM public.subscription_plans 
  WHERE id = 'free';
  
  -- Create free trial subscription
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'active', NOW() + (v_trial_days || ' days')::INTERVAL);
  
  -- Grant trial credits (unified: stored in meal_credits column)
  INSERT INTO public.user_credits (user_id, credit_type, meal_credits, grocery_credits, edit_credits, regen_credits, expires_at)
  VALUES (NEW.id, 'trial', v_trial_credits, 0, 0, 0, NOW() + (v_trial_days || ' days')::INTERVAL);
  
  -- Record in analytics
  INSERT INTO public.fact_subscription_events (user_id, event_type, new_tier, revenue_inr)
  VALUES (NEW.id, 'trial_start', 'free', 0);
  
  -- Create user dimension record
  INSERT INTO public.dim_users (user_id, signup_date, current_tier)
  VALUES (NEW.id, CURRENT_DATE, 'free');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. ADD AI LEARNING MARKETING COLUMN
-- =====================================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::JSONB;

UPDATE public.subscription_plans SET features = '[
  "AI learns your taste preferences",
  "Personalized recommendations weekly",
  "3 weekly bonus credits"
]'::JSONB WHERE id = 'free';

UPDATE public.subscription_plans SET features = '[
  "AI learns your taste preferences",
  "8 credits per month",
  "1 weekly bonus credit",
  "90 days history",
  "Use your own API key"
]'::JSONB WHERE id = 'basic';

UPDATE public.subscription_plans SET features = '[
  "AI learns your taste preferences",
  "20 credits per month",
  "2 weekly bonus credits",
  "365 days history",
  "Priority support",
  "Use your own API key"
]'::JSONB WHERE id = 'pro';

UPDATE public.subscription_plans SET features = '[
  "Unlimited generations with your key",
  "Full history access",
  "AI learns your preferences"
]'::JSONB WHERE id = 'byok';
