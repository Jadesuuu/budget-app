-- Captured transactions confirm themselves when two independent sources agree, so they skip the review inbox:
--   transfer: a money-out text/email on one of the user's accounts and a money-in of the same amount on another,
--             within 30 minutes, each the other's only match. Both legs become one confirmed transfer.
--   balance:  the bank stated a balance (e.g. GCash "New balance is ...") and Budget, counting what's waiting
--             for review, agrees with it exactly. The waiting texts/emails on that account are confirmed.
-- Anything else still waits for review. Auto-confirmed rows are marked and can be reopened.

alter table public.transactions
  add column auto_confirmed text check (auto_confirmed in ('transfer', 'balance'));

create function public.auto_confirm_captured(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  transfer_category uuid := (select id from public.categories where user_id is null and name = 'Transfer');
  r public.transactions;
  match_id uuid;
  tid uuid;
  acct uuid;
  cp record;
  confirmed_sum bigint;
  pending_sum bigint;
begin
  -- 1. Transfers between the user's own accounts. A leg already confirmed by its balance can still be paired,
  --    since the other bank's text may arrive later.
  for r in
    select * from public.transactions t
     where t.id = any (p_ids) and t.status = 'pending' and t.transfer_id is null and t.duplicate_of is null
       and t.source in ('sms', 'email')
  loop
    select c.id into match_id
      from public.transactions c
     where c.user_id = r.user_id
       and c.account_id <> r.account_id
       and c.amount_centavos = -r.amount_centavos
       and c.transfer_id is null
       and c.source in ('sms', 'email')
       and ((c.status = 'pending' and c.duplicate_of is null) or c.auto_confirmed = 'balance')
       and c.occurred_at between r.occurred_at - interval '30 minutes' and r.occurred_at + interval '30 minutes';
    if found and (
      -- Exactly one candidate on each side; otherwise a person decides.
      select count(*) from public.transactions c
       where c.user_id = r.user_id and c.account_id <> r.account_id and c.amount_centavos = -r.amount_centavos
         and c.transfer_id is null and c.source in ('sms', 'email')
         and ((c.status = 'pending' and c.duplicate_of is null) or c.auto_confirmed = 'balance')
         and c.occurred_at between r.occurred_at - interval '30 minutes' and r.occurred_at + interval '30 minutes'
    ) = 1 and (
      select count(*) from public.transactions o, public.transactions m
       where m.id = match_id
         and o.user_id = m.user_id and o.account_id <> m.account_id and o.amount_centavos = -m.amount_centavos
         and o.transfer_id is null and o.source in ('sms', 'email')
         and ((o.status = 'pending' and o.duplicate_of is null) or o.auto_confirmed = 'balance')
         and o.occurred_at between m.occurred_at - interval '30 minutes' and m.occurred_at + interval '30 minutes'
    ) = 1 then
      tid := gen_random_uuid();
      update public.transactions
         set transfer_id = tid, category_id = transfer_category, status = 'confirmed',
             confirmed_at = coalesce(confirmed_at, now()), duplicate_of = null, auto_confirmed = 'transfer'
       where id in (r.id, match_id);
    end if;
  end loop;

  -- 2. Balance agreement, per affected account, at its latest stated balance.
  for acct in select distinct t.account_id from public.transactions t where t.id = any (p_ids)
  loop
    select c.balance_centavos, c.as_of, a.opening_balance_centavos, a.opening_balance_at into cp
      from public.balance_checkpoints c
      join public.accounts a on a.id = c.account_id
     where c.account_id = acct and c.as_of >= a.opening_balance_at
     order by c.as_of desc, c.created_at desc
     limit 1;
    continue when not found;

    select coalesce(sum(t.amount_centavos) filter (where t.status = 'confirmed'), 0),
           coalesce(sum(t.amount_centavos) filter (where t.status = 'pending'), 0)
      into confirmed_sum, pending_sum
      from public.transactions t
     where t.account_id = acct and t.occurred_at >= cp.opening_balance_at and t.occurred_at <= cp.as_of;

    continue when cp.opening_balance_centavos + confirmed_sum + pending_sum <> cp.balance_centavos;
    -- A possible duplicate still waiting means a person should look, even if the sum happens to match.
    continue when exists (
      select 1 from public.transactions t
       where t.account_id = acct and t.status = 'pending' and t.duplicate_of is not null
         and t.occurred_at >= cp.opening_balance_at and t.occurred_at <= cp.as_of);

    update public.transactions t
       set status = 'confirmed', confirmed_at = now(), auto_confirmed = 'balance'
     where t.account_id = acct and t.status = 'pending' and t.source in ('sms', 'email')
       and t.occurred_at >= cp.opening_balance_at and t.occurred_at <= cp.as_of;
  end loop;
end;
$$;

-- Only the parse jobs (service role) run it.
revoke execute on function public.auto_confirm_captured(uuid[]) from public, anon, authenticated;

-- Reopening an auto-paired transfer leg reopens both legs and undoes the pairing.
create or replace function public.reopen_transaction(p_id uuid)
returns public.transactions
language plpgsql
set search_path = ''
as $$
declare
  result public.transactions;
  pair uuid;
begin
  select transfer_id into pair from public.transactions where id = p_id and auto_confirmed = 'transfer';
  if pair is not null then
    update public.transactions
       set status = 'pending', confirmed_at = null, transfer_id = null, category_id = null, auto_confirmed = null
     where transfer_id = pair and id <> p_id;
  end if;

  update public.transactions
     set status = 'pending', confirmed_at = null, auto_confirmed = null,
         transfer_id = case when pair is not null then null else transfer_id end,
         category_id = case when pair is not null then null else category_id end
   where id = p_id and status in ('confirmed', 'ignored') and source <> 'manual'
  returning * into result;
  if not found then
    raise exception 'reviewed transaction % not found', p_id using errcode = 'P0002';
  end if;
  return result;
end;
$$;
