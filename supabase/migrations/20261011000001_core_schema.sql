-- Core schema: profiles, institutions, categories, accounts, raw_emails, transactions.
-- Rules (see CLAUDE.md): every user-owned row has user_id + RLS; money is bigint centavos;
-- timestamps are timestamptz; only last-4 digits of any card/account number.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('ewallet', 'savings', 'debit', 'credit', 'bnpl', 'loan');
create type public.institution_kind as enum ('bank', 'ewallet', 'bnpl', 'other');
create type public.category_kind as enum ('expense', 'income', 'transfer');
create type public.txn_status as enum ('pending', 'confirmed', 'ignored');
create type public.txn_source as enum ('manual', 'email', 'sms', 'recurring', 'statement');
create type public.raw_email_status as enum ('pending', 'parsed', 'failed', 'flagged');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 10 chars from an unambiguous 32-letter alphabet = 50 bits of randomness.
create function public.generate_inbound_alias()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(10);
  alias text := 'u_';
begin
  for i in 0..9 loop
    alias := alias || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return alias;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (one per auth user, created by trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  theme text not null default 'sakura'
    check (theme in ('sakura', 'strawberry', 'bubblegum', 'barako', 'courtside', 'denim', 'mono', 'coal')),
  mode text not null default 'system' check (mode in ('light', 'dark', 'system')),
  inbound_alias text not null unique check (inbound_alias ~ '^u_[a-z0-9]{10}$'),
  -- Set by the email parser when it sees Gmail's forwarding-confirmation email.
  gmail_forward_code text check (char_length(gmail_forward_code) <= 32),
  gmail_forward_code_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- institutions (shared seed rows have user_id null; users may add their own)
-- ---------------------------------------------------------------------------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  slug text check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  kind public.institution_kind not null default 'bank',
  -- Allowlisted sender domains for email import. Only shared rows may allowlist.
  email_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutions_user_rows_no_allowlist check (user_id is null or email_domains = '{}'),
  constraint institutions_shared_rows_have_slug check (user_id is not null or slug is not null)
);
create unique index institutions_shared_slug_key on public.institutions (slug) where user_id is null;
create unique index institutions_user_name_key on public.institutions (user_id, lower(name)) where user_id is not null;

-- ---------------------------------------------------------------------------
-- categories (same shared/own pattern)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  kind public.category_kind not null default 'expense',
  icon text check (icon ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_shared_name_key on public.categories (lower(name)) where user_id is null;
create unique index categories_user_name_key on public.categories (user_id, lower(name)) where user_id is not null;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  institution_id uuid not null references public.institutions (id),
  type public.account_type not null,
  name text not null check (char_length(name) between 1 and 80),
  last4 text check (last4 ~ '^[0-9]{4}$'),
  currency text not null default 'PHP' check (currency = 'PHP'),
  opening_balance_centavos bigint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- lets child tables enforce "same owner" with a composite foreign key
  unique (id, user_id)
);
create index accounts_user_id_idx on public.accounts (user_id);
create index accounts_institution_id_idx on public.accounts (institution_id);

-- ---------------------------------------------------------------------------
-- raw_emails (written only by the inbound Worker / parser via service role)
-- ---------------------------------------------------------------------------
create table public.raw_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  inbound_alias text not null,
  message_id text,
  from_address text not null,
  from_domain text not null,
  subject text,
  received_at timestamptz not null default now(),
  raw_mime text not null check (octet_length(raw_mime) <= 2000000),
  sender_allowed boolean not null default false,
  status public.raw_email_status not null default 'pending',
  parser text,
  parser_version integer,
  error text,
  parsed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, message_id)
);
create index raw_emails_user_status_idx on public.raw_emails (user_id, status, received_at desc);
create index raw_emails_pending_idx on public.raw_emails (received_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- transactions (amount is signed: negative = money out)
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  account_id uuid not null,
  amount_centavos bigint not null check (amount_centavos <> 0),
  occurred_at timestamptz not null,
  merchant text check (char_length(merchant) <= 200),
  note text check (char_length(note) <= 1000),
  category_id uuid references public.categories (id) on delete set null,
  status public.txn_status not null default 'pending',
  source public.txn_source not null default 'manual',
  raw_email_id uuid,
  duplicate_of uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (raw_email_id, user_id) references public.raw_emails (id, user_id) on delete set null (raw_email_id),
  foreign key (duplicate_of, user_id) references public.transactions (id, user_id) on delete set null (duplicate_of),
  constraint transactions_not_own_duplicate check (duplicate_of is null or duplicate_of <> id)
);
create index transactions_user_status_idx on public.transactions (user_id, status, occurred_at desc);
create index transactions_dedupe_idx on public.transactions (account_id, amount_centavos, occurred_at);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_raw_email_id_idx on public.transactions (raw_email_id);
create index transactions_duplicate_of_idx on public.transactions (duplicate_of);

