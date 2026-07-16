-- utext Phase P: Web Push (buat notif bot reply saat app tertutup)
-- Jalankan di Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, subscription)
);

alter table public.push_subscriptions enable row level security;

-- user cuma boleh baca/ tulis subscription miliknya sendiri
create policy "push own select" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push own insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push own delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- RPC: simpan subscription (upsert per user)
create or replace function public.save_push_subscription(sub jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.push_subscriptions (user_id, subscription)
  values (auth.uid(), sub)
  on conflict (user_id, subscription) do nothing;
end;
$$;

grant execute on function public.save_push_subscription(jsonb) to authenticated;

-- RPC: ambil semua subscription user (dipakai Edge Function buat kirim)
create or replace function public.get_push_subscriptions(u uuid)
returns jsonb[] language sql security definer as $$
  select coalesce(array_agg(subscription), array[]::jsonb[])
  from public.push_subscriptions where user_id = u;
$$;

grant execute on function public.get_push_subscriptions(uuid) to authenticated;
