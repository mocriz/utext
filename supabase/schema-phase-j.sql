-- ============================================================================
-- utext Phase J: perbaiki delete message + delete conversation logic
-- ============================================================================

-- RPC delete_message_for_me: tambah user ke deleted_for[] (handle NULL dengan benar)
create or replace function public.delete_message_for_me(msg_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.messages
    set deleted_for =
      case
        when deleted_for is null then array[auth.uid()]
        else array_append(deleted_for, auth.uid())
      end
    where id = msg_id;
end; $$;

-- helper: cek apakah user sudah hapus pesan (dipakai client-side visibility kalau perlu)
-- (tidak wajib, loadMessages sudah filter di client)
