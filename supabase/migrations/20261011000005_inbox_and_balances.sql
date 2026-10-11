-- Review inbox support: balances, duplicate detection, confirm-with-category, reopen.

-- ---------------------------------------------------------------------------
-- Balances: opening balance + confirmed transactions. security_invoker keeps RLS in force.
-- ---------------------------------------------------------------------------
create view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  (a.opening_balance_centavos
    + coalesce(sum(t.amount_centavos) filter (where t.status = 'confirmed'), 0))::bigint as balance_centavos,
  count(t.id) filter (where t.status = 'pending') as pending_count
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Duplicate detection: same account, same amount, within 2 days.
-- A new pending row points at its best match; a new confirmed row claims pending matches.
-- ---------------------------------------------------------------------------
create function public.link_new_pending_duplicate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pending' and new.duplicate_of is null then
    select t.id into new.duplicate_of
      from public.transactions t
     where t.user_id = new.user_id
       and t.account_id = new.account_id
       and t.amount_centavos = new.amount_centavos
       and t.status <> 'ignored'
       and t.occurred_at between new.occurred_at - interval '2 days' and new.occurred_at + interval '2 days'
     order by (t.status = 'confirmed') desc, abs(extract(epoch from (t.occurred_at - new.occurred_at)))
     limit 1;
  end if;
  return new;
end;
$$;

create function public.claim_pending_duplicates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'confirmed' then
    update public.transactions t
       set duplicate_of = new.id
     where t.user_id = new.user_id
       and t.account_id = new.account_id
       and t.amount_centavos = new.amount_centavos
       and t.status = 'pending'
       and t.duplicate_of is null
       and t.id <> new.id
       and t.occurred_at between new.occurred_at - interval '2 days' and new.occurred_at + interval '2 days';
  end if;
  return null;
end;
$$;

create trigger transactions_link_duplicate before insert on public.transactions
  for each row execute function public.link_new_pending_duplicate();
create trigger transactions_claim_duplicates after insert on public.transactions
  for each row execute function public.claim_pending_duplicates();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
drop function public.confirm_transaction(uuid);

create function public.confirm_transaction(p_id uuid, p_category_id uuid default null)
returns public.transactions
language plpgsql
set search_path = ''
as $$
declare
  result public.transactions;
begin
  update public.transactions
     set status = 'confirmed',
         confirmed_at = now(),
         category_id = coalesce(p_category_id, category_id)
   where id = p_id and status = 'pending'
  returning * into result;
  if not found then
    raise exception 'pending transaction % not found', p_id using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Undo for the review inbox: put a reviewed transaction back in the queue.
create function public.reopen_transaction(p_id uuid)
returns public.transactions
language plpgsql
set search_path = ''
as $$
declare
  result public.transactions;
begin
  update public.transactions
     set status = 'pending', confirmed_at = null
   where id = p_id and status in ('confirmed', 'ignored') and source <> 'manual'
  returning * into result;
  if not found then
    raise exception 'reviewed transaction % not found', p_id using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke execute on function public.link_new_pending_duplicate(), public.claim_pending_duplicates()
  from public, anon, authenticated;
revoke execute on function public.confirm_transaction(uuid, uuid), public.reopen_transaction(uuid) from public, anon;
grant execute on function public.confirm_transaction(uuid, uuid), public.reopen_transaction(uuid) to authenticated;
