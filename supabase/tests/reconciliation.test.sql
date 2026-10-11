-- Reconciliation: dated opening balances, checkpoints, statements on BNPL, undoable imports, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

-- GCash opened at PHP 1,000.00 as of Oct 5.
insert into public.accounts (id, user_id, institution_id, type, name, opening_balance_centavos, opening_balance_at) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'gcash'), 'ewallet', 'GCash', 100000, '2026-10-05 00:00+08'),
  ('aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'atome'), 'bnpl', 'Atome', -50000, '2026-10-01 00:00+08'),
  ('aaaaaaaa-3333-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bpi'), 'savings', 'BPI', 0, '2026-10-01 00:00+08');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.transactions (account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-3333-4000-8000-000000000001', -50000, '2026-10-01 10:00+08', 'Before opening', 'confirmed', 'manual'),
  ('aaaaaaaa-3333-4000-8000-000000000001', -11600, '2026-10-06 07:38+08', 'MCDO', 'confirmed', 'manual'),
  ('aaaaaaaa-3333-4000-8000-000000000001', -14300, '2026-10-08 18:55+08', 'Angkas', 'pending', 'sms');

select is((select balance_centavos from public.account_balances where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  (100000 - 11600)::bigint, 'transactions before the opening date do not move the balance');

-- GCash says the balance after Angkas was PHP 600.00: 1000 - 116 - 143 = 741, so 141 is unaccounted for.
insert into public.balance_checkpoints (account_id, balance_centavos, as_of, source)
values ('aaaaaaaa-3333-4000-8000-000000000001', 60000, '2026-10-08 18:56+08', 'manual');
select is((select reported_centavos - confirmed_centavos - pending_centavos from public.account_reconciliation
           where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  -14100::bigint, 'a checkpoint shows exactly how much is missing');
select is((select pending_centavos from public.account_reconciliation where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  -14300::bigint, 'pending items count toward the comparison');

-- A newer checkpoint that matches.
insert into public.transactions (account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-3333-4000-8000-000000000001', -14100, '2026-10-08 12:00+08', 'Found it', 'confirmed', 'manual');
insert into public.balance_checkpoints (account_id, balance_centavos, as_of, source)
values ('aaaaaaaa-3333-4000-8000-000000000001', 60000, '2026-10-08 19:00+08', 'manual');
select is((select reported_centavos - confirmed_centavos - pending_centavos from public.account_reconciliation
           where account_id = 'aaaaaaaa-3333-4000-8000-000000000001'),
  0::bigint, 'the latest checkpoint matches once the missing item is added');
select throws_ok(
  $$insert into public.balance_checkpoints (account_id, balance_centavos, as_of, source)
    values ('aaaaaaaa-3333-4000-8000-000000000001', 1, now(), 'sms')$$,
  '42501', null, 'users can only add manual checkpoints');

-- Statements work for BNPL, not for savings.
select lives_ok(
  $$insert into public.statements (account_id, period_end, due_date, statement_balance_centavos, minimum_due_centavos, source)
    values ('aaaaaaaa-3333-4000-8000-000000000002', '2026-09-17', '2026-09-27', 649224, 0, 'email')$$,
  'an Atome bill is a statement');
select throws_ok(
  $$insert into public.statements (account_id, period_end, due_date, statement_balance_centavos)
    values ('aaaaaaaa-3333-4000-8000-000000000003', '2026-09-17', '2026-09-27', 1)$$,
  '23514', null, 'savings accounts have no statements');

-- Imports are undoable: deleting one removes exactly the rows it added.
insert into public.imports (id, account_id, format, rows_total, rows_added)
values ('aaaaaaaa-7777-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000003', 'test', 2, 2);
insert into public.transactions (account_id, amount_centavos, occurred_at, merchant, status, source, import_id) values
  ('aaaaaaaa-3333-4000-8000-000000000003', 500000, '2026-10-02 09:00+08', 'Imported 1', 'pending', 'statement', 'aaaaaaaa-7777-4000-8000-000000000001'),
  ('aaaaaaaa-3333-4000-8000-000000000003', -20000, '2026-10-03 09:00+08', 'Imported 2', 'pending', 'statement', 'aaaaaaaa-7777-4000-8000-000000000001');
insert into public.transactions (account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-3333-4000-8000-000000000003', -1000, '2026-10-03 10:00+08', 'Mine', 'confirmed', 'manual');
delete from public.imports where id = 'aaaaaaaa-7777-4000-8000-000000000001';
select is((select count(*)::int from public.transactions where account_id = 'aaaaaaaa-3333-4000-8000-000000000003'),
  1, 'undoing an import removes only what it added');

-- Isolation.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.balance_checkpoints), 0, 'B cannot see A checkpoints');
select is((select count(*)::int from public.account_reconciliation), 0, 'B cannot see A reconciliation');
select is((select count(*)::int from public.statements), 0, 'B cannot see A statements');
select throws_ok(
  $$insert into public.balance_checkpoints (account_id, balance_centavos, as_of, source)
    values ('aaaaaaaa-3333-4000-8000-000000000001', 1, now(), 'manual')$$,
  '23503', null, 'B cannot add a checkpoint to A account');
select throws_ok(
  $$insert into public.imports (account_id, format) values ('aaaaaaaa-3333-4000-8000-000000000001', 'x')$$,
  '23503', null, 'B cannot import into A account');

select * from finish();
rollback;