-- Shared-or-own references can't be expressed as a composite FK, so check them here.
create function public.assert_visible_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'accounts' then
    if not exists (
      select 1 from public.institutions i
      where i.id = new.institution_id and (i.user_id is null or i.user_id = new.user_id)
    ) then
      raise exception 'institution % not found', new.institution_id using errcode = '23503';
    end if;
  elsif tg_table_name = 'transactions' and new.category_id is not null then
    if not exists (
      select 1 from public.categories c
      where c.id = new.category_id and (c.user_id is null or c.user_id = new.user_id)
    ) then
      raise exception 'category % not found', new.category_id using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger accounts_visible_refs before insert or update on public.accounts
  for each row execute function public.assert_visible_refs();
create trigger transactions_visible_refs before insert or update on public.transactions
  for each row execute function public.assert_visible_refs();

-- updated_at triggers
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger institutions_updated_at before update on public.institutions for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger accounts_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger raw_emails_updated_at before update on public.raw_emails for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.raw_emails enable row level security;
alter table public.transactions enable row level security;

-- Nothing here is for logged-out visitors.
revoke all on public.profiles, public.institutions, public.categories,
  public.accounts, public.raw_emails, public.transactions from anon;

-- profiles: read own; update only presentation columns. Alias and Gmail code are system-managed.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, theme, mode) on public.profiles to authenticated;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- institutions & categories: read shared + own; write own only.
create policy "institutions: read shared and own" on public.institutions
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "institutions: insert own" on public.institutions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "institutions: update own" on public.institutions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "institutions: delete own" on public.institutions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "categories: read shared and own" on public.categories
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "categories: insert own" on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "categories: update own" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories: delete own" on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- accounts & transactions: full CRUD on own rows.
create policy "accounts: read own" on public.accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "accounts: insert own" on public.accounts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "accounts: update own" on public.accounts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "accounts: delete own" on public.accounts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "transactions: read own" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "transactions: insert own" on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "transactions: update own" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "transactions: delete own" on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- raw_emails: users can see and delete their own; only the service role writes.
revoke insert, update on public.raw_emails from authenticated;
create policy "raw_emails: read own" on public.raw_emails
  for select to authenticated using (user_id = (select auth.uid()));
create policy "raw_emails: delete own" on public.raw_emails
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Review inbox RPCs (security invoker: RLS applies)
-- ---------------------------------------------------------------------------
create function public.confirm_transaction(p_id uuid)
returns public.transactions
language plpgsql
set search_path = ''
as $$
declare
  result public.transactions;
begin
  update public.transactions
     set status = 'confirmed', confirmed_at = now()
   where id = p_id and status = 'pending'
  returning * into result;
  if not found then
    raise exception 'pending transaction % not found', p_id using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create function public.ignore_transaction(p_id uuid)
returns public.transactions
language plpgsql
set search_path = ''
as $$
declare
  result public.transactions;
begin
  update public.transactions
     set status = 'ignored', confirmed_at = null
   where id = p_id and status = 'pending'
  returning * into result;
  if not found then
    raise exception 'pending transaction % not found', p_id using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create function public.mark_not_duplicate(p_id uuid)
returns public.transactions
language plpgsql
set search_path = ''
as $$
declare
  result public.transactions;
begin
  update public.transactions
     set duplicate_of = null
   where id = p_id
  returning * into result;
  if not found then
    raise exception 'transaction % not found', p_id using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Internal helpers are not part of the API.
revoke execute on function public.generate_inbound_alias(), public.handle_new_user(),
  public.assert_visible_refs(), public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.confirm_transaction(uuid), public.ignore_transaction(uuid),
  public.mark_not_duplicate(uuid) from public, anon;
grant execute on function public.confirm_transaction(uuid), public.ignore_transaction(uuid),
  public.mark_not_duplicate(uuid) to authenticated;
