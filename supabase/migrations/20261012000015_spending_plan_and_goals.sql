-- Spending plan (a monthly limit that becomes a daily allowance) and savings goals.

-- ---------------------------------------------------------------------------
-- Spending plan: lives on the profile, one per user. Both optional; without a limit the app shows
-- what was spent but no allowance. Income is only used to suggest a limit.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column monthly_income_centavos bigint check (monthly_income_centavos > 0),
  add column spending_limit_centavos bigint check (spending_limit_centavos > 0);
grant update (monthly_income_centavos, spending_limit_centavos) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- savings_goals: a target, what is put aside so far, and an optional date to reach it by.
-- ---------------------------------------------------------------------------
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  target_centavos bigint not null check (target_centavos > 0),
  saved_centavos bigint not null default 0 check (saved_centavos >= 0),
  target_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index savings_goals_user_id_idx on public.savings_goals (user_id);
create trigger savings_goals_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;
revoke all on public.savings_goals from anon;

create policy "savings_goals: read own" on public.savings_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "savings_goals: insert own" on public.savings_goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "savings_goals: update own" on public.savings_goals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "savings_goals: delete own" on public.savings_goals
  for delete to authenticated using (user_id = (select auth.uid()));

-- Put money in (positive) or take it out (negative) in one atomic step. Runs as the caller, so RLS
-- limits it to their own goals; taking out more than is saved fails the saved >= 0 check.
create function public.add_to_goal(p_id uuid, p_amount_centavos bigint)
returns bigint
language sql
set search_path = ''
as $$
  update public.savings_goals
  set saved_centavos = saved_centavos + p_amount_centavos
  where id = p_id and archived_at is null
  returning saved_centavos;
$$;
revoke execute on function public.add_to_goal(uuid, bigint) from public, anon;
grant execute on function public.add_to_goal(uuid, bigint) to authenticated;
