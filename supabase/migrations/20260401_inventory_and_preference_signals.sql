-- Inventory and preference signals for guided planner learning
-- Created: April 1, 2026

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'fridge_photo', 'pantry_photo', 'receipt', 'order_screenshot', 'smart_edit')),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'archived')),
    confidence NUMERIC DEFAULT 0.8,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.preference_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
    action_type TEXT NOT NULL CHECK (action_type IN ('regenerate', 'swap', 'manual_edit', 'smart_edit', 'save_recipe')),
    original_value TEXT,
    new_value TEXT,
    raw_instruction TEXT,
    positive_tags TEXT[] NOT NULL DEFAULT '{}',
    negative_tags TEXT[] NOT NULL DEFAULT '{}',
    confidence NUMERIC DEFAULT 0.7,
    requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_user ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_family_group ON public.inventory_items(family_group_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_preference_signals_user ON public.preference_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_preference_signals_family_group ON public.preference_signals(family_group_id);
CREATE INDEX IF NOT EXISTS idx_preference_signals_confirmation ON public.preference_signals(requires_confirmation);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preference_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and family manage inventory items" ON public.inventory_items;
CREATE POLICY "Users and family manage inventory items" ON public.inventory_items
    FOR ALL USING (
        user_id = auth.uid()
        OR (
            family_group_id IS NOT NULL
            AND family_group_id IN (
                SELECT group_id
                FROM public.family_group_members
                WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        OR (
            family_group_id IS NOT NULL
            AND family_group_id IN (
                SELECT group_id
                FROM public.family_group_members
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users and family manage preference signals" ON public.preference_signals;
CREATE POLICY "Users and family manage preference signals" ON public.preference_signals
    FOR ALL USING (
        user_id = auth.uid()
        OR (
            family_group_id IS NOT NULL
            AND family_group_id IN (
                SELECT group_id
                FROM public.family_group_members
                WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        OR (
            family_group_id IS NOT NULL
            AND family_group_id IN (
                SELECT group_id
                FROM public.family_group_members
                WHERE user_id = auth.uid()
            )
        )
    );
