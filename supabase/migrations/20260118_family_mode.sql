-- Family Mode Migration
-- Created: January 18, 2026
-- Purpose: Add family group functionality for collaborative meal planning

-- ============================================================================
-- FAMILY GROUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'My Family',
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for owner lookup
CREATE INDEX IF NOT EXISTS idx_family_groups_owner ON public.family_groups(owner_id);

-- Index for invite code lookup
CREATE INDEX IF NOT EXISTS idx_family_groups_invite_code ON public.family_groups(invite_code);

-- ============================================================================
-- FAMILY GROUP MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    -- One user can only belong to one family group
    UNIQUE(user_id)
);

-- Index for group member lookup
CREATE INDEX IF NOT EXISTS idx_family_group_members_group ON public.family_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_family_group_members_user ON public.family_group_members(user_id);

-- ============================================================================
-- MODIFY EXISTING TABLES FOR FAMILY SUPPORT
-- ============================================================================

-- Add family_group_id to weekly_plans
ALTER TABLE public.weekly_plans 
    ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS was_family_plan BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Add family_group_id to scheduled_meals
ALTER TABLE public.scheduled_meals
    ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS was_family_plan BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Add family_group_id to grocery_lists
ALTER TABLE public.grocery_lists
    ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS was_family_plan BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- FAMILY CREDIT POOL TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_credit_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL UNIQUE,
    total_credits INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family credit contributions (for audit trail)
CREATE TABLE IF NOT EXISTS public.family_credit_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    contributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('subscription', 'purchase', 'bonus', 'transfer')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_credit_contributions_group ON public.family_credit_contributions(group_id);

-- ============================================================================
-- FAMILY SUBSCRIPTION ADD-ONS
-- ============================================================================

-- Add family plan options to subscription_plans
INSERT INTO public.subscription_plans (id, name, regular_price, first_month_price, unified_credits, weekly_bonus, max_profiles, history_days, features)
VALUES 
    ('partner_addon', 'Partner Add-On', 79, 39, 5, 0, 0, 0, ARRAY['Link 1 additional user', '+5 bonus credits/month', 'Real-time sync', 'Shared menu editing']),
    ('family_addon', 'Family Add-On', 149, 74, 10, 0, 0, 0, ARRAY['Link up to 4 users', '+10 bonus credits/month', 'Real-time sync', 'Shared menu editing', 'Activity log']),
    ('family', 'Family Plan', 299, 149, 30, 2, -1, 365, ARRAY['Up to 5 family members', '30 credits/month', '+2 credits/week bonus', 'All Pro features', 'Real-time collaboration', 'Priority support'])
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    regular_price = EXCLUDED.regular_price,
    first_month_price = EXCLUDED.first_month_price,
    unified_credits = EXCLUDED.unified_credits,
    features = EXCLUDED.features;

-- ============================================================================
-- ROW LEVEL SECURITY FOR FAMILY TABLES
-- ============================================================================

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_credit_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_credit_contributions ENABLE ROW LEVEL SECURITY;

