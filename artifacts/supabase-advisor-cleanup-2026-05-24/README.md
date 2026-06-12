# Supabase Advisor Cleanup Snapshot - 2026-05-24

This snapshot was taken from the live Supabase project before authoring the
advisor cleanup migrations in this branch. It is intentionally compact: the
full live state should still be exported from Supabase before applying the
migrations to a staging branch or production.

## Advisor Classes Covered

- `auth_rls_initplan`
- `multiple_permissive_policies`
- `duplicate_index`

## Guardrails Preserved

- No table grants are revoked in this pass.
- No routine grants are revoked in this pass.
- No `SECURITY DEFINER` function bodies are changed in this pass.
- No application code is changed in this pass.
- Existing direct client write policies for `user_subscriptions` and
  `user_credits` are preserved.
- Service-role paths continue to rely on Supabase service-role RLS bypass.

## Live Checks Performed

The following live metadata queries were reviewed through the Supabase
connector before writing migrations:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ~ 'auth\.|current_setting'
    or coalesce(with_check, '') ~ 'auth\.|current_setting'
  )
order by tablename, policyname;
```

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

```sql
select grantor, grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
order by table_name, grantee, privilege_type;
```

```sql
select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
order by routine_name, grantee;
```

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'user_trust_actions'
  and indexname in ('idx_user_action_unique', 'user_trust_actions_user_action_unique')
order by indexname;
```

```sql
select indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
from pg_stat_user_indexes
where schemaname = 'public'
  and relname = 'user_trust_actions'
  and indexrelname in ('idx_user_action_unique', 'user_trust_actions_user_action_unique')
order by indexrelname;
```

## Snapshot Findings

- RLS was enabled on the reviewed `public` tables.
- The reviewed flagged policies used `auth.uid()`, `auth.jwt()`, or
  `auth.role()` directly; no `current_setting()` policy usage was found.
- `idx_user_action_unique` and `user_trust_actions_user_action_unique` are
  identical unique indexes on `(user_id, action_type)`.
- Live index stats favored keeping `idx_user_action_unique`:
  - `idx_user_action_unique`: `idx_scan = 2325`
  - `user_trust_actions_user_action_unique`: `idx_scan = 8`
- Broad table grants and function grants were confirmed as separate hardening
  work and intentionally left untouched by this advisor cleanup.
