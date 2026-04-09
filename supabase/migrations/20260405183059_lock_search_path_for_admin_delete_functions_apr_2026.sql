CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
  PERFORM public.ensure_free_trial_subscription(NEW.id);

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fact_subscription_events'
  ) THEN
    INSERT INTO public.fact_subscription_events (user_id, event_type, new_tier, revenue_inr)
    VALUES (NEW.id, 'trial_start', 'free', 0);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'dim_users'
  ) THEN
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
      created_at,
      deleted_at
    )
    VALUES (
      NEW.id,
      COALESCE((NEW.created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE),
      'auth',
      COALESCE(
        (
          SELECT us.plan_id
          FROM public.user_subscriptions us
          WHERE us.user_id = NEW.id
            AND us.deleted_at IS NULL
          ORDER BY COALESCE(us.updated_at, us.created_at) DESC NULLS LAST
          LIMIT 1
        ),
        'free'
      ),
      0,
      0,
      NEW.last_sign_in_at,
      NOW(),
      NEW.email,
      COALESCE(NEW.created_at, NOW()),
      NULL
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, public.dim_users.email),
      last_active_at = COALESCE(EXCLUDED.last_active_at, public.dim_users.last_active_at),
      signup_source = COALESCE(public.dim_users.signup_source, EXCLUDED.signup_source),
      deleted_at = NULL,
      updated_at = NOW();
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user_subscription: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_dim_user_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
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
    created_at,
    deleted_at
  )
  VALUES (
    NEW.id,
    COALESCE((NEW.created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE),
    'auth',
    COALESCE(
      (
        SELECT us.plan_id
        FROM public.user_subscriptions us
        WHERE us.user_id = NEW.id
          AND us.deleted_at IS NULL
        ORDER BY COALESCE(us.updated_at, us.created_at) DESC NULLS LAST
        LIMIT 1
      ),
      'free'
    ),
    0,
    0,
    NEW.last_sign_in_at,
    NOW(),
    NEW.email,
    COALESCE(NEW.created_at, NOW()),
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.dim_users.email),
    last_active_at = COALESCE(EXCLUDED.last_active_at, public.dim_users.last_active_at),
    updated_at = NOW();

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_user(
  p_user_id uuid,
  p_reason text DEFAULT 'User requested deletion'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_email TEXT;
  v_deleted_at TIMESTAMPTZ := NOW();
BEGIN
  SELECT COALESCE(
    (SELECT au.email FROM auth.users au WHERE au.id = p_user_id),
    (SELECT NULLIF(BTRIM(d.email), '') FROM public.dim_users d WHERE d.user_id = p_user_id),
    (SELECT du.email FROM public.deleted_users du WHERE du.id = p_user_id)
  )
  INTO v_email;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  INSERT INTO public.deleted_users (id, email, deleted_at, deletion_reason, data_snapshot, auth_metadata)
  SELECT
    p_user_id,
    v_email,
    v_deleted_at,
    p_reason,
    jsonb_build_object(
      'subscription', (
        SELECT row_to_json(s)
        FROM public.user_subscriptions s
        WHERE s.user_id = p_user_id
          AND s.deleted_at IS NULL
        ORDER BY COALESCE(s.updated_at, s.created_at) DESC NULLS LAST
        LIMIT 1
      ),
      'credits_summary', (
        SELECT jsonb_build_object(
          'total_credits', COALESCE(SUM(COALESCE(credits, 0)), 0),
          'total_meal', COALESCE(SUM(COALESCE(meal_credits, 0)), 0),
          'total_grocery', COALESCE(SUM(COALESCE(grocery_credits, 0)), 0),
          'total_edit', COALESCE(SUM(COALESCE(edit_credits, 0)), 0),
          'total_regen', COALESCE(SUM(COALESCE(regen_credits, 0)), 0),
          'total_weekly_bonus', COALESCE(SUM(COALESCE(weekly_bonus_credits, 0)), 0),
          'total_referral', COALESCE(SUM(COALESCE(referral_credits, 0)), 0)
        )
        FROM public.user_credits uc
        WHERE uc.user_id = p_user_id
          AND uc.deleted_at IS NULL
      ),
      'preference_profiles_count', (
        SELECT COUNT(*)
        FROM public.preference_profiles p
        WHERE p.user_id = p_user_id
          AND p.deleted_at IS NULL
      ),
      'scheduled_meals_count', (
        SELECT COUNT(*)
        FROM public.scheduled_meals sm
        WHERE sm.user_id = p_user_id
      ),
      'weekly_plans_count', (
        SELECT COUNT(*)
        FROM public.weekly_plans wp
        JOIN public.preference_profiles pp ON pp.id = wp.profile_id
        WHERE pp.user_id = p_user_id
      ),
      'deleted_at', v_deleted_at
    ),
    (
      SELECT au.raw_user_meta_data
      FROM auth.users au
      WHERE au.id = p_user_id
    )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    deleted_at = EXCLUDED.deleted_at,
    deletion_reason = EXCLUDED.deletion_reason,
    data_snapshot = EXCLUDED.data_snapshot,
    auth_metadata = COALESCE(EXCLUDED.auth_metadata, public.deleted_users.auth_metadata);

  UPDATE public.dim_users
  SET
    email = COALESCE(NULLIF(BTRIM(email), ''), v_email),
    deleted_at = COALESCE(deleted_at, v_deleted_at),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE public.user_subscriptions
  SET
    deleted_at = COALESCE(deleted_at, v_deleted_at),
    status = CASE WHEN status = 'pending' THEN status ELSE 'cancelled' END,
    cancelled_at = COALESCE(cancelled_at, v_deleted_at),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  UPDATE public.preference_profiles
  SET
    deleted_at = COALESCE(deleted_at, v_deleted_at),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  UPDATE public.user_credits
  SET
    deleted_at = COALESCE(deleted_at, v_deleted_at),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  INSERT INTO public.admin_audit_log (admin_user_id, action_type, target_user_id, details)
  VALUES (
    p_user_id,
    'account_deleted',
    p_user_id,
    jsonb_build_object('reason', p_reason, 'self_delete', true)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account deleted successfully',
    'email', v_email
  );
END;
$function$;
