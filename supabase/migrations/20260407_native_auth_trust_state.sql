alter table public.user_settings
    add column if not exists tour_completed_at timestamptz;

update public.user_settings
set tour_completed_at = coalesce(tour_completed_at, now())
where onboarding_completed = true;

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, action_type
            order by completed_at asc nulls last, id asc
        ) as row_num
    from public.user_trust_actions
)
delete from public.user_trust_actions
where id in (
    select id
    from ranked
    where row_num > 1
);

create unique index if not exists user_trust_actions_user_action_unique
    on public.user_trust_actions (user_id, action_type);

create or replace function public.complete_trust_action_once(
    p_action_type text,
    p_metadata jsonb default '{}'::jsonb
)
returns table (
    already_completed boolean,
    credits_awarded integer,
    completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_credits integer;
    v_completed_at timestamptz;
    v_action_id uuid;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    v_credits := case p_action_type
        when 'signup' then 2
        when 'complete_profile' then 1
        when 'add_phone' then 2
        when 'generate_second_menu' then 1
        when 'share_menu_commands' then 1
        when 'install_pwa' then 1
        else null
    end;

    if v_credits is null then
        raise exception 'Unsupported trust action: %', p_action_type;
    end if;

    insert into public.user_trust_actions (
        user_id,
        action_type,
        credits_awarded,
        completed_at,
        metadata
    )
    values (
        v_user_id,
        p_action_type,
        v_credits,
        now(),
        coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id, action_type) do nothing
    returning id, user_trust_actions.completed_at
    into v_action_id, v_completed_at;

    if v_action_id is null then
        return query
        select
            true,
            0,
            existing.completed_at
        from public.user_trust_actions as existing
        where existing.user_id = v_user_id
          and existing.action_type = p_action_type
        limit 1;
        return;
    end if;

    insert into public.user_credits (
        user_id,
        credit_type,
        credits,
        meal_credits,
        expires_at,
        metadata
    )
    values (
        v_user_id,
        'bonus',
        v_credits,
        v_credits,
        now() + interval '28 days',
        jsonb_build_object(
            'source', 'trust_action',
            'action_type', p_action_type,
            'trust_action_id', v_action_id
        ) || coalesce(p_metadata, '{}'::jsonb)
    );

    return query select false, v_credits, v_completed_at;
end;
$$;

create or replace function public.record_menu_generation_and_maybe_award_second_menu(
    p_request_id uuid,
    p_week_start_date date,
    p_source text,
    p_family_group_id uuid default null
)
returns table (
    event_recorded boolean,
    milestone_count integer,
    credits_awarded integer,
    already_completed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_event_recorded boolean := false;
    v_row_count integer := 0;
    v_durable_count integer := 0;
    v_legacy_count integer := 0;
    v_has_onboarding_completed boolean := false;
    v_has_saved_schedule boolean := false;
    v_onboarding_baseline integer := 0;
    v_award_row record;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if p_source not in ('onboarding_auto', 'manual_generate') then
        raise exception 'Unsupported generation source: %', p_source;
    end if;

    insert into public.menu_generation_events (
        request_id,
        user_id,
        family_group_id,
        week_start_date,
        source
    )
    values (
        p_request_id,
        v_user_id,
        p_family_group_id,
        p_week_start_date,
        p_source
    )
    on conflict (request_id) do nothing;

    get diagnostics v_row_count = row_count;
    v_event_recorded := v_row_count > 0;

    select count(*)::integer
    into v_durable_count
    from public.menu_generation_events
    where user_id = v_user_id;

    select count(*)::integer
    into v_legacy_count
    from public.weekly_plans
    where user_id = v_user_id;

    select coalesce((
        select settings.onboarding_completed
        from public.user_settings as settings
        where settings.user_id = v_user_id
    ), false)
    into v_has_onboarding_completed;

    select exists(
        select 1
        from public.scheduled_meals
        where user_id = v_user_id
    )
    into v_has_saved_schedule;

    if v_durable_count = 0 and v_legacy_count = 0 and v_has_onboarding_completed and v_has_saved_schedule then
        v_onboarding_baseline := 1;
    end if;

    milestone_count := greatest(v_durable_count, v_legacy_count, v_onboarding_baseline);
    credits_awarded := 0;
    already_completed := false;

    if milestone_count >= 2 then
        select *
        into v_award_row
        from public.complete_trust_action_once(
            'generate_second_menu',
            jsonb_build_object(
                'request_id', p_request_id,
                'week_start_date', p_week_start_date,
                'source', p_source,
                'family_group_id', p_family_group_id
            )
        );

        credits_awarded := coalesce(v_award_row.credits_awarded, 0);
        already_completed := coalesce(v_award_row.already_completed, false);
    end if;

    event_recorded := v_event_recorded;
    return next;
end;
$$;

grant execute on function public.complete_trust_action_once(text, jsonb) to authenticated;
grant execute on function public.record_menu_generation_and_maybe_award_second_menu(uuid, date, text, uuid) to authenticated;
