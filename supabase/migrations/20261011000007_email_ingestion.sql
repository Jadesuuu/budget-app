-- Email ingestion: forwarding sources, raw email bookkeeping, the Worker's ingest RPC.

insert into public.categories (user_id, name, kind, icon) values
  (null, 'Sent to others',       'expense', 'send'),
  (null, 'Received from others', 'income',  'hand-coins');

-- ---------------------------------------------------------------------------
-- forwarding_sources: mailboxes the user forwards from. Forwards from anywhere else are flagged.
-- ---------------------------------------------------------------------------
create table public.forwarding_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  added_by text not null default 'manual' check (added_by in ('account', 'gmail_confirmation', 'manual')),
  -- Latest Gmail forwarding-confirmation code for this mailbox (not a secret: it only proves receipt).
  confirmation_code text check (confirmation_code ~ '^[0-9]{6,12}$'),
  confirmation_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);
create index forwarding_sources_user_id_idx on public.forwarding_sources (user_id);
create trigger forwarding_sources_updated_at before update on public.forwarding_sources
  for each row execute function public.set_updated_at();

alter table public.forwarding_sources enable row level security;
revoke all on public.forwarding_sources from anon;
revoke update on public.forwarding_sources from authenticated;
create policy "forwarding_sources: read own" on public.forwarding_sources
  for select to authenticated using (user_id = (select auth.uid()));
create policy "forwarding_sources: insert own" on public.forwarding_sources
  for insert to authenticated with check (user_id = (select auth.uid()) and added_by = 'manual');
create policy "forwarding_sources: delete own" on public.forwarding_sources
  for delete to authenticated using (user_id = (select auth.uid()));

-- The sign-in address is always a known source (new users via the signup trigger, existing users here).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  loop
    begin
      insert into public.profiles (user_id, inbound_alias, display_name)
      values (new.id, public.generate_inbound_alias(), left(new.raw_user_meta_data ->> 'display_name', 80))
      on conflict (user_id) do nothing;
      exit;
    exception when unique_violation then
      -- inbound_alias collision: draw again
    end;
  end loop;
  if new.email is not null then
    insert into public.forwarding_sources (user_id, email, added_by)
    values (new.id, lower(new.email), 'account')
    on conflict (user_id, email) do nothing;
  end if;
  return new;
end;
$$;

insert into public.forwarding_sources (user_id, email, added_by)
select id, lower(email), 'account' from auth.users where email is not null
on conflict (user_id, email) do nothing;

-- ---------------------------------------------------------------------------
-- raw_emails: what the parser learned
-- ---------------------------------------------------------------------------
alter table public.raw_emails
  add column envelope_to text,
  add column forwarded_by text,
  add column original_from text,
  add column kind text check (kind in ('transaction', 'gmail_confirmation', 'other')),
  add column note text check (char_length(note) <= 300);

-- ---------------------------------------------------------------------------
-- Worker entry point. Service role only: resolves the alias, stores the raw message, nothing else.
-- ---------------------------------------------------------------------------
create function public.ingest_raw_email(
  p_alias text,
  p_envelope_from text,
  p_envelope_to text,
  p_message_id text,
  p_subject text,
  p_raw_mime text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  sender text := lower(coalesce(p_envelope_from, ''));
begin
  select user_id into owner from public.profiles where inbound_alias = lower(p_alias);
  if owner is null then
    return 'unknown_alias';
  end if;

  insert into public.raw_emails (user_id, inbound_alias, envelope_to, message_id, from_address, from_domain, subject, raw_mime)
  values (owner, lower(p_alias), lower(p_envelope_to), nullif(p_message_id, ''), sender,
          coalesce(nullif(split_part(sender, '@', 2), ''), 'unknown'), left(p_subject, 500), p_raw_mime)
  on conflict (user_id, message_id) do nothing;

  return case when found then 'stored' else 'duplicate' end;
end;
$$;

revoke execute on function public.ingest_raw_email(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ingest_raw_email(text, text, text, text, text, text) to service_role;
