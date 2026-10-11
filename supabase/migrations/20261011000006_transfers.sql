-- Transfers between the user's own accounts (BPI -> GCash, debit -> credit card payment).
-- A transfer is two transactions sharing transfer_id: money out of one account, money in to another.
-- Both move balances; neither counts as spending or income. Fees are separate expense transactions.

alter table public.transactions add column transfer_id uuid;
create index transactions_transfer_id_idx on public.transactions (transfer_id);

-- At most two legs per transfer, enforced where legs are created (RPCs below).

-- Record a transfer by hand: both legs (and an optional fee) in one atomic call.
create function public.create_transfer(
  p_from_account uuid,
  p_to_account uuid,
  p_amount_centavos bigint,
  p_occurred_at timestamptz,
  p_fee_centavos bigint default 0,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  tid uuid := gen_random_uuid();
  transfer_category uuid := (select id from public.categories where user_id is null and name = 'Transfer');
  fee_category uuid := (select id from public.categories where user_id is null and name = 'Fees & interest');
begin
  if p_from_account = p_to_account then
    raise exception 'pick two different accounts' using errcode = '22023';
  end if;
  if p_amount_centavos <= 0 or p_fee_centavos < 0 then
    raise exception 'amount must be positive and fee cannot be negative' using errcode = '22023';
  end if;

  -- RLS on accounts + the composite FK make both accounts provably the caller's own.
  insert into public.transactions (account_id, amount_centavos, occurred_at, merchant, note, category_id, status, source, transfer_id, confirmed_at)
  values
    (p_from_account, -p_amount_centavos, p_occurred_at, 'Transfer', p_note, transfer_category, 'confirmed', 'manual', tid, now()),
    (p_to_account,    p_amount_centavos, p_occurred_at, 'Transfer', p_note, transfer_category, 'confirmed', 'manual', tid, now());

  if p_fee_centavos > 0 then
    insert into public.transactions (account_id, amount_centavos, occurred_at, merchant, category_id, status, source, confirmed_at)
    values (p_from_account, -p_fee_centavos, p_occurred_at, 'Transfer fee', fee_category, 'confirmed', 'manual', now());
  end if;
  return tid;
end;
$$;

-- Review inbox: confirm two existing transactions (e.g. a BPI debit alert and a GCash cash-in) as one transfer.
create function public.confirm_as_transfer(p_out_id uuid, p_in_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  tid uuid := gen_random_uuid();
  transfer_category uuid := (select id from public.categories where user_id is null and name = 'Transfer');
  out_row public.transactions;
  in_row public.transactions;
begin
  select * into out_row from public.transactions where id = p_out_id for update;
  select * into in_row from public.transactions where id = p_in_id for update;
  if out_row.id is null or in_row.id is null then
    raise exception 'transaction not found' using errcode = 'P0002';
  end if;
  if out_row.amount_centavos >= 0 or in_row.amount_centavos <= 0 then
    raise exception 'a transfer needs one money-out and one money-in transaction' using errcode = '22023';
  end if;
  if out_row.account_id = in_row.account_id then
    raise exception 'a transfer needs two different accounts' using errcode = '22023';
  end if;
  if -out_row.amount_centavos <> in_row.amount_centavos then
    raise exception 'amounts differ; record the difference as a fee' using errcode = '22023';
  end if;
  if out_row.transfer_id is not null or in_row.transfer_id is not null then
    raise exception 'already part of a transfer' using errcode = '22023';
  end if;

  update public.transactions
     set transfer_id = tid,
         category_id = transfer_category,
         status = 'confirmed',
         confirmed_at = coalesce(confirmed_at, now()),
         duplicate_of = null
   where id in (p_out_id, p_in_id);
  return tid;
end;
$$;

-- Review inbox: only one side emailed. Confirm it as a transfer and create the other leg.
create function public.confirm_one_sided_transfer(p_id uuid, p_other_account uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  tid uuid := gen_random_uuid();
  transfer_category uuid := (select id from public.categories where user_id is null and name = 'Transfer');
  row_ public.transactions;
begin
  select * into row_ from public.transactions where id = p_id and status = 'pending' for update;
  if row_.id is null then
    raise exception 'pending transaction % not found', p_id using errcode = 'P0002';
  end if;
  if row_.account_id = p_other_account then
    raise exception 'a transfer needs two different accounts' using errcode = '22023';
  end if;

  update public.transactions
     set transfer_id = tid, category_id = transfer_category, status = 'confirmed', confirmed_at = now(), duplicate_of = null
   where id = p_id;
  insert into public.transactions (account_id, amount_centavos, occurred_at, merchant, category_id, status, source, transfer_id, confirmed_at)
  values (p_other_account, -row_.amount_centavos, row_.occurred_at, coalesce(row_.merchant, 'Transfer'),
          transfer_category, 'confirmed', 'manual', tid, now());
  return tid;
end;
$$;

-- A transfer pair must not be flagged as each other's duplicates.
create or replace function public.link_new_pending_duplicate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pending' and new.duplicate_of is null and new.transfer_id is null then
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

revoke execute on function public.create_transfer(uuid, uuid, bigint, timestamptz, bigint, text),
  public.confirm_as_transfer(uuid, uuid), public.confirm_one_sided_transfer(uuid, uuid) from public, anon;
grant execute on function public.create_transfer(uuid, uuid, bigint, timestamptz, bigint, text),
  public.confirm_as_transfer(uuid, uuid), public.confirm_one_sided_transfer(uuid, uuid) to authenticated;
