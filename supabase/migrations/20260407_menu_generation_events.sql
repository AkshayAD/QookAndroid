create table if not exists public.menu_generation_events (
    request_id uuid primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    family_group_id uuid references public.family_groups(id) on delete set null,
    week_start_date date not null,
    source text not null check (source in ('onboarding_auto', 'manual_generate')),
    created_at timestamptz not null default now()
);

create index if not exists idx_menu_generation_events_user_created_at
    on public.menu_generation_events (user_id, created_at desc);

alter table public.menu_generation_events enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'menu_generation_events'
          and policyname = 'Users can read their own menu generation events'
    ) then
        create policy "Users can read their own menu generation events"
            on public.menu_generation_events
            for select
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'menu_generation_events'
          and policyname = 'Users can insert their own menu generation events'
    ) then
        create policy "Users can insert their own menu generation events"
            on public.menu_generation_events
            for insert
            with check (auth.uid() = user_id);
    end if;
end
$$;
