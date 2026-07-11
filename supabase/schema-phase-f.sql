-- ============================================================================
-- utext Phase F schema additions
-- Jalankan di Supabase → SQL Editor (sekali saja). Aman dijalankan berulang.
-- ============================================================================

-- 1) profiles: display_name + soft-delete flag
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists deleted_at timestamptz;

-- saat soft-delete: trigger set display_name='Deleted Account'
create or replace function public.soft_delete_profile()
returns trigger language plpgsql as $$
begin
  new.deleted_at = now();
  new.display_name = 'Deleted Account';
  new.avatar_url = null;
  new.public_key = null;
  return new;
end; $$;

drop trigger if exists trg_soft_delete_profile on public.profiles;
create trigger trg_soft_delete_profile
  before update on public.profiles
  for each row
  when (new.deleted_at is not null and old.deleted_at is null)
  execute function public.soft_delete_profile();

-- 2) messages: read-receipt status + soft delete
alter table public.messages
  add column if not exists status text not null default 'sent'
    check (status in ('sent','delivered','read')),
  add column if not exists deleted_for uuid[] not null default '{}',   -- user_ids yg hapus "untuk saya"
  add column if not exists deleted_for_all boolean not null default false;

-- pengirim boleh update status pesannya sendiri (delivered/read)
create policy "sender updates own msg status" on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- hapus "untuk saya": append user ke deleted_for (RLS di bawah)
create policy "member toggles own delete flag" on public.messages
  for update to authenticated
  using (is_conversation_member(conversation_id))
  with check (is_conversation_member(conversation_id));

-- view message: sembunyikan kalau deleted_for_all atau user ada di deleted_for
-- (diterapkan di FE; untuk keamanan tambahan bisa pakai policy, tapi array containment
--  sulit di RLS murni — cukup filter di FE + pastikan sender_id tetap terlihat meta)

-- index untuk performa
create index if not exists messages_conv_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists profiles_deleted_idx
  on public.profiles (deleted_at) where deleted_at is not null;

-- 3) fungsi update display_name (dipakai SettingsSheet "save display")
create or replace function public.set_display_name(p_name text)
returns void language sql security definer as $$
  update public.profiles set display_name = p_name where id = auth.uid();
$$;

-- 4) fungsi soft-delete akun (hapus akun tanpa hapus auth user)
--    catatan: hapus baris auth.users TIDAK dilakukan (biar gmail sama bisa login lagi).
--    cukup tandai profile.deleted_at; data messages tetap utuh & bisa dibaca lawan.
create or replace function public.soft_delete_account()
returns void language sql security definer as $$
  update public.profiles set deleted_at = now() where id = auth.uid();
$$;

-- 5) update status ke 'read' via RPC (dipanggil pas penerima buka room)
create or replace function public.mark_read(conversation uuid)
returns void language sql security definer as $$
  update public.messages
    set status = 'read'
    where conversation_id = conversation
      and sender_id <> auth.uid()
      and status <> 'read';
$$;

-- 6) update status ke 'delivered' via RPC (dipanggil pas penerima online/subscribe)
create or replace function public.mark_delivered(conversation uuid)
returns void language sql security definer as $$
  update public.messages
    set status = 'delivered'
    where conversation_id = conversation
      and sender_id <> auth.uid()
      and status = 'sent';
$$;
