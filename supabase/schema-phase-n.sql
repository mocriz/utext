-- ============================================================================
-- utext Phase N: setup_done flag + last_seen (online presence fallback)
-- ============================================================================

-- profil: setup_done (onboarding selesai) + last_seen (timestamp online terakhir)
alter table public.profiles add column if not exists setup_done boolean not null default false;
alter table public.profiles add column if not exists last_seen timestamptz;

-- RPC: tandai setup selesai
create or replace function public.mark_setup_done()
returns void language plpgsql security definer as $$
begin
  update public.profiles set setup_done = true where id = auth.uid();
end; $$;
grant execute on function public.mark_setup_done() to authenticated;

-- RPC: update last_seen (heartbeat online)
create or replace function public.touch_last_seen()
returns void language plpgsql security definer as $$
begin
  update public.profiles set last_seen = now() where id = auth.uid();
end; $$;
grant execute on function public.touch_last_seen() to authenticated;

-- RPC: ambil last_seen partner (fallback online indicator)
create or replace function public.get_last_seen(target_user_id uuid)
returns timestamptz language plpgsql security definer as $$
declare
  ts timestamptz;
begin
  select last_seen into ts from public.profiles where id = target_user_id;
  return ts;
end; $$;
grant execute on function public.get_last_seen(uuid) to authenticated;
