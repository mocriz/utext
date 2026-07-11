-- ============================================================================
-- utext: reply + edit message support
-- ============================================================================
alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists text_content text;  -- plaintext reference for edit (sender-only, optional)

-- index
create index if not exists messages_reply_idx on public.messages (reply_to);
