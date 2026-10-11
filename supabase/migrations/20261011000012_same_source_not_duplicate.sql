-- Rows parsed from the same email or text are never duplicates of each other. A GCash bank-transfer receipt
-- yields the transfer and its fee as two rows; when both are PHP 10.00 the fee was flagged as a "possible
-- duplicate" of the transfer and easy to ignore by mistake.

create or replace function public.link_new_pending_duplicate()
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
       and not (new.raw_email_id is not null and t.raw_email_id is not distinct from new.raw_email_id)
       and not (new.raw_message_id is not null and t.raw_message_id is not distinct from new.raw_message_id)
     order by (t.status = 'confirmed') desc, abs(extract(epoch from (t.occurred_at - new.occurred_at)))
     limit 1;
  end if;
  return new;
end;
$$;

create or replace function public.claim_pending_duplicates()
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
       and t.occurred_at between new.occurred_at - interval '2 days' and new.occurred_at + interval '2 days'
       and not (new.raw_email_id is not null and t.raw_email_id is not distinct from new.raw_email_id)
       and not (new.raw_message_id is not null and t.raw_message_id is not distinct from new.raw_message_id);
  end if;
  return null;
end;
$$;

-- Clear flags already set this way, so those fees show as ordinary items to review.
update public.transactions t
   set duplicate_of = null
  from public.transactions d
 where d.id = t.duplicate_of
   and ((t.raw_email_id is not null and t.raw_email_id = d.raw_email_id)
     or (t.raw_message_id is not null and t.raw_message_id = d.raw_message_id));
