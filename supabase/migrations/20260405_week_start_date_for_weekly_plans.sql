-- Persist the visible planner week so the active draft can be restored accurately.

ALTER TABLE public.weekly_plans
    ADD COLUMN IF NOT EXISTS week_start_date DATE;

UPDATE public.weekly_plans
SET week_start_date = (days -> 0 ->> 'day')::date
WHERE week_start_date IS NULL
  AND jsonb_typeof(days) = 'array'
  AND jsonb_array_length(days) > 0
  AND COALESCE(days -> 0 ->> 'day', '') ~ '^\d{4}-\d{2}-\d{2}$';

CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_current_week
    ON public.weekly_plans(user_id, is_current, week_start_date);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_family_current_week
    ON public.weekly_plans(family_group_id, is_current, week_start_date)
    WHERE family_group_id IS NOT NULL;
