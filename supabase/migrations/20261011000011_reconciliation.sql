-- Reconciliation: dated opening balances, balance checkpoints, statements from any source, imports.

-- ---------------------------------------------------------------------------
-- Opening balance has a date. Only transactions at or after it move the balance, so importing older
-- history never double counts what the opening balance already includes.
-- ---------------------------------------------------------------------------
alter table public.accounts add column opening_balance_at timestamptz not null default now();
update public.accounts set opening_balance_at = created_at;

create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  (a.opening_balance_centavos
    + coalesce(sum(t.amount_centavos) filter (where t.status = 'confirmed' and t.occurred_at >= a.opening_balance_at), 0))::bigint
    as balance_centavos,
  count(t.id) filter (where t.status = 'pending') as pending_count
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

-- ---------------------------------------------------------------------------
-- balance_checkpoints: "the bank says this account was X at time T" (from texts, emails, statements,
-- imports, or the user reading their app). Balances use the app's sign: amounts owed are negative.
-- ---------------------------------------------------------------------------
create table public.balance_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  account_id uuid not null,
  balance_centavos bigint not null,
  as_of timestamptz not null,
  source text not null check (source in ('sms', 'email', 'statement', 'import', 'manual')),
  raw_email_id uuid,
  raw_message_id uuid,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (raw_email_id, user_id) references public.raw_emails (id, user_id) on delete set null (raw_email_id),
  foreign key (raw_message_id, user_id) references public.raw_messages (id, user_id) on delete set null (raw_message_id)
);
create index balance_checkpoints_account_idx on public.balance_checkpoints (account_id, as_of desc);
create index balance_checkpoints_user_id_idx on public.balance_checkpoints (user_id);
create index balance_checkpoints_raw_email_id_idx on public.balance_checkpoints (raw_email_id);
create index balance_checkpoints_raw_message_id_idx on public.balance_checkpoints (raw_message_id);
-- One checkpoint per message or email, so re-running the parse job doesn't duplicate them.
create unique index balance_checkpoints_raw_email_key on public.balance_checkpoints (raw_email_id) where raw_email_id is not null;
create unique index balance_checkpoints_raw_message_key on public.balance_checkpoints (raw_message_id) where raw_message_id is not null;

alter table public.balance_checkpoints enable row level security;
revoke all on public.balance_checkpoints from anon;
revoke update on public.balance_checkpoints from authenticated;
create policy "balance_checkpoints: read own" on public.balance_checkpoints
  for select to authenticated using (user_id = (select auth.uid()));
create policy "balance_checkpoints: insert own" on public.balance_checkpoints
  for insert to authenticated with check (user_id = (select auth.uid()) and source in ('manual', 'import'));
create policy "balance_checkpoints: delete own" on public.balance_checkpoints
  for delete to authenticated using (user_id = (select auth.uid()));

-- Latest checkpoint per account vs. what Budget computes at that moment.
--   difference = reported - (confirmed + pending): 0 means nothing is missing.
create view public.account_reconciliation
with (security_invoker = true) as
select distinct on (c.account_id)
  c.account_id,
  c.user_id,
  c.id as checkpoint_id,
  c.balance_centavos as reported_centavos,
  c.as_of,
  c.source,
  (a.opening_balance_centavos + coalesce((
    select sum(t.amount_centavos) from public.transactions t
     where t.account_id = c.account_id and t.status = 'confirmed'
       and t.occurred_at >= a.opening_balance_at and t.occurred_at <= c.as_of), 0))::bigint as confirmed_centavos,
  coalesce((
    select sum(t.amount_centavos) from public.transactions t
     where t.account_id = c.account_id and t.status = 'pending'
       and t.occurred_at >= a.opening_balance_at and t.occurred_at <= c.as_of), 0)::bigint as pending_centavos
from public.balance_checkpoints c
join public.accounts a on a.id = c.account_id
where c.as_of >= a.opening_balance_at
order by c.account_id, c.as_of desc, c.created_at desc;

revoke all on public.account_reconciliation from anon;
grant select on public.account_reconciliation to authenticated;

-- ---------------------------------------------------------------------------
-- Statements come from emails, texts and imports too, for credit cards and BNPL (Atome, TikTok PayLater),
-- so they attach to the account directly instead of requiring card settings first.
-- ---------------------------------------------------------------------------
alter table public.statements drop constraint statements_account_id_user_id_fkey;
alter table public.statements
  add foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  alter column period_start drop not null,
  add column source text not null default 'manual' check (source in ('manual', 'email', 'sms', 'import')),
  drop constraint statements_dates_ordered,
  add constraint statements_dates_ordered check ((period_start is null or period_start <= period_end) and period_end <= due_date);
-- One statement per account per due date: an email and a text about the same bill update one row.
create unique index statements_account_due_key on public.statements (account_id, due_date);
create trigger statements_account_type before insert or update on public.statements
  for each row execute function public.assert_account_type('{credit,bnpl,loan}');

-- ---------------------------------------------------------------------------
-- imports: one uploaded history/statement file. Rows it added point back here, so an import can be undone.
-- ---------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  account_id uuid not null,
  format text not null check (char_length(format) between 1 and 60),
  file_name text check (char_length(file_name) <= 200),
  period_start timestamptz,
  period_end timestamptz,
  rows_total integer not null default 0 check (rows_total >= 0),
  rows_matched integer not null default 0 check (rows_matched >= 0),
  rows_added integer not null default 0 check (rows_added >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);
create index imports_user_id_idx on public.imports (user_id);
create index imports_account_id_idx on public.imports (account_id);
alter table public.imports enable row level security;
revoke all on public.imports from anon;
create policy "imports: read own" on public.imports for select to authenticated using (user_id = (select auth.uid()));
create policy "imports: insert own" on public.imports for insert to authenticated with check (user_id = (select auth.uid()));
create policy "imports: delete own" on public.imports for delete to authenticated using (user_id = (select auth.uid()));

alter table public.transactions
  add column import_id uuid,
  add foreign key (import_id, user_id) references public.imports (id, user_id) on delete cascade;
create index transactions_import_id_idx on public.transactions (import_id);
