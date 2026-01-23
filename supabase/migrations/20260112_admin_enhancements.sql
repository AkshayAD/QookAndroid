-- Admin Dashboard Enhancements Migration
-- Created: 2026-01-12
-- Features: Custom Templates, User Segments, Test Accounts, Template Downloads

-- =====================================================
-- 1. CUSTOM TEMPLATES (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.custom_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'preference', -- 'meal_plan', 'preference', 'cuisine', 'dietary'
  
  -- Template content (matches PreferenceProfile structure)
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  
  -- Targeting
  target_audience TEXT DEFAULT 'all_users', -- all_users, segment, specific
  target_tiers TEXT[] DEFAULT '{}', -- ['free', 'basic', 'pro']
  target_segments TEXT[] DEFAULT '{}', -- ['new_users', 'trial_expiring', 'inactive']
  target_user_ids UUID[] DEFAULT '{}', -- For specific user targeting
  
  -- For new user defaults
  is_default_for_new_users BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_active ON public.custom_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_audience ON public.custom_templates(target_audience);
CREATE INDEX IF NOT EXISTS idx_templates_default ON public.custom_templates(is_default_for_new_users) WHERE is_default_for_new_users = TRUE;

-- =====================================================
-- 2. USER TEMPLATE DOWNLOADS (Track which users have templates)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_template_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.custom_templates(id) ON DELETE CASCADE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_template_downloads_user ON public.user_template_downloads(user_id);

-- =====================================================
-- 3. USER SEGMENTS (Define targeting segments)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_segments (
  id TEXT PRIMARY KEY, -- 'new_users', 'trial_expiring', etc.
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"days_since_signup": {"lte": 7}}
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default segments
INSERT INTO public.user_segments (id, name, description, criteria, is_system) VALUES
  ('new_users', 'New Users', 'Users who signed up in the last 7 days', '{"days_since_signup": {"lte": 7}}', true),
  ('trial_active', 'Active Trial', 'Users currently on trial', '{"has_active_trial": true}', true),
  ('trial_expiring', 'Trial Expiring', 'Trial users with less than 3 days remaining', '{"trial_days_remaining": {"lte": 3}}', true),
  ('inactive_7d', 'Inactive (7 days)', 'Users who have not been active in 7 days', '{"days_since_last_active": {"gte": 7}}', true),
  ('inactive_30d', 'Inactive (30 days)', 'Users who have not been active in 30 days', '{"days_since_last_active": {"gte": 30}}', true),
  ('power_users', 'Power Users', 'Users with high engagement (50+ generations)', '{"total_generations": {"gte": 50}}', true),
  ('future_joiners', 'Future Joiners', 'Applies to all new signups going forward', '{"is_new_signup": true}', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. TEST ACCOUNTS (Define test account configurations)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.test_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'pro')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default test accounts
INSERT INTO public.test_accounts (email, tier, description) VALUES
  ('test.free@qook.in', 'free', 'Free tier test account with trial credits'),
  ('test.basic@qook.in', 'basic', 'Basic tier test account with full credits'),
  ('test.pro@qook.in', 'pro', 'Pro tier test account with unlimited access')
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_template_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_accounts ENABLE ROW LEVEL SECURITY;

-- Templates: Public read for active templates, admin write
CREATE POLICY "Anyone can view active templates" ON public.custom_templates 
  FOR SELECT USING (is_active = TRUE);

-- Template downloads: Users can manage their own downloads
CREATE POLICY "Users manage own template downloads" ON public.user_template_downloads 
  FOR ALL USING (auth.uid() = user_id);

-- Segments: Public read
CREATE POLICY "Anyone can view segments" ON public.user_segments 
  FOR SELECT USING (true);

-- Test accounts: Public read (admins need to see them)
CREATE POLICY "Anyone can view test accounts" ON public.test_accounts 
  FOR SELECT USING (true);

-- =====================================================
-- 6. FUNCTION: Increment template download count
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_template_downloads(p_template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.custom_templates 
  SET download_count = download_count + 1 
  WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNCTION: Get templates for user (filtered by tier/segment)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_templates_for_user(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  template_data JSONB,
  is_featured BOOLEAN,
  download_count INTEGER,
  is_downloaded BOOLEAN
) AS $$
DECLARE
  v_user_tier TEXT;
BEGIN
  -- Get user's current tier
  SELECT plan_id INTO v_user_tier 
  FROM public.user_subscriptions 
  WHERE user_id = p_user_id;
  
  v_user_tier := COALESCE(v_user_tier, 'free');
  
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.category,
    t.template_data,
    t.is_featured,
    t.download_count,
    EXISTS (
      SELECT 1 FROM public.user_template_downloads d 
      WHERE d.template_id = t.id AND d.user_id = p_user_id
    ) as is_downloaded
  FROM public.custom_templates t
  WHERE t.is_active = TRUE
    AND (
      t.target_audience = 'all_users'
      OR (t.target_tiers @> ARRAY[v_user_tier])
      OR (p_user_id = ANY(t.target_user_ids))
    )
  ORDER BY t.is_featured DESC, t.display_order ASC, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
