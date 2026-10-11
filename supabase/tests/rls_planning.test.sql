-- Planning schema: account-type guards, generated schedules, schedule immutability,
-- and cross-user isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Setup (as postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

insert into public.accounts (id, user_id, institution_id, type, name) values
  ('aaaaaaaa-3333-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bpi'), 'credit', 'BPI Credit'),
  ('aaaaaaaa-3333-4000-8000-00000000000d', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bdo'), 'debit', 'BDO Debit'),
  ('aaaaaaaa-3333-4000-8000-00000000000e', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bdo'), 'loan', 'BDO Personal Loan'),
  ('aaaaaaaa-3333-4000-8000-00000000000f', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'unionbank'), 'loan', 'Car loan'),
  ('aaaaaaaa-3333-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'atome'), 'bnpl', 'Atome');

-- ---------------------------------------------------------------------------
-- As user A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.credit_cards (account_id, statement_day, due_day, monthly_interest_bps, min_payment_bps, min_payment_floor_centavos)
    values ('aaaaaaaa-3333-4000-8000-00000000000c', 10, 30, 300, 300, 50000)$$,
  'A can set up a credit card on own credit account');
select throws_ok(
  $$insert into public.credit_cards (account_id, statement_day, due_day, monthly_interest_bps, min_payment_bps)
    values ('aaaaaaaa-3333-4000-8000-00000000000d', 10, 30, 300, 300)$$,
  '23514', null, 'a credit card cannot attach to a debit account');
select lives_ok(
  $$insert into public.statements (account_id, period_start, period_end, due_date, statement_balance_centavos, minimum_due_centavos)
    values ('aaaaaaaa-3333-4000-8000-00000000000c', '2026-09-11', '2026-10-10', '2026-10-30', 1845020, 150000)$$,
  'A can record a statement');
select throws_ok(
  $$insert into public.statements (account_id, period_start, period_end, due_date, statement_balance_centavos)
    values ('aaaaaaaa-3333-4000-8000-00000000000c', '2026-10-11', '2026-11-10', '2026-11-01', 100)$$,
  '23514', null, 'statement due date must come after the statement date');

-- Diminishing: PHP 100,000 at 1%/month for 12 months -> PHP 8,884.88/month.
select lives_ok(
  $$insert into public.loans (id, account_id, principal_centavos, monthly_rate_bps, interest_method, term_months, start_date, first_due_date)
    values ('aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-00000000000e',
            10000000, 100, 'diminishing', 12, '2026-10-01', '2026-11-01')$$,
  'A can create a diminishing-balance loan');
select is((select count(*)::int from public.loan_payments where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001'),
  12, 'loan schedule has one row per month');
select is((select sum(principal_centavos)::bigint from public.loan_payments where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001'),
  10000000::bigint, 'schedule repays exactly the principal');
select is((select amount_centavos from public.loan_payments where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001' and seq = 1),
  888488::bigint, 'monthly amortization matches the standard formula');
select is((select due_date from public.loan_payments where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001' and seq = 12),
  '2027-10-01'::date,
  'last due date is 11 months after the first');

-- Add-on (flat): PHP 60,000 at 1.5%/month for 12 months -> PHP 10,800 total interest.
select lives_ok(
  $$insert into public.loans (id, account_id, principal_centavos, monthly_rate_bps, interest_method, term_months, start_date, first_due_date)
    values ('aaaaaaaa-6666-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-00000000000f',
            6000000, 150, 'add_on', 12, '2026-10-01', '2026-10-31')$$,
  'A can create an add-on rate loan');
select is((select sum(interest_centavos)::bigint from public.loan_payments where loan_id = 'aaaaaaaa-6666-4000-8000-000000000002'),
  1080000::bigint, 'add-on interest is rate x principal x term');
select is((select due_date from public.loan_payments where loan_id = 'aaaaaaaa-6666-4000-8000-000000000002' and seq = 2),
  '2026-11-30'::date, 'month-end due dates clamp to the last day of shorter months');

-- Installments: PHP 1,000.00 in 3 -> 333.34 + 333.33 + 333.33.
select lives_ok(
  $$insert into public.installment_plans (id, account_id, description, total_centavos, installments, frequency, first_due_date)
    values ('aaaaaaaa-7777-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000010', 'Shopee order', 100000, 3, 'monthly', '2026-10-22')$$,
  'A can create an installment plan on a BNPL account');
select results_eq(
  $$select amount_centavos from public.installment_payments where plan_id = 'aaaaaaaa-7777-4000-8000-000000000001' order by seq$$,
  $$values (33334::bigint), (33333::bigint), (33333::bigint)$$,
  'installments split evenly with leftover centavos on the first');
select throws_ok(
  $$insert into public.installment_plans (account_id, description, total_centavos, installments, first_due_date)
    values ('aaaaaaaa-3333-4000-8000-00000000000d', 'x', 100000, 3, '2026-10-22')$$,
  '23514', null, 'installment plans cannot attach to a debit account');

-- Schedules are system-managed.
select lives_ok(
  $$update public.loan_payments set paid_at = now() where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001' and seq = 1$$,
  'A can mark a loan payment paid');
select throws_ok(
  $$update public.loans set term_months = 24 where id = 'aaaaaaaa-6666-4000-8000-000000000001'$$,
  '23514', null, 'loan terms are locked once a payment is recorded');
select throws_ok(
  $$update public.loan_payments set principal_centavos = 1 where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001'$$,
  '42501', null, 'A cannot edit generated payment amounts');
select throws_ok(
  $$insert into public.loan_payments (user_id, loan_id, seq, due_date, principal_centavos, interest_centavos)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-6666-4000-8000-000000000001', 99, '2030-01-01', 1, 0)$$,
  '42501', null, 'A cannot insert schedule rows directly');

select lives_ok(
  $$insert into public.income_sources (id, name, amount_centavos, frequency, account_id)
    values ('aaaaaaaa-8888-4000-8000-000000000001', 'Salary', 2850000, 'semi_monthly', 'aaaaaaaa-3333-4000-8000-00000000000d')$$,
  'A can add an income source');
select lives_ok(
  $$insert into public.recurring_rules (account_id, name, amount_centavos, frequency, day_of_month, next_due_on, income_source_id)
    values ('aaaaaaaa-3333-4000-8000-00000000000d', 'Salary', 2850000, 'semi_monthly', 15, '2026-10-15', 'aaaaaaaa-8888-4000-8000-000000000001')$$,
  'A can add a recurring rule');

-- ---------------------------------------------------------------------------
-- As user B
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.credit_cards), 0, 'B cannot see A credit cards');
select is((select count(*)::int from public.statements), 0, 'B cannot see A statements');
select is((select count(*)::int from public.loans), 0, 'B cannot see A loans');
select is((select count(*)::int from public.loan_payments), 0, 'B cannot see A loan payments');
select is((select count(*)::int from public.installment_plans), 0, 'B cannot see A installment plans');
select is((select count(*)::int from public.installment_payments), 0, 'B cannot see A installment payments');
select is((select count(*)::int from public.income_sources) + (select count(*)::int from public.recurring_rules), 0,
  'B cannot see A income sources or recurring rules');
select throws_ok(
  $$insert into public.credit_cards (account_id, statement_day, due_day, monthly_interest_bps, min_payment_bps)
    values ('aaaaaaaa-3333-4000-8000-00000000000c', 1, 20, 300, 300)$$,
  '23503', null, 'B cannot attach a card to A account');
select throws_ok(
  $$insert into public.recurring_rules (account_id, name, amount_centavos, frequency, next_due_on)
    values ('aaaaaaaa-3333-4000-8000-00000000000d', 'x', -100, 'monthly', '2026-11-01')$$,
  '23503', null, 'B cannot create a recurring rule on A account');

-- Silent no-op under RLS; verified below.
update public.loan_payments set paid_at = now() where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001' and seq = 2;

-- ---------------------------------------------------------------------------
-- anon, then verification as postgres
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select * from public.loans$$, '42501', null, 'anon cannot read loans');

reset role;
select is((select paid_at from public.loan_payments where loan_id = 'aaaaaaaa-6666-4000-8000-000000000001' and seq = 2),
  null, 'B could not mark A loan payment paid');

select * from finish();
rollback;
