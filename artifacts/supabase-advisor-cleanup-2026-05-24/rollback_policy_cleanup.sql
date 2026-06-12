-- Rollback for supabase/migrations/20260524090000_rls_policy_advisor_cleanup.sql
--
-- Validate on a Supabase staging branch before using in production.
-- This restores the pre-cleanup policy structure captured on 2026-05-24.

BEGIN;

ALTER POLICY "Service role only"
  ON public.backend_credits
  USING (auth.role() = 'service_role'::text);

ALTER POLICY "Users manage own purchases"
  ON public.credit_purchases
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own analytics"
  ON public.dim_users
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own transactions"
  ON public.fact_credit_transactions
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own events"
  ON public.fact_generation_events
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own subscription events"
  ON public.fact_subscription_events
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own feedback"
  ON public.feedback
  USING (auth.uid() = user_id);

ALTER POLICY "Authenticated users can insert feedback"
  ON public.feedback
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER POLICY "Users manage own grocery lists"
  ON public.grocery_list_history
  USING (auth.uid() = user_id);

ALTER POLICY "Users manage own groceries"
  ON public.grocery_lists
  USING (user_id = auth.uid());

ALTER POLICY "Users manage own history"
  ON public.meal_history
  USING (auth.uid() = user_id);

ALTER POLICY "Users manage own rate limits"
  ON public.rate_limit_tracking
  USING (auth.uid() = user_id);

ALTER POLICY "Users view own usage"
  ON public.usage_tracking
  USING (auth.uid() = user_id);

ALTER POLICY "Users manage own profile"
  ON public.user_profiles
  USING (auth.uid() = id);

ALTER POLICY "Users can manage own settings"
  ON public.user_settings
  USING (auth.uid() = user_id);

ALTER POLICY "Users manage own template downloads"
  ON public.user_template_downloads
  USING (auth.uid() = user_id);

ALTER POLICY "Users can manage their own tokens"
  ON public.user_push_tokens
  USING (auth.uid() = user_id);

ALTER POLICY "Users manage own bonus log"
  ON public.weekly_bonus_log
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Admins can view deleted users"
  ON public.deleted_users
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.email = (auth.jwt() ->> 'email'::text)
    )
  );

ALTER POLICY "Admins can view test account reset log"
  ON public.test_account_reset_log
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE lower(admin_users.email) = lower((auth.jwt() ->> 'email'::text))
    )
  );

ALTER POLICY "Family members can log activity"
  ON public.family_activity
  WITH CHECK (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = auth.uid()
    )
  );

ALTER POLICY "Family members can view activity"
  ON public.family_activity
  USING (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = auth.uid()
    )
  );

ALTER POLICY "Family members can contribute"
  ON public.family_credit_contributions
  WITH CHECK (
    contributor_id = auth.uid()
    AND group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = auth.uid()
    )
  );

ALTER POLICY "Family members can view contributions"
  ON public.family_credit_contributions
  USING (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = auth.uid()
    )
  );

ALTER POLICY "Family members can view credit pool"
  ON public.family_credit_pool
  USING (
    group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Simple member view" ON public.family_group_members;
CREATE POLICY "Simple member view"
  ON public.family_group_members
  FOR SELECT
  TO public
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can leave groups" ON public.family_group_members;
CREATE POLICY "Users can leave groups"
  ON public.family_group_members
  FOR DELETE
  TO public
  USING (user_id = auth.uid());

ALTER POLICY "Member self access"
  ON public.family_group_members
  USING (user_id = auth.uid());

ALTER POLICY "Member can delete self"
  ON public.family_group_members
  USING (user_id = auth.uid());

ALTER POLICY "Users can join groups"
  ON public.family_group_members
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner can create group" ON public.family_groups;
DROP POLICY IF EXISTS "Owner can update group" ON public.family_groups;
DROP POLICY IF EXISTS "Owner can delete group" ON public.family_groups;
DROP POLICY IF EXISTS "Members can view their group" ON public.family_groups;

CREATE POLICY "Members can view their group"
  ON public.family_groups
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_group_members fgm
      WHERE fgm.group_id = family_groups.id
        AND fgm.user_id = auth.uid()
        AND fgm.is_active = true
    )
  );

CREATE POLICY "Owner manages group"
  ON public.family_groups
  FOR ALL
  TO public
  USING (owner_id = auth.uid());

ALTER POLICY "grocery_items_access"
  ON public.grocery_items
  USING (
    auth.uid() = user_id
    OR family_group_id IN (
      SELECT family_group_members.group_id
      FROM public.family_group_members
      WHERE family_group_members.user_id = auth.uid()
        AND family_group_members.is_active = true
    )
  );

ALTER POLICY "Users and family manage inventory items"
  ON public.inventory_items
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = auth.uid()
      )
    )
  );

ALTER POLICY "Users and family manage preference signals"
  ON public.preference_signals
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND family_group_id IN (
        SELECT family_group_members.group_id
        FROM public.family_group_members
        WHERE family_group_members.user_id = auth.uid()
      )
    )
  );

