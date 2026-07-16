-- ============================================================
-- utext AI bot setup (Model A: server decrypt -> OpenRouter -> encrypt)
-- Jalankan di Supabase Dashboard > SQL Editor (role postgres).
-- Setelah ini: set secret BOT_PRIVATE_KEY & BOT_USER_ID di
--   Dashboard > Edge Functions > Secrets (lihat bawah).
-- ============================================================

-- 1) config singleton (isi free-text, bisa di-UPDATE kapan aja)
create table if not exists public.bot_config (
  id            int primary key default 1,
  bot_user_id  uuid not null,
  openrouter_api_key    text not null,
  openrouter_endpoint   text not null default 'https://openrouter.ai/api/v1/chat/completions',
  openrouter_model      text not null default 'tencent/hunyuan-turbos:free',
  system_prompt         text not null default 'Kamu adalah asisten AI bernama "Asisten AI". Jawab singkat, jelas, dan ramah dalam bahasa Indonesia kecuali diminta lain.',
  max_tokens            int  not null default 800,
  updated_at            timestamptz not null default now()
);

-- RLS: nobody (anon/auth) can read -> cuma service_role (Edge Fn) yg baca
alter table public.bot_config enable row level security;
drop policy if exists bot_config_no_read on public.bot_config;
create policy bot_config_no_read on public.bot_config
  for select using (false);  -- deny semua (service_role bypass RLS)

-- 2) bot identity: auth.users + profiles + conversation_members
do $$
declare
  bot_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  bot_pub text := 'xx_S41xCUOdoyALh5y_L2XaKKqX0pfGyvkezJXIHJWE';
begin
  -- auth.users (dummy, gak pernah login)
  if not exists (select 1 from auth.users where id = bot_id) then
    insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_sent_at, is_sso_user, encrypted_password)
    values (bot_id, 'bot@utext.local', '{"provider":"email"}', '{}', now(), now(), now(), false, '')
    on conflict (id) do nothing;
  end if;

  -- profiles
  insert into public.profiles (id, display_name, username, public_key, setup_done, created_at)
  values (bot_id, 'Asisten AI', 'asisten_ai', bot_pub, true, now())
  on conflict (id) do update set display_name = excluded.display_name,
                                  username     = excluded.username,
                                  public_key   = excluded.public_key,
                                  setup_done   = true;

  -- seed config row (id=1). Ganti api_key di sini / via UPDATE sesudah.
  insert into public.bot_config (id, bot_user_id, openrouter_api_key)
  values (1, bot_id, 'ISI_API_KEY_OPENROUTER_LU_DISINI')
  on conflict (id) do update set bot_user_id = excluded.bot_user_id;
end $$;

-- 3) webhook handler: jangan proses pesan dari bot sendiri (anti echo loop)
--    (webhook DB di-set di Dashboard > Database > Webhooks, lihat README)
--    Function ini cuma guard; logic utama ada di Edge Function bot-reply.

-- helper untuk cek apakah sender = bot (dipakai Edge Fn via query, optional)
create or replace function public.is_bot_user(u uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.bot_config where bot_user_id = u)
$$;

comment on table public.bot_config is
'Konfigurasi AI bot. Edit lewat UPDATE di SQL Editor (gratis/tanpa redeploy).
 BOT_PRIVATE_KEY & BOT_USER_ID disimpan di Edge Functions > Secrets (bukan di tabel).';

-- 4) RPC buat/ambil conversation user <-> bot (dipanggil frontend pas load)
--    SECURITY DEFINER biar bisa insert conversation_members utk bot (RLS user biasa
--    cuma izinin insert buat dirinya sendiri).
create or replace function public.ensure_bot_conversation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bot uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  me  uuid := auth.uid();
  cid uuid;
begin
  select cm.conversation_id into cid
  from conversation_members cm
  where cm.user_id = me
    and cm.conversation_id in (select conversation_id from conversation_members where user_id = bot)
  limit 1;

  if cid is null then
    insert into conversations default values returning id into cid;
    insert into conversation_members (conversation_id, user_id)
    values (cid, me), (cid, bot);
  end if;
  return cid;
end;
$$;
grant execute on function public.ensure_bot_conversation() to authenticated;

-- ============================================================
-- SETELAH SQL INI:
--  A) Dashboard > Edge Functions > Secrets, tambah:
--       BOT_PRIVATE_KEY = 9tGVLx8xyDa7GazbTeau7TK9v1fNjjjcc8D0sEndyjM
--       BOT_USER_ID     = bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--  B) UPDATE public.bot_config SET openrouter_api_key = 'sk-or-xxx' WHERE id=1;
--  C) Ganti model kalau mau:
--       UPDATE public.bot_config SET openrouter_model = 'openai/gpt-4o-mini' WHERE id=1;
--  D) Dashboard > Database > Webhooks:
--       table=public.messages, events=INSERT, type=HTTP Request,
--       Edge Function=bot-reply
--  E) Frontend: panggil ensure_bot_conversation() pas load (sudah di-handle di AppShell)
-- ============================================================
