-- 20260524090000_rls_policy_advisor_cleanup.sql
--
-- Resolves Supabase Performance Advisor warnings for auth RLS initplans and
-- multiple permissive policies while preserving application behavior.
--
-- Scope:
-- - Wrap stable auth helper calls in scalar subqueries so Postgres can initplan
--   them once per statement.
-- - Remove exact duplicate policies and dead `false` policies.
-- - Split broad ALL policies only where they overlap command-specific SELECT
--   policies and cause multiple-permissive-policy warnings.
--
-- Deliberately out of scope:
-- - Table grant cleanup.
-- - Routine grant cleanup.
-- - SECURITY DEFINER function changes.
-- - Application code changes.

BEGIN;

-- =====================================================
-- 1. Public/simple owner policies: preserve command/role behavior
-- =====================================================

ALTER POLICY "Service role only"
  ON public.backend_credits
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Users manage own purchases"
  ON public.credit_purchases
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own analytics"
  ON public.dim_users
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own transactions"
  ON public.fact_credit_transactions
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own events"
  ON public.fact_generation_events
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own subscription events"
  ON public.fact_subscription_events
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own feedback"
  ON public.feedback
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Authenticated users can insert feedback"
  ON public.feedback
  WITH CHECK ((select auth.uid()) IS NOT NULL);

ALTER POLICY "Users manage own grocery lists"
  ON public.grocery_list_history
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users manage own groceries"
  ON public.grocery_lists
  USING (user_id = (select auth.uid()));

ALTER POLICY "Users manage own history"
  ON public.meal_history
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users manage own rate limits"
  ON public.rate_limit_tracking
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users view own usage"
  ON public.usage_tracking
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users manage own profile"
  ON public.user_profiles
  USING ((select auth.uid()) = id);

ALTER POLICY "Users can manage own settings"
  ON public.user_settings
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users manage own template downloads"
  ON public.user_template_downloads
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can manage their own tokens"
  ON public.user_push_tokens
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users manage own bonus log"
  ON public.weekly_bonus_log
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- =====================================================
-- 2. JWT/admin lookup policies
-- =====================================================

ALTER POLICY "Admins can view deleted users"
  ON public.deleted_users
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.email = ((select auth.jwt()) ->> 'email'::text)
    )
  );

ALTER POLICY "Admins can view test account reset log"
  ON public.test_account_reset_log
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE lower(admin_users.email) = lower(((select auth.jwt()) ->> 'email'::text))
    )
  );

-- =====================================================
-- 3. Family, grocery, inventory, and preference sharing
-- =====================================================

ALTER POLICY "Family members can log activity"
  ON public.family_activity
  WITH CHECK (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = (select auth.uid())
    )
  );

ALTER POLICY "Family members can view activity"
  ON public.family_activity
  USING (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = (select auth.uid())
    )
  );

ALTER POLICY "Family members can contribute"
  ON public.family_credit_contributions
  WITH CHECK (
    contributor_id = (select auth.uid())
    AND group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = (select auth.uid())
    )
  );

ALTER POLICY "Family members can view contributions"
  ON public.family_credit_contributions
  USING (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = (select auth.uid())
    )
  );

ALTER POLICY "Family members can view credit pool"
  ON public.family_credit_pool
  USING (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Simple member view" ON public.family_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.family_group_members;

ALTER POLICY "Member self access"
  ON public.family_group_members
  USING (user_id = (select auth.uid()));

ALTER POLICY "Member can delete self"
  ON public.family_group_members
  USING (user_id = (select auth.uid()));

ALTER POLICY "Users can join groups"
  ON public.family_group_members
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Owner manages group" ON public.family_groups;
DROP POLICY IF EXISTS "Members can view their group" ON public.family_groups;

CREATE POLICY "Members can view their group"
  ON public.family_groups
  FOR SELECT
  TO public
  USING (
    owner_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.family_group_members fgm
      WHERE fgm.group_id = family_groups.id
        AND fgm.user_id = (select auth.uid())
        AND fgm.is_active = true
    )
  );

CREATE POLICY "Owner can create group"
  ON public.family_groups
  FOR INSERT
  TO public
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "Owner can update group"
  ON public.family_groups
  FOR UPDATE
  TO public
  USING (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "Owner can delete group"
  ON public.family_groups
  FOR DELETE
  TO public
  USING (owner_id = (select auth.uid()));

ALTER POLICY "grocery_items_access"
  ON public.grocery_items
  USING (
    (select auth.uid()) = user_id
    OR family_group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = (select auth.uid())
        AND family_group_members.is_active = true
    )
  );

ALTER POLICY "Users and family manage inventory items"
  ON public.inventory_items
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = (select auth.uid())
      )
    )
  );

ALTER POLICY "Users and family manage preference signals"
  ON public.preference_signals
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = (select auth.uid())
      )
    )
  );

