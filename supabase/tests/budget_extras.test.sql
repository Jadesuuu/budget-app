-- Paydays, category settings, goal accounts, push subscriptions, notification log: own rows only.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');
insert into public.accounts (id, user_id, institution_id, type, name) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'maya'), 'savings', 'Maya Savings'),
  ('aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bpi'), 'credit', 'BPI Credit'),
  ('bbbbbbbb-3333-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
   (select id from public.institutions where slug = 'gcash'), 'ewallet', 'B GCash');
insert into public.categories (id, user_id, name) values
  ('bbbbbbbb-7777-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'B private');
insert into public.category_settings (user_id, category_id, fixed) values
  ('bbbbbbbb-0000-4000-8000-000000000002', (select id from public.categories where user_id is null and name = 'Rent'), true);
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'https://push.example/b', 'key', 'auth');
insert into public.notification_log (user_id, kind, ref) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bill', 'statement:x');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- paydays
select lives_ok($$update public.profiles set paydays = '{15,31}' where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'A can set paydays');
select throws_ok($$update public.profiles set paydays = '{0}' where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514', null, 'paydays must be days of the month');
select throws_ok($$update public.profiles set paydays = '{}' where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514', null, 'at least one payday');

-- category settings
select lives_ok(
  $$insert into public.category_settings (category_id, fixed, monthly_limit_centavos)
    values ((select id from public.categories where user_id is null and name = 'Food'), false, 600000)$$,
  'A can set a limit on a shared category');
select throws_ok(
  $$insert into public.category_settings (category_id, fixed) values ('bbbbbbbb-7777-4000-8000-000000000001', true)$$,
  '42501', null, 'A cannot attach settings to B''s private category');
select is((select count(*)::int from public.category_settings), 1, 'A sees only their own category settings');
select throws_ok(
  $$insert into public.category_settings (user_id, category_id, fixed)
    values ('bbbbbbbb-0000-4000-8000-000000000002', (select id from public.categories where user_id is null and name = 'Food'), true)$$,
  '42501', null, 'A cannot write settings for B');

-- goals backed by an account
select lives_ok(
  $$insert into public.savings_goals (name, target_centavos, account_id)
    values ('Rainy day', 5000000, 'aaaaaaaa-3333-4000-8000-000000000001')$$,
  'A can back a goal with their savings account');
select throws_ok(
  $$insert into public.savings_goals (name, target_centavos, account_id)
    values ('Bad', 5000000, 'aaaaaaaa-3333-4000-8000-000000000002')$$,
  '23514', null, 'a credit card cannot back a goal');
select throws_ok(
  $$insert into public.savings_goals (name, target_centavos, account_id)
    values ('Sneaky', 5000000, 'bbbbbbbb-3333-4000-8000-000000000001')$$,
  null, null, 'A cannot back a goal with B''s account');

-- push subscriptions
select lives_ok(
  $$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/a', 'key', 'auth')$$,
  'A can subscribe a device');
select throws_ok(
  $$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('http://insecure.example/a', 'key', 'auth')$$,
  '23514', null, 'push endpoints must be https');
select is((select count(*)::int from public.push_subscriptions), 1, 'A sees only their own devices');
delete from public.push_subscriptions where endpoint = 'https://push.example/b';
select throws_ok($$update public.push_subscriptions set device = 'x'$$, '42501', null, 'subscriptions are never edited');

-- notification log is for the job only
select throws_ok($$select * from public.notification_log$$, '42501', null, 'users cannot read the notification log');
select throws_ok($$insert into public.notification_log (user_id, kind, ref) values ('aaaaaaaa-0000-4000-8000-000000000001', 'x', 'y')$$,
  '42501', null, 'users cannot write the notification log');

reset role;
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/b'), 1,
  'A cannot delete B''s device');
select is((select fixed from public.category_settings where user_id = 'bbbbbbbb-0000-4000-8000-000000000002'), true,
  'B''s settings are untouched');

select * from finish();
rollback;
