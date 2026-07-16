-- sql/bot_trigger.sql
-- Re-create trigger buat panggil Edge Function bot-reply tiap INSERT ke messages.
-- Jalanin ini SETELAP bot_setup.sql (atau sekali aja cukup, idempotent).
--
-- PENTING: ganti <ANON_KEY_LU> dengan anon key dari Dashboard > Settings > API
-- (key yang mulai "eyJ..."). Tanpa ini Edge Function nolak 401.

create or replace function public.notify_bot_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- anti echo loop: jangan panggil function kalau yg insert adalah bot sendiri
  if NEW.sender_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' then
    return null;
  end if;
  perform net.http_post(
    url := 'https://sgmiqkqigfmwgiajaqvo.supabase.co/functions/v1/bot-reply',
    body := json_build_object('record', row_to_json(NEW))::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY_LU>'
    ),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  -- jangan gagalkan INSERT kalau HTTP call gagal
  return null;
end;
$$;

drop trigger if exists messages_after_insert_call_bot on public.messages;
create trigger messages_after_insert_call_bot
  after insert on public.messages
  for each row
  execute function public.notify_bot_on_message();
