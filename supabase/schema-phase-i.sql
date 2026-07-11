-- ============================================================================
-- utext: relax search_users ke minimal 1 char + username availability helper
-- ============================================================================

-- ganti search_users biar bisa cari 1 huruf
create or replace function public.search_users(q text)
returns table (
  id uuid, username text, display_name text, avatar_url text
) language sql security definer as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where p.deleted_at is null
    and length(coalesce(q, '')) >= 1
    and (
      p.username ilike '%' || q || '%'
      or coalesce(p.display_name, '') ilike '%' || q || '%'
    )
  order by
    case when p.username ilike q then 0 else 1 end,
    p.username
  limit 20;
$$;
