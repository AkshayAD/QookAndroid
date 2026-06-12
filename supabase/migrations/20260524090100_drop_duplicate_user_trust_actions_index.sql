-- 20260524090100_drop_duplicate_user_trust_actions_index.sql
--
-- Resolves Supabase Performance Advisor duplicate_index warning:
-- user_trust_actions has two identical unique indexes on (user_id, action_type).
--
-- Keep idx_user_action_unique because live pg_stat_user_indexes showed it is
-- the index actually used by query plans. Drop the duplicate concurrently to
-- avoid blocking writes.
--
-- Important: DROP INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run this migration with tooling that does not wrap the file in BEGIN/COMMIT,
-- or run this statement separately after the policy migration.

DROP INDEX CONCURRENTLY IF EXISTS public.user_trust_actions_user_action_unique;
