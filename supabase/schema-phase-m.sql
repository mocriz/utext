-- ============================================================================
-- utext Phase M: reset total pas daftar ulang (akun yang pernah di-soft-delete)
-- Bersihin sisa identitas lama biar user mulai dari nol:
--   * hapus conversation_members kita -> tidak lihat chat lama
--   * clear deleted_at + display_name + username + public_key + key_backed_up
-- Lawan TETAP pegang membership + messages mereka -> tetap baca chat lama.
-- ============================================================================
create or replace function public.reset_my_account()
returns void language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
begin
  delete from public.conversation_members where user_id = uid;
  update public.profiles
    set deleted_at = null,
        display_name = '',
        username = null,
        public_key = null,
        key_backed_up = false
    where id = uid;
end; $$;

grant execute on function public.reset_my_account() to authenticated;
