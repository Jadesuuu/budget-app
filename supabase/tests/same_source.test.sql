-- A transfer and its fee from one receipt are never duplicates of each other, even at the same amount.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

insert into auth.users (id, email, aud, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'c@test.local', 'authenticated', 'authenticated');

insert into public.accounts (id, user_id, institution_id, type, name, opening_balance_centavos, opening_balance_at) values
  ('cccccccc-3333-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'gcash'), 'ewallet', 'GCash', 100000, '2026-01-01 00:00+08');

insert into public.raw_emails (id, user_id, inbound_alias, from_address, from_domain, raw_mime) values
  ('cccccccc-7777-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'u_cccccccccc',
   'noreply-banktransfer@gcash.com', 'gcash.com', 'synthetic');

-- What the parser writes for a PHP 10 transfer with a PHP 10 fee: two pending rows from one email.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, source, raw_email_id) values
  ('cccccccc-5555-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'cccccccc-3333-4000-8000-000000000001',
   -1000, '2026-10-11 19:00+08', 'Transfer to BPI', 'email', 'cccccccc-7777-4000-8000-000000000001'),
  ('cccccccc-5555-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001', 'cccccccc-3333-4000-8000-000000000001',
   -1000, '2026-10-11 19:00+08', 'Transfer to BPI fee', 'email', 'cccccccc-7777-4000-8000-000000000001');

select is((select duplicate_of from public.transactions where id = 'cccccccc-5555-4000-8000-000000000002'),
  null, 'a fee from the same email is not flagged as a duplicate of the transfer');

-- Confirming the transfer doesn't claim its own fee either.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, status, source, raw_email_id) values
  ('cccccccc-5555-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000001', 'cccccccc-3333-4000-8000-000000000001',
   -1000, '2026-10-11 19:00+08', 'Same receipt, confirmed', 'confirmed', 'email', 'cccccccc-7777-4000-8000-000000000001');
select is((select duplicate_of from public.transactions where id = 'cccccccc-5555-4000-8000-000000000002'),
  null, 'a confirmed row from the same email does not claim its fee');

-- A different source at the same amount is still caught.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, source) values
  ('cccccccc-5555-4000-8000-000000000004', 'cccccccc-0000-4000-8000-000000000001', 'cccccccc-3333-4000-8000-000000000001',
   -1000, '2026-10-11 19:05+08', 'Typed by hand', 'manual');
select isnt((select duplicate_of from public.transactions where id = 'cccccccc-5555-4000-8000-000000000004'),
  null, 'the same amount from another source is still flagged');

select * from finish();
rollback;
