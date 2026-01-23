-- Family Activity Log Table
-- Tracks all actions made by family members for the activity feed

CREATE TABLE IF NOT EXISTS public.family_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    action_type TEXT NOT NULL, -- 'meal_added', 'meal_edited', 'meal_deleted', 'plan_generated', 'grocery_generated', 'member_joined', 'member_left'
    target_type TEXT, -- 'weekly_plan', 'scheduled_meal', 'grocery_list', 'member'
    target_date TEXT, -- Date of the meal/week affected (e.g., '2026-01-20')
    description TEXT NOT NULL, -- Human-readable description
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_activity_group ON public.family_activity(group_id);
CREATE INDEX IF NOT EXISTS idx_family_activity_created ON public.family_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_activity_user ON public.family_activity(user_id);

-- Enable RLS
ALTER TABLE public.family_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Family members can view activity for their group
CREATE POLICY "Family members can view activity" ON public.family_activity
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
    );

-- Family members can insert activity for their group  
CREATE POLICY "Family members can log activity" ON public.family_activity
    FOR INSERT WITH CHECK (
        group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
    );

-- Grant permissions
GRANT SELECT, INSERT ON public.family_activity TO authenticated;