ALTER POLICY "Users can insert their own menu generation events"
  ON public.menu_generation_events
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users can read their own menu generation events"
  ON public.menu_generation_events
  USING (auth.uid() = user_id);

ALTER POLICY "Users can delete their own recently viewed recipes"
  ON public.recently_viewed_recipes
  USING (auth.uid() = user_id);

ALTER POLICY "Users can insert their own recently viewed recipes"
  ON public.recently_viewed_recipes
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users can update their own recently viewed recipes"
  ON public.recently_viewed_recipes
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view their own recently viewed recipes"
  ON public.recently_viewed_recipes
  USING (auth.uid() = user_id);

ALTER POLICY "Users can create their own referral code"
  ON public.referral_codes
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users can update their own referral code"
  ON public.referral_codes
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view their own referral code"
  ON public.referral_codes
  USING (auth.uid() = user_id);

ALTER POLICY "System can create referrals"
  ON public.referrals
  WITH CHECK (auth.uid() = referee_id);

ALTER POLICY "Users can view referrals they made or received"
  ON public.referrals
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

ALTER POLICY "Users can save recipes"
  ON public.saved_recipes
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users can unsave recipes"
  ON public.saved_recipes
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own saved recipes"
  ON public.saved_recipes
  USING (auth.uid() = user_id);

ALTER POLICY "Users can delete own and family meals"
  ON public.scheduled_meals
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = scheduled_meals.family_group_id
          AND fgm.user_id = auth.uid()
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can insert own meals"
  ON public.scheduled_meals
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users can update own and family meals"
  ON public.scheduled_meals
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = scheduled_meals.family_group_id
          AND fgm.user_id = auth.uid()
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can view own and family meals"
  ON public.scheduled_meals
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = scheduled_meals.family_group_id
          AND fgm.user_id = auth.uid()
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can delete own and family plans"
  ON public.weekly_plans
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = weekly_plans.family_group_id
          AND fgm.user_id = auth.uid()
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can insert own plans"
  ON public.weekly_plans
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users can update own and family plans"
  ON public.weekly_plans
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = weekly_plans.family_group_id
          AND fgm.user_id = auth.uid()
          AND fgm.is_active = true
      )
    )
  );

ALTER POLICY "Users can view own and family plans"
  ON public.weekly_plans
  USING (
    user_id = auth.uid()
    OR (
      family_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.family_group_members fgm
        WHERE fgm.group_id = weekly_plans.family_group_id
          AND fgm.user_id = auth.uid()
          AND fgm.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete app settings" ON public.app_settings;

CREATE POLICY "Admins can update app settings"
  ON public.app_settings
  FOR ALL
  TO public
  USING (true);

CREATE POLICY "Templates accessible via service role only"
  ON public.custom_templates
  FOR ALL
  TO public
  USING (false);

DROP POLICY IF EXISTS "Only super admins can view settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Only super admins can insert settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Only super admins can update settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Only super admins can delete settings" ON public.platform_settings;

CREATE POLICY "Only super admins can view settings"
  ON public.platform_settings
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'super_admin'::text
    )
  );

CREATE POLICY "Only super admins can modify settings"
  ON public.platform_settings
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'super_admin'::text
    )
  );

DROP POLICY IF EXISTS "Users can view own profiles" ON public.preference_profiles;
CREATE POLICY "Users can view own profiles"
  ON public.preference_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users manage own preferences" ON public.preference_profiles;
CREATE POLICY "Users manage own preferences"
  ON public.preference_profiles
  FOR ALL
  TO public
  USING (auth.uid() = user_id);

ALTER POLICY "Users can manage own profiles"
  ON public.preference_profiles
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Service can manage all credits"
  ON public.user_credits
  FOR ALL
  TO public
  USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR (CURRENT_USER = 'postgres'::name));

ALTER POLICY "Users can insert own credits"
  ON public.user_credits
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users can update own credits"
  ON public.user_credits
  USING (auth.uid() = user_id AND deleted_at IS NULL);

ALTER POLICY "Users can view own credits"
  ON public.user_credits
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.user_subscriptions;

CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own subscription"
  ON public.user_subscriptions
  FOR ALL
  TO public
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own subscription"
  ON public.user_subscriptions
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view own drafts" ON public.weekly_drafts;
CREATE POLICY "Users can view own drafts"
  ON public.weekly_drafts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

ALTER POLICY "Users can manage own drafts"
  ON public.weekly_drafts
  USING (auth.uid() = user_id);

ALTER POLICY "Allow device updates"
  ON public.user_devices
  USING (auth.uid() = user_id);

ALTER POLICY "Users can view own devices"
  ON public.user_devices
  USING (auth.uid() = user_id);

ALTER POLICY "Users can record trust actions"
  ON public.user_trust_actions
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users can view own trust actions"
  ON public.user_trust_actions
  USING (auth.uid() = user_id);

COMMIT;
