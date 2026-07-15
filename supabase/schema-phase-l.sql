-- ============================================================================
-- utext Phase L: soft delete = reset identitas kita, lawan tetap baca chat lama
-- ============================================================================

-- soft_delete_account:
--   * deleted_at        = now()              (lawan lihat "Deleted Account")
--   * display_name      = 'Deleted Account'
--   * username          = NULL               (dibikin baru pas daftar ulang)
--   * key_backed_up     = false
--   * public_key        = NULL               (force "user baru" pas daftar ulang ->
--                                              ensureIdentity generate keypair baru, mulai dari nol)
-- private key lokal + file Drive dihapus dari sisi client (lihat auth.js / driveBackup.js)
-- Lawan yang SUDAH pernah chat tetap bisa decrypt chat lama (public_key sudah di-cache di client).
create or replace function public.soft_delete_account()
returns void language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
begin
  update public.profiles
    set deleted_at = now(),
        display_name = 'Deleted Account',
        username = null,
        key_backed_up = false,
        public_key = null
    where id = uid;
end; $$;

grant execute on function public.soft_delete_account() to authenticated;