-- =====================================================
-- 4. Menu, recipes, referrals, weekly planning
-- =====================================================

ALTER POLICY "Users can insert their own menu generation events"
  ON public.menu_generation_events
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can read their own menu generation events"
  ON public.menu_generation_events
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete their own recently viewed recipes"
  ON public.recently_viewed_recipes
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert their own recently viewed recipes"
  ON public.recently_viewed_recipes
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update their own recently viewed recipes"
  ON public.recently_viewed_recipes
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view their own recently viewed recipes"
  ON public.recently_viewed_recipes
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can create their own referral code"
  ON public.referral_codes
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update their own referral code"
  ON public.referral_codes
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view their own referral code"
  ON public.referral_codes
  USING ((select auth.uid()) = user_id);

ALTER POLICY "System can create referrals"
  ON public.referrals
  WITH CHECK ((select auth.uid()) = referee_id);

ALTER POLICY "Users can view referrals they made or received"
  ON public.referrals
  USING ((select auth.uid()) = referrer_id OR (select auth.uid()) = referee_id);

ALTER POLICY "Users can save recipes"
  ON public.saved_recipes
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can unsave recipes"
  ON public.saved_recipes
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own saved recipes"
  ON public.saved_recipes
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own and family meals"
  ON public.scheduled_meals
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = scheduled_meals.family_group_id
          AND fgm.user_id = (select auth.uid())
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can insert own meals"
  ON public.scheduled_meals
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can update own and family meals"
  ON public.scheduled_meals
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = scheduled_meals.family_group_id
          AND fgm.user_id = (select auth.uid())
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can view own and family meals"
  ON public.scheduled_meals
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = scheduled_meals.family_group_id
          AND fgm.user_id = (select auth.uid())
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can delete own and family plans"
  ON public.weekly_plans
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = weekly_plans.family_group_id
          AND fgm.user_id = (select auth.uid())
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can insert own plans"
  ON public.weekly_plans
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can update own and family plans"
  ON public.weekly_plans
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = weekly_plans.family_group_id
          AND fgm.user_id = (select auth.uid())
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can view own and family plans"
  ON public.weekly_plans
  USING (
    user_id = (select auth.uid())
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = weekly_plans.family_group_id
          AND fgm.user_id = (select auth.uid())
          AND fgm.is_active = true
      )
    )
  );

-- =====================================================
-- 5. Multiple permissive policy cleanup
-- =====================================================

DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Admins can insert app settings"
  ON public.app_settings
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update app settings"
  ON public.app_settings
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete app settings"
  ON public.app_settings
  FOR DELETE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Templates accessible via service role only" ON public.custom_templates;

DROP POLICY IF EXISTS "Only super admins can modify settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Only super admins can view settings" ON public.platform_settings;

CREATE POLICY "Only super admins can view settings"
  ON public.platform_settings
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role = 'super_admin'::text
    )
  );

CREATE POLICY "Only super admins can insert settings"
  ON public.platform_settings
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role = 'super_admin'::text
    )
  );

CREATE POLICY "Only super admins can update settings"
  ON public.platform_settings
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role = 'super_admin'::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role = 'super_admin'::text
    )
  );

CREATE POLICY "Only super admins can delete settings"
  ON public.platform_settings
  FOR DELETE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = (select auth.uid())
        AND admin_users.role = 'super_admin'::text
    )
  );

DROP POLICY IF EXISTS "Users can view own profiles" ON public.preference_profiles;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.preference_profiles;

ALTER POLICY "Users can manage own profiles"
  ON public.preference_profiles
  USING ((select auth.uid()) = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Service can manage all credits" ON public.user_credits;

ALTER POLICY "Users can insert own credits"
  ON public.user_credits
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own credits"
  ON public.user_credits
  USING ((select auth.uid()) = user_id AND deleted_at IS NULL);

ALTER POLICY "Users can view own credits"
  ON public.user_credits
  USING ((select auth.uid()) = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users manage own subscription" ON public.user_subscriptions;

ALTER POLICY "Users can view own subscription"
  ON public.user_subscriptions
  USING ((select auth.uid()) = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions
  FOR INSERT
  TO public
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions
  FOR UPDATE
  TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own subscription"
  ON public.user_subscriptions
  FOR DELETE
  TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own drafts" ON public.weekly_drafts;

ALTER POLICY "Users can manage own drafts"
  ON public.weekly_drafts
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- 6. Device and trust-action policies
-- =====================================================

ALTER POLICY "Allow device updates"
  ON public.user_devices
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own devices"
  ON public.user_devices
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can record trust actions"
  ON public.user_trust_actions
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own trust actions"
  ON public.user_trust_actions
  USING ((select auth.uid()) = user_id);

COMMIT;
