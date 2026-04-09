-- Safe advisor cleanup only: search_path hardening for non-billing/non-credit functions
-- and missing FK indexes for admin/config tables.

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id
  ON public.admin_audit_log (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id
  ON public.admin_audit_log (target_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_sent_by
  ON public.admin_notifications (sent_by);

CREATE INDEX IF NOT EXISTS idx_admin_users_added_by
  ON public.admin_users (added_by);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by
  ON public.app_settings (updated_by);

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, auth
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, auth
AS $function$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := 'QOOK-';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_referral_usage(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
    UPDATE public.referral_codes
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE code = p_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_template_downloads(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
  UPDATE public.custom_templates
  SET download_count = download_count + 1
  WHERE id = p_template_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.feature_enabled_for_tier(p_feature_id text, p_tier_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    SELECT enabled
    INTO v_enabled
    FROM public.feature_tier_access
    WHERE feature_id = p_feature_id
      AND tier_id = p_tier_id;

    RETURN COALESCE(v_enabled, FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_effective_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
    v_plan_id TEXT := 'free';
    v_trial_ends_at TIMESTAMPTZ;
    v_launch_offer JSONB;
BEGIN
    SELECT plan_id, trial_ends_at
    INTO v_plan_id, v_trial_ends_at
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
    LIMIT 1;

    SELECT value
    INTO v_launch_offer
    FROM public.app_settings
    WHERE key = 'launch_offer';

    IF v_plan_id IS NULL THEN
        v_plan_id := 'free';
    END IF;

    IF v_plan_id = 'free'
       AND v_trial_ends_at IS NOT NULL
       AND v_trial_ends_at > NOW()
       AND COALESCE((v_launch_offer ->> 'enabled')::BOOLEAN, FALSE) THEN
        RETURN COALESCE(v_launch_offer ->> 'effective_tier', 'pro');
    END IF;

    RETURN v_plan_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_family_members_with_emails(p_group_id uuid)
RETURNS TABLE(id uuid, group_id uuid, user_id uuid, role text, joined_at timestamp with time zone, display_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.group_id,
        m.user_id,
        m.role,
        m.joined_at,
        COALESCE(p.display_name, split_part(u.email, '@', 1)) AS display_name,
        u.email
    FROM public.family_group_members m
    LEFT JOIN public.user_profiles p ON p.id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.group_id = p_group_id
      AND COALESCE(m.is_active, TRUE) = TRUE
    ORDER BY m.joined_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_templates_for_user(p_user_id uuid)
RETURNS TABLE(id uuid, name text, description text, category text, template_data jsonb, is_featured boolean, download_count integer, is_downloaded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_user_tier TEXT;
BEGIN
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
$function$;

CREATE OR REPLACE FUNCTION public.create_family_group(group_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
    new_group_id UUID;
    new_invite_code TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.family_group_members WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'User already belongs to a family group';
    END IF;

    LOOP
        new_invite_code := public.generate_invite_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.family_groups WHERE invite_code = new_invite_code);
    END LOOP;

    INSERT INTO public.family_groups (name, owner_id, invite_code)
    VALUES (group_name, auth.uid(), new_invite_code)
    RETURNING id INTO new_group_id;

    INSERT INTO public.family_group_members (group_id, user_id, role)
    VALUES (new_group_id, auth.uid(), 'owner');

    INSERT INTO public.family_credit_pool (group_id, total_credits)
    VALUES (new_group_id, 0);

    RETURN new_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_family_group(invite text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_group_id uuid;
    v_existing_active_group uuid;
    v_existing_membership_id uuid;
BEGIN
    SELECT group_id INTO v_existing_active_group
    FROM public.family_group_members
    WHERE user_id = v_user_id AND is_active = true
    LIMIT 1;

    IF v_existing_active_group IS NOT NULL THEN
        RAISE EXCEPTION 'You are already a member of a family group. Please leave your current family first.';
    END IF;

    SELECT id INTO v_group_id
    FROM public.family_groups
    WHERE invite_code = upper(invite) AND is_active = true;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code. Please check and try again.';
    END IF;

    SELECT id INTO v_existing_membership_id
    FROM public.family_group_members
    WHERE user_id = v_user_id AND group_id = v_group_id AND is_active = false;

    IF v_existing_membership_id IS NOT NULL THEN
        UPDATE public.family_group_members
        SET is_active = true, joined_at = NOW()
        WHERE id = v_existing_membership_id;
    ELSE
        INSERT INTO public.family_group_members (group_id, user_id, role, is_active)
        VALUES (v_group_id, v_user_id, 'member', true);
    END IF;

    RETURN v_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_family_group()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_group_id uuid;
    v_is_owner boolean;
BEGIN
    SELECT group_id, (role = 'owner') INTO v_group_id, v_is_owner
    FROM public.family_group_members
    WHERE user_id = v_user_id AND is_active = true
    LIMIT 1;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'User is not in any family group';
    END IF;

    UPDATE public.family_group_members
    SET is_active = false
    WHERE user_id = v_user_id AND group_id = v_group_id AND is_active = true;

    IF v_is_owner THEN
        UPDATE public.family_groups SET is_active = false WHERE id = v_group_id;
        UPDATE public.family_group_members SET is_active = false WHERE group_id = v_group_id;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_family_member(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
    UPDATE public.family_group_members
    SET is_active = FALSE
    WHERE user_id = target_user_id;
END;
$function$;
