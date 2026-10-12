-- Spending plan columns and savings goals: own rows only, atomic add/take out, never below zero.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

insert into public.savings_goals (id, user_id, name, target_centavos) values
  ('bbbbbbbb-9999-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'B trip', 5000000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set monthly_income_centavos = 3000000, spending_limit_centavos = 1500000
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'A can set their own spending plan');
select is((select spending_limit_centavos from public.profiles where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1500000::bigint, 'the limit is saved');

select lives_ok(
  $$insert into public.savings_goals (id, name, target_centavos, target_date)
    values ('aaaaaaaa-9999-4000-8000-000000000001', 'Emergency fund', 10000000, '2027-06-30')$$,
  'A can create a goal');
select is(public.add_to_goal('aaaaaaaa-9999-4000-8000-000000000001', 250000), 250000::bigint, 'adding money returns the new total');
select is(public.add_to_goal('aaaaaaaa-9999-4000-8000-000000000001', -50000), 200000::bigint, 'taking money out lowers it');
select throws_ok(
  $$select public.add_to_goal('aaaaaaaa-9999-4000-8000-000000000001', -300000)$$,
  '23514', null, 'cannot take out more than is saved');

select is((select count(*)::int from public.savings_goals), 1, 'A sees only their own goals');
select is(public.add_to_goal('bbbbbbbb-9999-4000-8000-000000000001', 100000), null, 'A cannot add to B''s goal');
select throws_ok(
  $$insert into public.savings_goals (user_id, name, target_centavos)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'Sneaky', 100)$$,
  '42501', null, 'A cannot create a goal for B');
delete from public.savings_goals where id = 'bbbbbbbb-9999-4000-8000-000000000001';

reset role;
select is((select saved_centavos from public.savings_goals where id = 'bbbbbbbb-9999-4000-8000-000000000001'),
  0::bigint, 'B''s goal is untouched');
select is((select count(*)::int from public.savings_goals where id = 'bbbbbbbb-9999-4000-8000-000000000001'),
  1, 'A cannot delete B''s goal');

select * from finish();
rollback;
