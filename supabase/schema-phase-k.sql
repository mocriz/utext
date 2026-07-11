-- ============================================================================
-- utext Phase K: RPC yang kurang + fix delete conversation for all
-- ============================================================================

-- 1. soft_delete_account: tandai deleted_at, display 'Deleted Account', lock username
create or replace function public.soft_delete_account()
returns void language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
begin
  update public.profiles
    set deleted_at = now(), display_name = 'Deleted Account'
    where id = uid;
end; $$;

-- 2. delete_message_for_me (phase-j)
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

-- 3. delete_conversation_for_all: hapus messages + members + conversation
--    (lawan kehilangan semua chat + room)
create or replace function public.delete_conversation_for_all(conv_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from public.messages where conversation_id = conv_id;
  delete from public.conversation_members where conversation_id = conv_id;
  delete from public.conversations where id = conv_id;
end; $$;

grant execute on function public.soft_delete_account() to authenticated;
grant execute on function public.delete_message_for_me(uuid) to authenticated;
grant execute on function public.delete_conversation_for_all(uuid) to authenticated;
