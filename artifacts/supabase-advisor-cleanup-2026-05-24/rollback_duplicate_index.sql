-- Rollback for supabase/migrations/20260524090100_drop_duplicate_user_trust_actions_index.sql
--
-- Validate on a Supabase staging branch before using in production.
-- Important: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS user_trust_actions_user_action_unique
  ON public.user_trust_actions USING btree (user_id, action_type);
