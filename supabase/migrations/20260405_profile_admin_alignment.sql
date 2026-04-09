-- Align production schema and backfills with the current app/runtime expectations.

-- 1. Older accounts can exist in auth.users without a matching public.user_profiles row.
INSERT INTO public.user_profiles (id, display_name, created_at, updated_at)
SELECT
  au.id,
  COALESCE(
    NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(au.raw_user_meta_data ->> 'name', ''),
    split_part(COALESCE(au.email, au.id::text), '@', 1)
  ),
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.user_profiles up
  ON up.id = au.id
WHERE up.id IS NULL;

-- 2. Admin queries expect a soft-delete marker on dim_users and need missing auth users backfilled.
ALTER TABLE public.dim_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

INSERT INTO public.dim_users (
  user_id,
  signup_date,
  signup_source,
  current_tier,
  lifetime_value_inr,
  total_generations,
  last_active_at,
  updated_at,
  email,
  created_at
)
SELECT
  au.id,
  COALESCE((au.created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE),
  'oauth',
  COALESCE(us.plan_id, 'free'),
  0,
  0,
  au.last_sign_in_at,
  NOW(),
  au.email,
  COALESCE(au.created_at, NOW())
FROM auth.users au
LEFT JOIN public.dim_users du
  ON du.user_id = au.id
LEFT JOIN public.user_subscriptions us
  ON us.user_id = au.id
WHERE du.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_dim_users_active_email
  ON public.dim_users(email)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dim_users_active_last_active
  ON public.dim_users(last_active_at DESC)
  WHERE deleted_at IS NULL;

-- 3. Current frontend code logs newer trust actions that were missing from the check constraint.
ALTER TABLE public.user_trust_actions
  DROP CONSTRAINT IF EXISTS user_trust_actions_action_type_check;

ALTER TABLE public.user_trust_actions
  ADD CONSTRAINT user_trust_actions_action_type_check
  CHECK (
    action_type = ANY (
      ARRAY[
        'signup'::text,
        'complete_profile'::text,
        'add_phone'::text,
        'return_24h'::text,
        'first_manual_save'::text,
        'install_pwa'::text,
        'generate_second_menu'::text,
        'share_menu_commands'::text
      ]
    )
  );

-- 4. Admin notification writes include delivery_count in the API layer.
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS delivery_count INTEGER NOT NULL DEFAULT 0;
