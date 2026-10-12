-- Paydays, per-category settings (fixed bills, monthly limits), goals backed by an account,
-- and web push alerts.

-- ---------------------------------------------------------------------------
-- Paydays: days of the month a budget period starts (31 = last day). {1} is the calendar month;
-- {15,31} is the common kinsenas/katapusan pay. The monthly limit is shared evenly across periods.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column paydays smallint[] not null default '{1}'
    check (cardinality(paydays) between 1 and 4 and 1 <= all (paydays) and 31 >= all (paydays)),
  add column notify_bills boolean not null default true,
  add column notify_spending boolean not null default true;
grant update (paydays, notify_bills, notify_spending) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- category_settings: the user's own choices about a (shared or own) category.
--   fixed: rent, bills, tuition... planned for, so they don't eat into the daily amount.
--   monthly_limit: optional cap for that category, with a warning near it.
-- ---------------------------------------------------------------------------
create table public.category_settings (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  fixed boolean not null default false,
  monthly_limit_centavos bigint check (monthly_limit_centavos > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id)
);
create index category_settings_category_id_idx on public.category_settings (category_id);
create trigger category_settings_updated_at before update on public.category_settings
  for each row execute function public.set_updated_at();

alter table public.category_settings enable row level security;
revoke all on public.category_settings from anon;
-- The category must be one the user can see (shared or own); categories' own RLS answers that.
create policy "category_settings: read own" on public.category_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "category_settings: insert own" on public.category_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.categories c where c.id = category_id));
create policy "category_settings: update own" on public.category_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.categories c where c.id = category_id));
create policy "category_settings: delete own" on public.category_settings
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Goals backed by an account: progress is that account's balance instead of amounts typed in.
-- ---------------------------------------------------------------------------
alter table public.savings_goals
  add column account_id uuid,
  add foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id);
create index savings_goals_account_id_idx on public.savings_goals (account_id);

create function public.assert_goal_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.user_id = new.user_id and a.type in ('ewallet', 'savings', 'debit')
  ) then
    raise exception 'a goal can only use a savings, debit or e-wallet account' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger savings_goals_account before insert or update of account_id on public.savings_goals
  for each row execute function public.assert_goal_account();
revoke execute on function public.assert_goal_account() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- push_subscriptions: one per browser/phone that allowed notifications.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  device text check (char_length(device) <= 120),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke update on public.push_subscriptions from authenticated;
create policy "push_subscriptions: read own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subscriptions: insert own" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- notification_log: what was already sent, so each alert goes out once. Written by the notify job
-- (service role) only; users can't read or write it.
-- ---------------------------------------------------------------------------
create table public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  ref text not null check (char_length(ref) <= 120),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
