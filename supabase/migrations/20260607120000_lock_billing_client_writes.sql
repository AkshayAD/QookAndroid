-- Re-lock billing and entitlement tables after advisor cleanup migrations.
-- Clients may read their own billing state, but only trusted server/RPC paths
-- may mutate subscriptions, credits, purchases, bonuses, limits, or ledgers.

DROP POLICY IF EXISTS "Users manage own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users manage own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can insert own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can delete own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service can manage all credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits"
  ON public.user_credits
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users manage own purchases" ON public.credit_purchases;
DROP POLICY IF EXISTS "Users can view own purchases" ON public.credit_purchases;
CREATE POLICY "Users can view own purchases"
  ON public.credit_purchases
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own bonus log" ON public.weekly_bonus_log;
DROP POLICY IF EXISTS "Users can view own bonus log" ON public.weekly_bonus_log;
CREATE POLICY "Users can view own bonus log"
  ON public.weekly_bonus_log
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own rate limits" ON public.rate_limit_tracking;

DROP POLICY IF EXISTS "Users view own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_tracking;
CREATE POLICY "Users can view own usage"
  ON public.usage_tracking
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own billing intents" ON public.billing_payment_intents;
CREATE POLICY "Users can view own billing intents"
  ON public.billing_payment_intents
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own billing events" ON public.billing_payment_events;
CREATE POLICY "Users can view own billing events"
  ON public.billing_payment_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'user_subscriptions',
    'user_credits',
    'credit_purchases',
    'weekly_bonus_log',
    'rate_limit_tracking',
    'usage_tracking',
    'billing_payment_intents',
    'billing_payment_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM anon, authenticated', table_name);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'billing_webhook_events',
    'fact_subscription_events',
    'fact_generation_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TIMESTAMPTZ, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_razorpay_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_credits(UUID, TEXT, DECIMAL, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TIMESTAMPTZ, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_razorpay_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, TEXT, DECIMAL, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_window_minutes INTEGER DEFAULT 1,
  p_max_requests INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'check_rate_limit: cannot act for another user' USING ERRCODE = '42501';
  END IF;

  v_window_start := date_trunc('minute', NOW());
  
  -- Get or create rate limit record
  INSERT INTO public.rate_limit_tracking (user_id, action_type, window_start, request_count)
  VALUES (p_user_id, p_action_type, v_window_start, 1)
  ON CONFLICT (user_id, action_type, window_start) 
  DO UPDATE SET request_count = rate_limit_tracking.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  RETURN v_current_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;
