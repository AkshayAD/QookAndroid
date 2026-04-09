CREATE OR REPLACE FUNCTION public.get_family_members_with_emails(p_group_id uuid)
RETURNS TABLE(
    id uuid,
    group_id uuid,
    user_id uuid,
    role text,
    joined_at timestamp with time zone,
    display_name text,
    email text
)
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
        m.role::text,
        m.joined_at,
        COALESCE(p.display_name, split_part(u.email, '@', 1))::text AS display_name,
        u.email::text AS email
    FROM public.family_group_members m
    LEFT JOIN public.user_profiles p ON p.id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.group_id = p_group_id
      AND COALESCE(m.is_active, TRUE) = TRUE
    ORDER BY m.joined_at ASC;
END;
$function$;
