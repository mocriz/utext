-- ============================================================================
-- utext Phase H: delete message / receipt / profile wiring
-- ============================================================================

-- 1) RPC: hapus pesan "untuk saya" (append user ke deleted_for[])
create or replace function public.delete_message_for_me(msg_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.messages
    set deleted_for = array_append(deleted_for, auth.uid())
    where id = msg_id;
end; $$;

-- 2) avatars bucket (public) + policy
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars own rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) pastikan RPC dari phase-f ada (idempotent)
create or replace function public.mark_read(conversation uuid)
returns void language sql security definer as $$
  update public.messages
    set status = 'read'
    where conversation_id = conversation
      and sender_id <> auth.uid()
      and status <> 'read';
$$;

create or replace function public.mark_delivered(conversation uuid)
returns void language sql security definer as $$
  update public.messages
    set status = 'delivered'
    where conversation_id = conversation
      and sender_id <> auth.uid()
      and status = 'sent';
$$;

create or replace function public.set_display_name(p_name text)
returns void language sql security definer as $$
  update public.profiles set display_name = p_name where id = auth.uid();
$$;

create or replace function public.soft_delete_account()
returns void language sql security definer as $$
  update public.profiles set deleted_at = now() where id = auth.uid();
$$;