-- Family groups: owners and members can view, only owner can modify
CREATE POLICY "Family group access" ON public.family_groups
    FOR SELECT USING (
        owner_id = auth.uid() 
        OR id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Family group owner management" ON public.family_groups
    FOR ALL USING (owner_id = auth.uid());

-- Family members: members can view their group, join via invite
CREATE POLICY "Family members can view group members" ON public.family_group_members
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
        OR group_id IN (SELECT id FROM public.family_groups WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can join groups" ON public.family_group_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups" ON public.family_group_members
    FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Owners can manage members" ON public.family_group_members
    FOR ALL USING (
        group_id IN (SELECT id FROM public.family_groups WHERE owner_id = auth.uid())
    );

-- Family credit pool: members can view
CREATE POLICY "Family members can view credit pool" ON public.family_credit_pool
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
    );

-- Family credit contributions: members can view and contribute
CREATE POLICY "Family members can view contributions" ON public.family_credit_contributions
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Family members can contribute" ON public.family_credit_contributions
    FOR INSERT WITH CHECK (
        contributor_id = auth.uid() 
        AND group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
    );

-- ============================================================================
-- UPDATE EXISTING RLS POLICIES FOR FAMILY ACCESS
-- ============================================================================

-- Drop existing policies to recreate with family support
DROP POLICY IF EXISTS "Users manage own plans" ON public.weekly_plans;
DROP POLICY IF EXISTS "Users manage own meals" ON public.scheduled_meals;
DROP POLICY IF EXISTS "Users manage own groceries" ON public.grocery_lists;

-- Weekly plans: user access OR family group access
CREATE POLICY "Users and family manage plans" ON public.weekly_plans
    FOR ALL USING (
        user_id = auth.uid() 
        OR (family_group_id IS NOT NULL AND family_group_id IN (
            SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid()
        ))
    );

-- Scheduled meals: user access OR family group access
CREATE POLICY "Users and family manage meals" ON public.scheduled_meals
    FOR ALL USING (
        user_id = auth.uid() 
        OR (family_group_id IS NOT NULL AND family_group_id IN (
            SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid()
        ))
    );

-- Grocery lists: user access OR family group access
CREATE POLICY "Users and family manage groceries" ON public.grocery_lists
    FOR ALL USING (
        user_id = auth.uid() 
        OR (family_group_id IS NOT NULL AND family_group_id IN (
            SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid()
        ))
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := 'FAM-';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create family group with owner as first member
CREATE OR REPLACE FUNCTION create_family_group(group_name TEXT)
RETURNS UUID AS $$
DECLARE
    new_group_id UUID;
    new_invite_code TEXT;
BEGIN
    -- Check if user already in a group
    IF EXISTS (SELECT 1 FROM public.family_group_members WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'User already belongs to a family group';
    END IF;
    
    -- Generate unique invite code
    LOOP
        new_invite_code := generate_invite_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.family_groups WHERE invite_code = new_invite_code);
    END LOOP;
    
    -- Create the group
    INSERT INTO public.family_groups (name, owner_id, invite_code)
    VALUES (group_name, auth.uid(), new_invite_code)
    RETURNING id INTO new_group_id;
    
    -- Add owner as member
    INSERT INTO public.family_group_members (group_id, user_id, role)
    VALUES (new_group_id, auth.uid(), 'owner');
    
    -- Initialize credit pool
    INSERT INTO public.family_credit_pool (group_id, total_credits)
    VALUES (new_group_id, 0);
    
    RETURN new_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join family group via invite code
CREATE OR REPLACE FUNCTION join_family_group(invite TEXT)
RETURNS UUID AS $$
DECLARE
    target_group_id UUID;
    member_count INTEGER;
BEGIN
    -- Check if user already in a group
    IF EXISTS (SELECT 1 FROM public.family_group_members WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'User already belongs to a family group';
    END IF;
    
    -- Find the group by invite code
    SELECT id INTO target_group_id 
    FROM public.family_groups 
    WHERE invite_code = invite AND is_active = TRUE;
    
    IF target_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive invite code';
    END IF;
    
    -- Check member limit (max 5 for most plans)
    SELECT COUNT(*) INTO member_count 
    FROM public.family_group_members 
    WHERE group_id = target_group_id;
    
    IF member_count >= 5 THEN
        RAISE EXCEPTION 'Family group is full';
    END IF;
    
    -- Add user as member
    INSERT INTO public.family_group_members (group_id, user_id, role)
    VALUES (target_group_id, auth.uid(), 'member');
    
    RETURN target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave family group (handles menu transition)
CREATE OR REPLACE FUNCTION leave_family_group()
RETURNS VOID AS $$
DECLARE
    user_group_id UUID;
    user_role TEXT;
BEGIN
    -- Get user's current group and role
    SELECT group_id, role INTO user_group_id, user_role
    FROM public.family_group_members 
    WHERE user_id = auth.uid();
    
    IF user_group_id IS NULL THEN
        RAISE EXCEPTION 'User is not in a family group';
    END IF;
    
    -- If owner, handle ownership transfer or group deletion
    IF user_role = 'owner' THEN
        -- Check if there are other members
        IF EXISTS (SELECT 1 FROM public.family_group_members WHERE group_id = user_group_id AND user_id != auth.uid()) THEN
            RAISE EXCEPTION 'Owner must transfer ownership before leaving';
        ELSE
            -- No other members, mark group as inactive
            UPDATE public.family_groups SET is_active = FALSE WHERE id = user_group_id;
        END IF;
    END IF;
    
    -- Mark user's family plans as "was_family_plan" and detach
    UPDATE public.weekly_plans 
    SET was_family_plan = TRUE, family_group_id = NULL 
    WHERE family_group_id = user_group_id AND user_id = auth.uid();
    
    UPDATE public.scheduled_meals 
    SET was_family_plan = TRUE, family_group_id = NULL 
    WHERE family_group_id = user_group_id AND user_id = auth.uid();
    
    -- Remove user from group
    DELETE FROM public.family_group_members WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENABLE REALTIME FOR FAMILY TABLES
-- ============================================================================

-- Add family tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_credit_pool;

-- Ensure weekly_plans and scheduled_meals are in realtime (for family sync)
-- They should already be there, but this ensures it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'weekly_plans'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_plans;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'scheduled_meals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_meals;
    END IF;
END $$;
