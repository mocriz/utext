-- ============================================================================
-- utext Phase O: RLS profiles — izinkan user lain dibaca (buat chat list)
-- Tanpa ini, listConversations() gagal fetch username/display_name user lain
-- -> nama di ChatHeader & ChatListItem kosong.
-- E2EE tetap aman: private key TIDAK ada di profiles.
-- ============================================================================

-- pastikan RLS nyala
alter table public.profiles enable row level security;

-- semua user ter-auth boleh BACA profil (username, display_name, avatar, public_key)
drop policy if exists "profiles readable by all authed" on public.profiles;
create policy "profiles readable by all authed"
  on public.profiles for select
  to authenticated
  using (true);

-- user cuma boleh UPDATE profil SENDIRI
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user cuma boleh INSERT profil sendiri (trigger handle_new_user biasanya yg bikin,
-- tapi jaga-jaga kalau ada path insert manual)
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
