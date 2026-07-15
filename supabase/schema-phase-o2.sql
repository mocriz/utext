-- ============================================================================
-- utext Phase O2: RPC fetch profil user lain (bypass RLS)
-- Dipakai listConversations() supaya nama muncul meski RLS select biasa blokir.
-- Aman: cuma return field publik (username, display_name, avatar_url, id).
-- ============================================================================
create or replace function public.get_profiles_by_ids(ids uuid[])
returns table (
  id uuid, username text, display_name text, avatar_url text
) language sql security definer as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where p.id = any(ids)
$$;
grant execute on function public.get_profiles_by_ids(uuid[]) to authenticated;
