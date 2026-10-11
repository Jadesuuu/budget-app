-- RLS isolation for the core schema: user B must never see or change user A's data,
-- and logged-out (anon) requests get nothing.
begin;
create extension if not exists pgtap with schema extensions;
-- Hosted projects do not put the extensions schema on the search path by default.
set local search_path = public, extensions;
select plan(33);

-- ---------------------------------------------------------------------------
-- Setup (as postgres, RLS bypassed)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated', '{}');

insert into public.institutions (id, user_id, name, kind) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ana Coop', 'bank');
insert into public.categories (id, user_id, name) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ana Pets');
insert into public.accounts (id, user_id, institution_id, type, name, last4) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bpi'), 'credit', 'BPI Credit', '4417');
insert into public.raw_emails (id, user_id, inbound_alias, from_address, from_domain, raw_mime) values
  ('aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'u_test', 'alerts@example.com', 'example.com', 'Subject: test');
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, source, raw_email_id) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-3333-4000-8000-000000000001', -28900, now(), 'Jollibee', 'email', 'aaaaaaaa-4444-4000-8000-000000000001'),
  ('aaaaaaaa-5555-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-3333-4000-8000-000000000001', -234156, now(), 'Meralco', 'email', null);

-- Scoped to the test users: a local database may also hold real accounts.
select is((select count(*)::int from public.profiles
           where user_id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002')
             and inbound_alias ~ '^u_[a-z0-9]{10}$'), 2,
  'signup creates a profile with a valid inbound alias');
select is((select count(distinct inbound_alias)::int from public.profiles
           where user_id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002')), 2,
  'inbound aliases are unique');
select is((select count(*)::int from public.institutions where user_id is null), 22, 'shared institutions seeded');
select is((select count(*)::int from public.categories where user_id is null), 20, 'shared categories seeded');

-- ---------------------------------------------------------------------------
-- As user A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from public.accounts), 1, 'A sees own account');
select is((select count(*)::int from public.transactions), 2, 'A sees own transactions');
select is((select count(*)::int from public.raw_emails), 1, 'A sees own raw email');
select is((select count(*)::int from public.profiles), 1, 'A sees only own profile');
select is((select count(*)::int from public.institutions), 23, 'A sees shared + own institutions');
select is((select count(*)::int from public.categories), 21, 'A sees shared + own categories');
select is((select status::text from public.confirm_transaction('aaaaaaaa-5555-4000-8000-000000000001')),
  'confirmed', 'A can confirm own pending transaction');

-- ---------------------------------------------------------------------------
-- As user B
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.accounts), 0, 'B cannot see A accounts');
select is((select count(*)::int from public.transactions), 0, 'B cannot see A transactions');
select is((select count(*)::int from public.raw_emails), 0, 'B cannot see A raw emails');
select is((select user_id from public.profiles), 'bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'B sees only own profile');
select is((select count(*)::int from public.institutions), 22, 'B cannot see A private institution');
select is((select count(*)::int from public.categories), 20, 'B cannot see A private category');

select throws_ok(
  $$insert into public.transactions (account_id, amount_centavos, occurred_at)
    values ('aaaaaaaa-3333-4000-8000-000000000001', -100, now())$$,
  '23503', null, 'B cannot add a transaction to A account');
select throws_ok(
  $$insert into public.accounts (user_id, institution_id, type, name)
    values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.institutions where slug = 'bdo'), 'debit', 'x')$$,
  '42501', null, 'B cannot create an account owned by A');
select throws_ok(
  $$insert into public.accounts (institution_id, type, name)
    values ('aaaaaaaa-1111-4000-8000-000000000001', 'debit', 'x')$$,
  '23503', null, 'B cannot use A private institution');
select throws_ok(
  $$select public.confirm_transaction('aaaaaaaa-5555-4000-8000-000000000002')$$,
  'P0002', null, 'B cannot confirm A pending transaction');
select throws_ok(
  $$update public.profiles set inbound_alias = 'u_aaaaaaaaaa'$$,
  '42501', null, 'B cannot change own inbound alias');
select throws_ok(
  $$insert into public.raw_emails (user_id, inbound_alias, from_address, from_domain, raw_mime)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'u_x', 'a@b.c', 'b.c', 'x')$$,
  '42501', null, 'B cannot insert raw emails directly');
select lives_ok(
  $$insert into public.accounts (id, institution_id, type, name)
    values ('bbbbbbbb-3333-4000-8000-000000000001', (select id from public.institutions where slug = 'gcash'), 'ewallet', 'GCash')$$,
  'B can create own account with a shared institution');
select throws_ok(
  $$insert into public.transactions (account_id, amount_centavos, occurred_at, duplicate_of)
    values ('bbbbbbbb-3333-4000-8000-000000000001', -100, now(), 'aaaaaaaa-5555-4000-8000-000000000002')$$,
  '23503', null, 'B cannot mark a transaction as duplicate of A transaction');
select throws_ok(
  $$insert into public.accounts (institution_id, type, name, last4)
    values ((select id from public.institutions where slug = 'bdo'), 'credit', 'x', '12345')$$,
  '23514', null, 'last4 must be exactly 4 digits');
select throws_ok(
  $$insert into public.transactions (account_id, amount_centavos, occurred_at)
    values ('bbbbbbbb-3333-4000-8000-000000000001', 0, now())$$,
  '23514', null, 'zero-amount transactions are rejected');

-- Silent no-ops under RLS; verified below as postgres.
update public.accounts set name = 'hacked' where id = 'aaaaaaaa-3333-4000-8000-000000000001';
delete from public.transactions where id = 'aaaaaaaa-5555-4000-8000-000000000002';
update public.institutions set name = 'hacked' where slug = 'bpi';

-- ---------------------------------------------------------------------------
-- As anon (logged out)
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$select * from public.accounts$$, '42501', null, 'anon cannot read accounts');
select throws_ok($$select * from public.institutions$$, '42501', null, 'anon cannot read institutions');
select throws_ok($$select public.confirm_transaction('aaaaaaaa-5555-4000-8000-000000000002')$$,
  '42501', null, 'anon cannot call inbox RPCs');

-- ---------------------------------------------------------------------------
-- Verify B's attempted writes changed nothing
-- ---------------------------------------------------------------------------
reset role;
select is((select name from public.accounts where id = 'aaaaaaaa-3333-4000-8000-000000000001'), 'BPI Credit',
  'B could not rename A account');
select is((select count(*)::int from public.transactions where id = 'aaaaaaaa-5555-4000-8000-000000000002'), 1,
  'B could not delete A transaction');
select is((select name from public.institutions where slug = 'bpi'), 'BPI', 'B could not edit a shared institution');

select * from finish();
rollback;
