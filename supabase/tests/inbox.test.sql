-- Review inbox: balances, duplicate detection, confirm with category, reopen, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

insert into public.accounts (id, user_id, institution_id, type, name, opening_balance_centavos) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bdo'), 'savings', 'BDO Savings', 1000000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- A manual Meralco payment, then the bank email for the same payment a day later.
insert into public.transactions (id, account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', -234156, '2026-10-09 10:00+08', 'Meralco', 'confirmed', 'manual');
insert into public.transactions (id, account_id, amount_centavos, occurred_at, merchant, source) values
  ('aaaaaaaa-5555-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', -234156, '2026-10-10 08:00+08', 'MERALCO', 'email');

select is((select duplicate_of from public.transactions where id = 'aaaaaaaa-5555-4000-8000-000000000002'),
  'aaaaaaaa-5555-4000-8000-000000000001'::uuid, 'a pending email transaction is linked to the matching manual entry');

-- Same amount but 5 days later: not a duplicate.
insert into public.transactions (id, account_id, amount_centavos, occurred_at, source) values
  ('aaaaaaaa-5555-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', -234156, '2026-10-15 08:00+08', 'email');
select is((select duplicate_of from public.transactions where id = 'aaaaaaaa-5555-4000-8000-000000000003'),
  null, 'matches more than 2 days apart are not duplicates');

-- Email arrives first, then the user types it in by hand: the pending one gets flagged.
insert into public.transactions (id, account_id, amount_centavos, occurred_at, source) values
  ('aaaaaaaa-5555-4000-8000-000000000004', 'aaaaaaaa-3333-4000-8000-000000000001', -28900, '2026-10-11 20:42+08', 'email');
insert into public.transactions (id, account_id, amount_centavos, occurred_at, status, source) values
  ('aaaaaaaa-5555-4000-8000-000000000005', 'aaaaaaaa-3333-4000-8000-000000000001', -28900, '2026-10-11 12:00+08', 'confirmed', 'manual');
select is((select duplicate_of from public.transactions where id = 'aaaaaaaa-5555-4000-8000-000000000004'),
  'aaaaaaaa-5555-4000-8000-000000000005'::uuid, 'a later manual entry flags the earlier pending email as its duplicate');

select is((select balance_centavos from public.account_balances where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  (1000000 - 234156 - 28900)::bigint, 'balance counts only confirmed transactions');
select is((select pending_count from public.account_balances where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  3::bigint, 'balance view reports pending count');

select is((select category_id from public.confirm_transaction('aaaaaaaa-5555-4000-8000-000000000003',
  (select id from public.categories where name = 'Bills' and user_id is null))),
  (select id from public.categories where name = 'Bills' and user_id is null), 'confirm can set the category');
select is((select balance_centavos from public.account_balances where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  (1000000 - 234156 - 28900 - 234156)::bigint, 'confirming updates the balance');

select is((select status::text from public.reopen_transaction('aaaaaaaa-5555-4000-8000-000000000003')),
  'pending', 'undo puts a reviewed transaction back in the queue');
select throws_ok($$select public.reopen_transaction('aaaaaaaa-5555-4000-8000-000000000001')$$,
  'P0002', null, 'manual entries cannot be reopened into the inbox');
select is((select duplicate_of from public.mark_not_duplicate('aaaaaaaa-5555-4000-8000-000000000002')),
  null, 'not-a-duplicate clears the flag');

-- B sees nothing and cannot act on A's inbox.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.account_balances), 0, 'B cannot see A balances');
select throws_ok($$select public.confirm_transaction('aaaaaaaa-5555-4000-8000-000000000002')$$,
  'P0002', null, 'B cannot confirm A transaction');
select throws_ok($$select public.reopen_transaction('aaaaaaaa-5555-4000-8000-000000000005')$$,
  'P0002', null, 'B cannot reopen A transaction');

reset role;
set local role anon;
select throws_ok($$select * from public.account_balances$$, '42501', null, 'anon cannot read balances');

select * from finish();
rollback;
