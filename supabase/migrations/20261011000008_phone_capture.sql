-- Phone capture: bank SMS and app notifications forwarded from the user's phone to a private link.
-- Same pattern as email: store the raw message, parse separately, never import unknown senders.

-- Which SMS sender names and app packages belong to each institution (filled from real samples).
alter table public.institutions
  add column sms_senders text[] not null default '{}',
  add column app_packages text[] not null default '{}',
  add constraint institutions_user_rows_no_capture_allowlist
    check (user_id is null or (sms_senders = '{}' and app_packages = '{}'));

-- ---------------------------------------------------------------------------
-- capture_links: one per phone. Only a SHA-256 hash of the secret is stored; the link is shown once.
-- ---------------------------------------------------------------------------
create table public.capture_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  label text not null check (char_length(label) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index capture_links_user_id_idx on public.capture_links (user_id);
create trigger capture_links_updated_at before update on public.capture_links
  for each row execute function public.set_updated_at();

alter table public.capture_links enable row level security;
revoke all on public.capture_links from anon;
revoke update on public.capture_links from authenticated;
grant update (label, revoked_at) on public.capture_links to authenticated;
create policy "capture_links: read own" on public.capture_links
  for select to authenticated using (user_id = (select auth.uid()));
create policy "capture_links: insert own" on public.capture_links
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "capture_links: update own" on public.capture_links
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "capture_links: delete own" on public.capture_links
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- raw_messages: captured SMS / notifications, written only through capture_message().
-- ---------------------------------------------------------------------------
create table public.raw_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  capture_link_id uuid,
  channel text not null check (channel in ('sms', 'notification')),
  sender text not null check (char_length(sender) between 1 and 200),
  title text check (char_length(title) <= 300),
  -- null when the sender is not a known bank: the content of personal texts and chats is never kept.
  body text check (char_length(body) between 1 and 4000),
  received_at timestamptz not null,
  dedupe_key text not null check (dedupe_key ~ '^[0-9a-f]{64}$'),
  status public.raw_email_status not null default 'pending',
  parser text,
  parser_version integer,
  note text check (char_length(note) <= 300),
  parsed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, dedupe_key),
  constraint raw_messages_body_kept_unless_flagged check (body is not null or status = 'flagged'),
  foreign key (capture_link_id, user_id) references public.capture_links (id, user_id) on delete set null (capture_link_id)
);
create index raw_messages_user_status_idx on public.raw_messages (user_id, status, received_at desc);
create index raw_messages_pending_idx on public.raw_messages (received_at) where status = 'pending';
create index raw_messages_capture_link_id_idx on public.raw_messages (capture_link_id);
create trigger raw_messages_updated_at before update on public.raw_messages
  for each row execute function public.set_updated_at();

alter table public.raw_messages enable row level security;
revoke all on public.raw_messages from anon;
revoke insert, update on public.raw_messages from authenticated;
create policy "raw_messages: read own" on public.raw_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "raw_messages: delete own" on public.raw_messages
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.transactions
  add column raw_message_id uuid,
  add foreign key (raw_message_id, user_id) references public.raw_messages (id, user_id) on delete set null (raw_message_id);
create index transactions_raw_message_id_idx on public.transactions (raw_message_id);

-- ---------------------------------------------------------------------------
-- Capture endpoint entry point (service role only). The route hashes the secret; this resolves it.
-- ---------------------------------------------------------------------------
create function public.capture_message(
  p_token_hash text,
  p_channel text,
  p_sender text,
  p_title text,
  p_body text,
  p_received_at timestamptz,
  p_dedupe_key text,
  -- Set by the route when the sender is not a known bank: the body is dropped and the row is flagged.
  p_flag_note text default null
)
returns table (result text, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.capture_links;
begin
  select * into link from public.capture_links l where l.token_hash = p_token_hash and l.revoked_at is null;
  if link.id is null then
    return query select 'invalid_link'::text, null::uuid;
    return;
  end if;

  update public.capture_links set last_used_at = now() where id = link.id;
  insert into public.raw_messages (user_id, capture_link_id, channel, sender, title, body, received_at, dedupe_key, status, note, parsed_at)
  values (link.user_id, link.id, p_channel, left(p_sender, 200),
          case when p_flag_note is null then left(nullif(p_title, ''), 300) end,
          case when p_flag_note is null then left(p_body, 4000) end,
          coalesce(p_received_at, now()), p_dedupe_key,
          case when p_flag_note is null then 'pending' else 'flagged' end::public.raw_email_status,
          left(p_flag_note, 300),
          case when p_flag_note is null then null else now() end)
  on conflict on constraint raw_messages_user_id_dedupe_key_key do nothing;

  return query select (case when found then 'stored' else 'duplicate' end)::text, link.user_id;
end;
$$;

revoke execute on function public.capture_message(text, text, text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.capture_message(text, text, text, text, text, timestamptz, text, text) to service_role;
