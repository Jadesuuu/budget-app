-- Transfers between own accounts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

insert into public.accounts (id, user_id, institution_id, type, name, opening_balance_centavos) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bpi'), 'savings', 'BPI Savings', 2000000),
  ('aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'gcash'), 'ewallet', 'GCash', 100000),
  ('bbbbbbbb-3333-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
   (select id from public.institutions where slug = 'gcash'), 'ewallet', 'B GCash', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Manual: PHP 5,000 BPI -> GCash with a PHP 15 fee.
select lives_ok(
  $$select public.create_transfer('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000002',
                                  500000, '2026-10-11 09:00+08', 1500)$$,
  'A can record a transfer with a fee');
select is((select balance_centavos from public.account_balances where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  (2000000 - 500000 - 1500)::bigint, 'source account loses amount + fee');
select is((select balance_centavos from public.account_balances where account_id = 'aaaaaaaa-3333-4000-8000-000000000002'),
  (100000 + 500000)::bigint, 'destination account gains the amount');
select is((select count(distinct transfer_id)::int from public.transactions where transfer_id is not null), 1,
  'both legs share one transfer id');
select is((select count(*)::int from public.transactions t join public.categories c on c.id = t.category_id
           where c.name = 'Fees & interest' and t.transfer_id is null), 1, 'the fee is its own expense, outside the transfer');
select throws_ok(
  $$select public.create_transfer('aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000002', 100, now())$$,
  '22023', null, 'a transfer needs two different accounts');

-- Inbox: both sides emailed.
insert into public.transactions (id, account_id, amount_centavos, occurred_at, merchant, source) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', -300000, '2026-10-12 10:00+08', 'InstaPay to GCash', 'email'),
  ('aaaaaaaa-5555-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000002',  300000, '2026-10-12 10:01+08', 'Cash in from BPI', 'email');
select lives_ok(
  $$select public.confirm_as_transfer('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000002')$$,
  'two emailed legs can be confirmed as one transfer');
select is((select count(*)::int from public.transactions
           where id in ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000002')
             and status = 'confirmed' and transfer_id is not null), 2, 'both legs are confirmed and linked');

insert into public.transactions (id, account_id, amount_centavos, occurred_at, source) values
  ('aaaaaaaa-5555-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', -100000, '2026-10-13 10:00+08', 'email'),
  ('aaaaaaaa-5555-4000-8000-000000000004', 'aaaaaaaa-3333-4000-8000-000000000002',   99000, '2026-10-13 10:00+08', 'email');
select throws_ok(
  $$select public.confirm_as_transfer('aaaaaaaa-5555-4000-8000-000000000003', 'aaaaaaaa-5555-4000-8000-000000000004')$$,
  '22023', null, 'legs with different amounts are refused');

-- Inbox: only GCash emailed.
insert into public.transactions (id, account_id, amount_centavos, occurred_at, source) values
  ('aaaaaaaa-5555-4000-8000-000000000005', 'aaaaaaaa-3333-4000-8000-000000000002', 200000, '2026-10-14 08:00+08', 'email');
select lives_ok(
  $$select public.confirm_one_sided_transfer('aaaaaaaa-5555-4000-8000-000000000005', 'aaaaaaaa-3333-4000-8000-000000000001')$$,
  'a one-sided email can be confirmed as a transfer');
select is((select amount_centavos from public.transactions
           where transfer_id = (select transfer_id from public.transactions where id = 'aaaaaaaa-5555-4000-8000-000000000005')
             and id <> 'aaaaaaaa-5555-4000-8000-000000000005'),
  -200000::bigint, 'the missing leg is created on the other account');

-- B cannot move money into A's accounts or use A's transactions.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_transfer('bbbbbbbb-3333-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000002', 100, now())$$,
  '23503', null, 'B cannot transfer into A account');
select throws_ok(
  $$select public.confirm_as_transfer('aaaaaaaa-5555-4000-8000-000000000003', 'aaaaaaaa-5555-4000-8000-000000000004')$$,
  'P0002', null, 'B cannot pair A transactions');

select * from finish();
rollback;
